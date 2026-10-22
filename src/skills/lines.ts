/** Read and check the skills map files of a skill set (skill-source spec: Skills map file, One read per
 * map file, Skills map file problems, Skills map documents, Skill references, Playbook zones, Several
 * skills map files). Used by src/skills/source.ts after the set is fixed; only reads.
 *
 * Why this shape:
 * - Each file is read with the skill set's bounded reader (size, not-a-file, unreadable) and parsed with
 *   the catalogue's `parseSource`, then each document gets the catalogue's checks for a `Line` or a
 *   `MapLayout`: the same schemas, messages and secret scan, so a map file behaves like a catalogue file.
 * - References are not catalogue references: `skill:`, `playbook:` or `agent:` in lower case, then the
 *   exact item name (everything after the first `:`), because skill identity is the exact name.
 * - Problems here never remove an item from the set; a stop or a zone in error is simply not drawn
 *   (src/skills/metro.ts resolves the served lines and zones against the set again).
 * - The documents of every map file are one catalogue, in folder order: names and codes are unique
 *   across files and only the first MapLayout is used.
 */
import { MAX_FILE_BYTES, parseSource, problem, type FieldPath, type Problem, type Source } from '../source.js';
import { lineSchema, layoutSchema, name as nameSchema, type Line, type MapLayout } from '../schema.js';
import { scanSecrets } from '../secrets.js';
import { schemaProblems } from '../validate.js';
import { readBounded } from './read.js';

export type ItemKind = 'skill' | 'playbook' | 'agent';
export const ITEM_KINDS: readonly ItemKind[] = ['skill', 'playbook', 'agent'];
/** The served map documents: lines in folder and document order, and the first valid layout. */
export interface SkillsMap {
  lines: Line[];
  layout?: MapLayout;
}
/** What the checks need to know about the set: each item name and its kind. */
export type ItemKinds = Map<string, ItemKind[]>;

const API_VERSION = 'stackledger/v1alpha1';
interface Document { source: Source; kind: 'Line' | 'MapLayout'; name: string; served?: Line | MapLayout }

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const spec = (document: Document) => object(document.source.value.spec);

/** A map-file reference split as written: the kind before the first `:`, the name after it. */
export function splitReference(value: string): { kind: ItemKind; name: string } | undefined {
  const at = value.indexOf(':');
  if (at < 0) return;
  const kind = value.slice(0, at), name = value.slice(at + 1);
  return (ITEM_KINDS as readonly string[]).includes(kind) && name ? { kind: kind as ItemKind, name } : undefined;
}

/** Read the map files in folder order and check them against the set's items. */
export async function readSkillsMap(files: { path: string; absolute: string }[], items: ItemKinds, problems: Problem[]): Promise<SkillsMap> {
  const sources: Source[] = [];
  for (const file of files) {
    const read = await readBounded(file.absolute, file.path, { bytes: MAX_FILE_BYTES, tooLarge: 'File exceeds 1 MiB', unreadable: 'File cannot be read' });
    if ('problem' in read) { problems.push(read.problem); continue; }
    const parsed = parseSource(file.path, read.text);
    problems.push(...parsed.problems); sources.push(...parsed.sources);
  }
  return checkSkillsMap(sources, items, problems);
}

/** The catalogue's document checks for Line and MapLayout, then the cross-document checks. */
export function checkSkillsMap(sources: Source[], items: ItemKinds, problems: Problem[]): SkillsMap {
  const documents: Document[] = [];
  for (const source of sources) {
    const value = source.value, kind = value.kind;
    if (typeof kind !== 'string' || !kind) { problems.push(problem(source, ['kind'], 'kind is required')); continue; }
    if (kind !== 'Line' && kind !== 'MapLayout') { problems.push(problem(source, ['kind'], 'Supported kinds in a skills map file: Line, MapLayout')); continue; }
    if (value.apiVersion !== API_VERSION) { problems.push(problem(source, ['apiVersion'], `Supported pair: ${API_VERSION} ${kind}`)); continue; }
    const parsedName = nameSchema.safeParse(object(value.metadata).name);
    if (!parsedName.success) { problems.push(problem(source, ['metadata', 'name'], 'Name must be 1–63 ASCII letters, digits, dots, underscores or hyphens, with alphanumeric ends')); continue; }
    const document: Document = { source, kind, name: parsedName.data };
    documents.push(document);
    const namespace = object(value.metadata).namespace;
    if (namespace !== undefined && namespace !== 'default') problems.push(problem(source, ['metadata', 'namespace'], 'Namespaces are not supported; treated as default', 'warning'));
    const parsed = (kind === 'Line' ? lineSchema : layoutSchema).safeParse(value);
    if (!parsed.success) { problems.push(...schemaProblems(source, parsed.error.issues)); continue; }
    const secrets = scanSecrets(source);
    problems.push(...secrets);
    if (!secrets.some(found => found.severity === 'error')) document.served = parsed.data;
  }
  // Duplicate names first, as in the catalogue: a later document with a used name is not served.
  const first = new Map<string, Document>();
  const unique: Document[] = [];
  for (const document of documents) {
    const key = `${document.kind}:${document.name.toLowerCase()}`, earlier = first.get(key);
    if (earlier) problems.push(problem(document.source, ['metadata', 'name'], `Duplicate name; earlier document is in ${earlier.source.path}`));
    else { first.set(key, document); unique.push(document); }
  }
  crossCheck(unique, items, problems);
  const layouts = unique.filter(document => document.kind === 'MapLayout');
  return {
    lines: unique.filter(document => document.kind === 'Line' && document.served).map(document => document.served as Line),
    ...(layouts[0]?.served ? { layout: layouts[0].served as MapLayout } : {}),
  };
}

function crossCheck(unique: Document[], items: ItemKinds, problems: Problem[]): void {
  const add = (document: Document, path: FieldPath, message: string, severity: Problem['severity'] = 'error', key = false) => {
    problems.push(problem(document.source, path, message, severity, key));
  };
  /** The item a reference names, as `kind:name`, or undefined with an error at it. */
  function target(document: Document, value: string, path: FieldPath, key = false): string | undefined {
    const ref = splitReference(value);
    if (!ref) { add(document, path, 'Reference must be skill:<name>, playbook:<name> or agent:<name>', 'error', key); return; }
    const kinds = items.get(ref.name) ?? [];
    if (kinds.includes(ref.kind)) return `${ref.kind}:${ref.name}`;
    const other = kinds.find(kind => kind !== ref.kind);
    add(document, path, other ? `No ${ref.kind} named ${ref.name}; ${ref.name} is ${other === 'agent' ? 'an' : 'a'} ${other}` : `No ${ref.kind} named ${ref.name} in the set`, 'error', key);
    return undefined;
  }
  const lines = unique.filter(document => document.kind === 'Line');
  const layouts = unique.filter(document => document.kind === 'MapLayout');
  const layout = layouts[0];
  for (const later of layouts.slice(1)) add(later, [], `Only one MapLayout is allowed; earlier document is in ${layout!.source.path}`);
  const codes = new Map<string, Document>(), colors = new Map<string, Document>();
  const firstStops = new Map<string, { document: Document; path: FieldPath }>();
  for (const line of lines) {
    for (const [field, seen, severity] of [['code', codes, 'error'], ['color', colors, 'warning']] as const) {
      const value = spec(line)[field];
      if (typeof value !== 'string') continue;
      const previous = seen.get(value.toLowerCase());
      if (previous) add(line, ['spec', field], `Shared ${field}; earlier line ${previous.name} is in ${previous.source.path}`, severity);
      else seen.set(value.toLowerCase(), line);
    }
    const seenStops = new Set<string>();
    const lineStops = spec(line).stops;
    if (Array.isArray(lineStops)) lineStops.forEach((value, index) => {
      if (typeof value !== 'string') return;
      const path: FieldPath = ['spec', 'stops', index], ref = target(line, value, path);
      if (!ref) return;
      if (seenStops.has(ref)) add(line, path, 'Item is visited more than once');
      seenStops.add(ref);
      if (!firstStops.has(ref)) firstStops.set(ref, { document: line, path });
    });
  }
  const stations = new Map<string, { document: Document; path: FieldPath }>();
  if (layout) {
    const positions = new Map<string, string>();
    for (const [key, position] of Object.entries(object(spec(layout).stations))) {
      const path: FieldPath = ['spec', 'stations', key], ref = target(layout, key, path, true);
      if (!ref) continue;
      if (Array.isArray(position) && position.length === 2 && position.every(v => Number.isInteger(v) && v >= 0)) {
        const cell = position.join(',');
        const earlier = positions.get(cell);
        if (earlier) add(layout, path, `Position already used by ${earlier}`, 'error', true);
        else positions.set(cell, key);
        stations.set(ref, { document: layout, path });
      }
    }
    const zones = new Set<string>();
    if (Array.isArray(spec(layout).zones)) (spec(layout).zones as unknown[]).forEach((zone, index) => {
      const value = object(zone).name;
      if (typeof value !== 'string') return;
      const path: FieldPath = ['spec', 'zones', index, 'name'];
      if (zones.has(value)) { add(layout, path, 'Duplicate zone name'); return; }
      zones.add(value);
      if (!(items.get(value) ?? []).includes('playbook')) add(layout, path, `Zone must name a playbook of the set; ${value} is not one`);
    });
  }
  for (const [ref, stop] of firstStops) if (!stations.has(ref)) add(stop.document, stop.path, 'No position; the map will place this item', 'warning');
  for (const [ref, station] of stations) if (!firstStops.has(ref)) add(station.document, station.path, 'No line stops here; the map will not show this item', 'warning', true);
}

/** The members of a playbook zone (skill-source, Playbook zones), as `kind:name` references: the playbook,
 * then what its `stackledger-skills` and `stackledger-agents` name in the set, as written. Only direct
 * relations: a playbook that loads another would otherwise take that one's whole zone. Empty when the
 * name is no playbook of the set. */
export function zoneMembers(set: { skills: { name: string; kind: 'skill' | 'playbook'; skills: string[]; agents: string[] }[]; agents: { name: string }[] }, zone: string): string[] {
  const playbook = set.skills.find(item => item.kind === 'playbook' && item.name === zone);
  if (!playbook) return [];
  const members = [`playbook:${playbook.name}`];
  for (const name of playbook.skills) {
    const item = set.skills.find(candidate => candidate.name === name);
    if (item) members.push(`${item.kind}:${item.name}`);
  }
  for (const name of playbook.agents) if (set.agents.some(candidate => candidate.name === name)) members.push(`agent:${name}`);
  return [...new Set(members)];
}
