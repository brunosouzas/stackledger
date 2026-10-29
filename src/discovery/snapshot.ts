/** The snapshot model `stackledger-snapshot/v1` (design D3, mac-discovery spec).
 *
 * One module for everything about the file's content, so `discover` writes and `drift` reads the same
 * rules: the zod schema (strict objects: an unknown field is a shape error), the consistency checks,
 * the secret guard, merging, sorting and the serialiser.
 *
 * - buildSnapshot turns the raw source results into a snapshot: an item holding private-key material
 *   or a card number (src/secrets.ts, the catalogue's rule) is left out and counted as ignored; items of
 *   one source without a path and with the same id are merged; every list is sorted without repeats and
 *   items are sorted by source order, id, path (Unicode code points). A secret in a `machine` field
 *   throws: discovery then fails and writes nothing. E-mail addresses are not checked (spec).
 * - checkSnapshot validates parsed JSON and names only the kind of problem, never a value.
 * - serialise writes JSON with two-space indentation, U+007F–U+009F as \u escapes, and a final line feed.
 */
import { z } from 'zod';
import { escapeJsonControls } from '../control.js';
import { InternalError } from '../errors.js';
import { compareText } from '../identity.js';
import { secretRules } from '../secrets.js';
import { SOURCES, type SourceName } from './annotations.js';
import type { Reason } from './run.js';
import type { Item, SourceResult, Status } from './types.js';

export const SNAPSHOT_FORMAT = 'stackledger-snapshot/v1';

export interface Machine { name: string; user: string; macos: string | null }
export interface SnapshotSource { source: SourceName; status: Status; reason: Reason | null; items: number; ignored: number }
export interface Snapshot { format: typeof SNAPSHOT_FORMAT; takenAt: string; machine: Machine; sources: SnapshotSource[]; items: Item[] }

const REASON = /^(?:not found|exited with code \d+|time limit|output limit|unreadable output|cannot be read)$/;
const TAKEN_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
/** What src/discovery/machine.ts fold() can return, apart from ''. */
const MACHINE_NAME = /^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = z.string().min(1);
const list = z.array(text);
/** Sources whose every item has at least one installed version (launchd has none; an app may have none). */
const versions = z.array(text).min(1);
const itemSchema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('brew'), id: text, versions, onRequest: z.boolean(), dependsOn: list }),
  z.strictObject({ source: z.literal('cask'), id: text, versions, apps: list }),
  z.strictObject({ source: z.literal('mas'), id: text, versions, title: text }),
  z.strictObject({ source: z.literal('app'), id: text, versions: list, title: text, path: text, appStore: z.boolean() }),
  z.strictObject({ source: z.literal('launchd'), id: text, versions: z.array(text).max(0), scope: z.enum(['user-agent', 'agent', 'daemon', 'app-agent', 'app-daemon', 'app-login-item']), path: text, program: text.nullable(),
    // Absent in snapshots written before the field existed (drift spec, Snapshot without script): read as null.
    script: text.nullable().default(null) }),
  z.strictObject({ source: z.literal('mise'), id: text, versions }),
  z.strictObject({ source: z.literal('npm'), id: text, versions }),
  z.strictObject({ source: z.literal('pipx'), id: text, versions }),
]);
const count = z.number().int().nonnegative();
export const snapshotSchema: z.ZodType<Snapshot, unknown> = z.strictObject({
  format: z.literal(SNAPSHOT_FORMAT),
  takenAt: z.string().regex(TAKEN_AT),
  machine: z.strictObject({ name: z.string().regex(MACHINE_NAME), user: text, macos: text.nullable() }),
  sources: z.array(z.strictObject({
    source: z.enum(SOURCES), status: z.enum(['ok', 'skipped', 'failed']),
    reason: z.custom<Reason>(value => typeof value === 'string' && REASON.test(value)).nullable(), items: count, ignored: count,
  })),
  items: z.array(itemSchema),
});

/** Every string of an item (id, versions, title, path, apps, dependencies, program, script). */
function strings(item: Item): string[] {
  return Object.values(item).flatMap(value => typeof value === 'string' ? [value] : Array.isArray(value) ? value as string[] : []);
}
const sorted = (values: string[]) => [...new Set(values)].sort(compareText);
const titleOf = (item: Item) => 'title' in item ? item.title : undefined;

/** The item with its lists sorted and repeats removed, fields in the order of design D3. */
function normalise(item: Item): Item {
  const versions = sorted(item.versions);
  switch (item.source) {
    case 'brew': return { source: 'brew', id: item.id, versions, onRequest: item.onRequest, dependsOn: sorted(item.dependsOn) };
    case 'cask': return { source: 'cask', id: item.id, versions, apps: sorted(item.apps) };
    case 'mas': return { source: 'mas', id: item.id, versions, title: item.title };
    case 'app': return { source: 'app', id: item.id, versions, title: item.title, path: item.path, appStore: item.appStore };
    case 'launchd': return { source: 'launchd', id: item.id, versions, scope: item.scope, path: item.path, program: item.program, script: item.script };
    default: return { source: item.source, id: item.id, versions };
  }
}

/** Two items of one source with the same id and no path, as one: lists united, onRequest when any,
 * the first title by code point. Commutative, so input order does not matter. */
function merge(left: Item, right: Item): Item {
  const merged = { ...left, versions: [...left.versions, ...right.versions] } as Item;
  if (merged.source === 'brew' && right.source === 'brew') { merged.dependsOn = [...merged.dependsOn, ...right.dependsOn]; merged.onRequest ||= right.onRequest; }
  if (merged.source === 'cask' && right.source === 'cask') merged.apps = [...merged.apps, ...right.apps];
  if (merged.source === 'mas' && right.source === 'mas' && compareText(right.title, merged.title) < 0) merged.title = right.title;
  return merged;
}

const pathOf = (item: Item) => 'path' in item ? item.path : '';
export function compareItems(left: Item, right: Item): number {
  return SOURCES.indexOf(left.source) - SOURCES.indexOf(right.source) || compareText(left.id, right.id) || compareText(pathOf(left), pathOf(right));
}

/** One source's items after the secret guard and merging, and how many the guard left out. */
function finishItems(result: SourceResult): { items: Item[]; leftOut: number } {
  const byId = new Map<string, Item>(), withPath: Item[] = [];
  let leftOut = 0;
  for (const item of result.items) {
    if (strings(item).some(value => secretRules(value).length)) { leftOut++; continue; }
    if ('path' in item) { withPath.push(item); continue; }
    const earlier = byId.get(item.id);
    byId.set(item.id, earlier ? merge(earlier, item) : item);
  }
  return { items: [...byId.values(), ...withPath].map(normalise), leftOut };
}

/** `new Date().toISOString()` cut to seconds. */
export function takenAt(now: Date): string { return `${now.toISOString().slice(0, 19)}Z`; }

/** The snapshot of the given source results; throws when a machine field breaks a secret rule. */
export function buildSnapshot(input: { now: Date; machine: Machine; results: SourceResult[] }): Snapshot {
  for (const [field, value] of Object.entries(input.machine)) {
    const rules = typeof value === 'string' ? secretRules(value) : [];
    if (rules.length) throw new InternalError(`stackledger discover: machine.${field} breaks a secret rule (${rules.join('; ')}); nothing was written`);
  }
  const sources: SnapshotSource[] = [], items: Item[] = [];
  for (const result of input.results) {
    const { items: recorded, leftOut } = result.status === 'ok' ? finishItems(result) : { items: [], leftOut: 0 };
    sources.push({ source: result.source, status: result.status, reason: result.reason, items: recorded.length, ignored: result.ignored + leftOut });
    items.push(...recorded);
  }
  return { format: SNAPSHOT_FORMAT, takenAt: takenAt(input.now), machine: { ...input.machine }, sources, items: items.sort(compareItems) };
}

/** Whether a snapshot that has the right shape keeps the consistency rules (spec, Snapshot consistency). */
function consistent(snapshot: Snapshot): boolean {
  if (snapshot.sources.map(source => source.source).join() !== SOURCES.join()) return false;
  const status = new Map(snapshot.sources.map(source => [source.source, source]));
  const seen = new Set<string>();
  for (const item of snapshot.items) {
    if (status.get(item.source)!.status !== 'ok') return false;
    const key = JSON.stringify([item.source, item.id, pathOf(item)]);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return snapshot.sources.every(source => (source.reason === null) === (source.status === 'ok')
    && source.items === snapshot.items.filter(item => item.source === source.source).length);
}

export type SnapshotCheck = { snapshot: Snapshot } | { problem: 'format' | 'shape' | 'consistency' } | { problem: 'secret'; rule: string };
/** Check parsed JSON as a `stackledger-snapshot/v1` snapshot; the result names a problem, never a value. */
export function checkSnapshot(value: unknown): SnapshotCheck {
  const format = value !== null && typeof value === 'object' ? (value as Record<string, unknown>).format : undefined;
  if (typeof format === 'string' && format !== SNAPSHOT_FORMAT) return { problem: 'format' };
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) return { problem: 'shape' };
  if (!consistent(parsed.data)) return { problem: 'consistency' };
  const all = [...Object.values(parsed.data.machine).filter((entry): entry is string => typeof entry === 'string'), ...parsed.data.items.flatMap(strings)];
  for (const entry of all) { const rules = secretRules(entry); if (rules.length) return { problem: 'secret', rule: rules[0]! }; }
  return { snapshot: parsed.data };
}

/** The file's text: deterministic for the same snapshot. */
export function serialise(snapshot: Snapshot): string {
  return `${escapeJsonControls(JSON.stringify(snapshot, null, 2))}\n`;
}
