/** Relation queries over one view: items, dependencies, dependants, impact, gaps and renewals.
 * Pure functions over view entities, shared by the MCP server and the future site.
 * Only a component's spec.dependsOn creates a dependency; every list is sorted, so output is stable.
 */
import { compareText, compareRefs, isDate } from './identity.js';
export { compareRefs, isDate } from './identity.js';
import { reference } from './validate.js';
import type { Component, Licence, Line } from './schema.js';
import type { OtherResource } from './validate.js';
import type { View } from './views.js';
export type ItemKind = 'component' | 'licence' | 'resource' | 'line';
export type Item =
  | { key: string; ref: string; name: string; kind: 'component'; entity: Component }
  | { key: string; ref: string; name: string; kind: 'licence'; entity: Licence }
  | { key: string; ref: string; name: string; kind: 'resource'; entity: OtherResource }
  | { key: string; ref: string; name: string; kind: 'line'; entity: Line };
export interface Graph {
  view: View; items: Map<string, Item>;
  dependsOn: Map<string, string[]>; unresolved: Map<string, string[]>;
  dependants: Map<string, Set<string>>; linesAt: Map<string, Set<string>>; stops: Map<string, string[]>;
}
export const IMPACT_LIMIT = 500;
function sorted(values: Iterable<string>): string[] { return [...values].sort(compareRefs); }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; }
export function buildGraph(view: View): Graph {
  const graph: Graph = { view, items: new Map(), dependsOn: new Map(), unresolved: new Map(), dependants: new Map(), linesAt: new Map(), stops: new Map() };
  const add = (item: Item) => { graph.items.set(item.key, item); };
  for (const entity of view.components) { const name = entity.metadata.name; add({ key: `component:${name.toLowerCase()}`, ref: `component:${name}`, name, kind: 'component', entity }); }
  for (const entity of view.licences) { const name = entity.metadata.name; add({ key: `resource:${name.toLowerCase()}`, ref: `resource:${name}`, name, kind: 'licence', entity }); }
  for (const entity of view.resources) { const name = entity.ref.slice('resource:'.length); add({ key: `resource:${name.toLowerCase()}`, ref: entity.ref, name, kind: 'resource', entity }); }
  for (const entity of view.lines) { const name = entity.metadata.name; add({ key: `line:${name.toLowerCase()}`, ref: `line:${name}`, name, kind: 'line', entity }); }
  const target = (value: string, kinds: string[]): Item | undefined => {
    const ref = reference(value);
    return ref && ref.namespace === 'default' && kinds.includes(ref.kind) ? graph.items.get(ref.key) : undefined;
  };
  for (const component of view.components) {
    const key = `component:${component.metadata.name.toLowerCase()}`, resolved: string[] = [], unresolved: string[] = [];
    for (const value of strings(component.spec.dependsOn)) {
      const item = target(value, ['component', 'resource']);
      if (!item) { unresolved.push(value); continue; }
      if (resolved.includes(item.ref)) continue;
      resolved.push(item.ref);
      if (!graph.dependants.has(item.key)) graph.dependants.set(item.key, new Set());
      graph.dependants.get(item.key)!.add(key);
    }
    graph.dependsOn.set(key, resolved); graph.unresolved.set(key, unresolved);
  }
  for (const line of view.lines) {
    const ref = `line:${line.metadata.name}`;
    graph.stops.set(ref.toLowerCase(), strings(line.spec.stops).map(value => {
      const item = target(value, ['component']);
      if (!item) return value;
      if (!graph.linesAt.has(item.key)) graph.linesAt.set(item.key, new Set());
      graph.linesAt.get(item.key)!.add(ref);
      return item.ref;
    }));
  }
  return graph;
}
const refOf = (graph: Graph, key: string) => graph.items.get(key)!.ref;
export function dependantsOf(graph: Graph, item: Item): string[] { return sorted([...graph.dependants.get(item.key) ?? []].map(key => refOf(graph, key))); }
export function linesOf(graph: Graph, item: Item): string[] { return sorted(graph.linesAt.get(item.key) ?? []); }

/** Resolve a tool argument: component, resource or line, any case, optional default namespace. */
export function lookup(graph: Graph, value: string): Item | { error: string } {
  const ref = reference(value);
  if (!ref) return { error: `Not a reference: ${value}; use component:<name>, resource:<name> or line:<name>` };
  if (!['component', 'resource', 'line'].includes(ref.kind)) return { error: `Unsupported kind in ${value}; use component, resource or line` };
  if (ref.namespace !== 'default') return { error: `Unsupported namespace in ${value}; only default is supported` };
  return graph.items.get(ref.key) ?? { error: `No item matches ${value}` };
}
const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
function zoneOf(item: Item): string | undefined {
  return item.kind === 'component' || item.kind === 'licence' ? text(item.entity.metadata.labels?.['stackledger/zone']) : undefined;
}
export interface ItemSummary { ref: string; kind: ItemKind; title?: string; type?: string; lifecycle?: string; owner?: string; zone?: string }
export function summary(item: Item): ItemSummary {
  const result: ItemSummary = { ref: item.ref, kind: item.kind };
  const fields: Record<string, string | undefined> = item.kind === 'resource' ? { type: item.entity.type }
    : item.kind === 'line' ? { title: item.entity.metadata.title }
      : { title: item.entity.metadata.title, type: text(item.entity.spec.type), lifecycle: text(item.entity.spec.lifecycle), owner: text(item.entity.spec.owner), zone: zoneOf(item) };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) (result as unknown as Record<string, string>)[key] = value;
  return result;
}
function searchable(item: Item): string[] {
  if (item.kind === 'resource') return [item.name];
  if (item.kind === 'line') return [item.name, ...[item.entity.metadata.title].filter(v => v !== undefined)];
  const metadata = item.entity.metadata;
  const values = [item.name, text(metadata.title), text(metadata.description), ...strings(metadata.tags)];
  // Only what the view kept is searched: hidden licence fields are already absent here.
  if (item.kind === 'licence') values.push(...Object.values(item.entity.spec.licence ?? {}).map(text));
  return values.filter((v): v is string => v !== undefined);
}
export interface FindOptions { query?: string; kind?: ItemKind; zone?: string; limit: number }
export function findItems(graph: Graph, options: FindOptions): { items: ItemSummary[]; total: number; truncated: boolean } {
  const query = options.query?.toLowerCase(), zone = options.zone?.toLowerCase();
  const matches = [...graph.items.values()].filter(item => (!options.kind || item.kind === options.kind)
    && (zone === undefined || zoneOf(item)?.toLowerCase() === zone)
    && (query === undefined || searchable(item).some(value => value.toLowerCase().includes(query))))
    .sort((a, b) => compareRefs(a.ref, b.ref));
  return { items: matches.slice(0, options.limit).map(summary), total: matches.length, truncated: matches.length > options.limit };
}
/** One item with its relations; every list is present, empty when there is nothing. */
export function itemDetail(graph: Graph, item: Item): Record<string, unknown> {
  if (item.kind === 'resource') return { ref: item.ref, kind: item.kind, ...(item.entity.type === undefined ? {} : { type: item.entity.type }), dependants: dependantsOf(graph, item) };
  if (item.kind === 'line') return { ref: item.ref, kind: item.kind, metadata: item.entity.metadata, spec: item.entity.spec, stops: graph.stops.get(item.key) ?? [] };
  const base = { ref: item.ref, kind: item.kind, metadata: item.entity.metadata, spec: item.entity.spec };
  if (item.kind === 'licence') return { ...base, dependants: dependantsOf(graph, item), lines: linesOf(graph, item) };
  return { ...base, zone: zoneOf(item) ?? null, dependsOn: graph.dependsOn.get(item.key) ?? [], unresolved: graph.unresolved.get(item.key) ?? [],
    dependants: dependantsOf(graph, item), lines: linesOf(graph, item) };
}
/** Everything that depends on the item directly or transitively, each once at its smallest depth. */
export function impact(graph: Graph, item: Item, limit = IMPACT_LIMIT): { dependants: { ref: string; depth: number }[]; lines: string[]; truncated: boolean } {
  const depth = new Map<string, number>([[item.key, 0]]), queue = [item.key];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]!;
    for (const dependant of graph.dependants.get(key) ?? []) {
      if (!depth.has(dependant)) { depth.set(dependant, depth.get(key)! + 1); queue.push(dependant); }
    }
  }
  const lines = new Set<string>();
  for (const key of depth.keys()) for (const line of graph.linesAt.get(key) ?? []) lines.add(line);
  const dependants = queue.slice(1).map(key => ({ ref: refOf(graph, key), depth: depth.get(key)! }))
    .sort((a, b) => a.depth - b.depth || compareRefs(a.ref, b.ref));
  return { dependants: dependants.slice(0, limit), lines: sorted(lines), truncated: dependants.length > limit };
}
export function gaps(graph: Graph): { isolated: string[]; offMap: string[]; unusedLicences: string[] } {
  const items = [...graph.items.values()];
  const components = items.filter(item => item.kind === 'component');
  return {
    isolated: sorted(components.filter(item => !graph.dependsOn.get(item.key)?.length && !graph.dependants.get(item.key)?.size).map(item => item.ref)),
    offMap: sorted(components.filter(item => !graph.linesAt.get(item.key)?.size).map(item => item.ref)),
    unusedLicences: sorted(items.filter(item => item.kind === 'licence' && !graph.dependants.get(item.key)?.size).map(item => item.ref)),
  };
}
/** Calendar arithmetic in UTC on date strings, so the machine's time zone cannot shift a day. */
export function addDays(from: string, days: number): string {
  return new Date(new Date(`${from}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
export function localDate(now = new Date()): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export interface Renewal { ref: string; vendor: string; status: string; renewsOn: string; cycle: string; cost: number | 'unknown'; currency: string }
export function renewals(graph: Graph, from: string, days: number): { from: string; to: string; licences: Renewal[]; overdue: Renewal[]; unknown: string[] } {
  const to = addDays(from, days), licences: Renewal[] = [], overdue: Renewal[] = [], unknown: string[] = [];
  for (const item of graph.items.values()) {
    const details = item.kind === 'licence' ? item.entity.spec.licence : undefined;
    if (!details || !['active', 'to-confirm'].includes(details.status)) continue;
    if (details.renewsOn === 'unknown') { unknown.push(item.ref); continue; }
    if (!isDate(details.renewsOn) || details.renewsOn > to) continue;
    const entry: Renewal = { ref: item.ref, vendor: details.vendor, status: details.status, renewsOn: details.renewsOn, cycle: details.cycle, cost: details.cost, currency: details.currency };
    (details.renewsOn < from ? overdue : licences).push(entry);
  }
  const order = (a: Renewal, b: Renewal) => compareText(a.renewsOn, b.renewsOn) || compareRefs(a.ref, b.ref);
  return { from, to, licences: licences.sort(order), overdue: overdue.sort(order), unknown: sorted(unknown) };
}
