/** buildDrift(snapshot, components): compare a machine snapshot with catalogue components (design D6,
 * D9; drift-command spec). Pure: no I/O. Called by src/drift-command.ts, whose text and JSON forms
 * print the result, and by src/scaffold.ts through itemNeeds and the result's lists.
 *
 * Why only annotations: a component matches an item only when its `stackledger/<source>` annotation
 * lists the item's id (src/discovery/annotations.ts compares them: exact, `app` ignoring ASCII case,
 * `pipx` with PEP 503-style names). A name or title never matches, so drift never guesses.
 *
 * What it computes, in one pass over items plus identifiers (a map from source + normalised id):
 * - matched and shared items; not-declared items with the annotation they would need, except
 *   dependency-only formulae and macOS's own items, which are only counted; ids that no annotation can
 *   hold (comma, control character, white space at an end) are listed with a note instead;
 * - identifiers no item matches: missing for an `ok` source (incomplete when it ignored entries),
 *   not checked for a skipped or failed one;
 * - inferred needs between items (itemNeeds), lifted to components as proposed `dependsOn` relations
 *   that the component does not declare yet; and, for an app a matched cask installs, the cask's
 *   components as the ones that probably need its `stackledger/app` annotation.
 * Every list is sorted (items by source order, id, path; references with compareRefs), so the same
 * input always gives the same result.
 */
import { annotationSource, identifiers, normaliseId, SOURCES, type SourceName } from './discovery/annotations.js';
import { compareItems, type Machine, type Snapshot } from './discovery/snapshot.js';
import type { Item } from './discovery/types.js';
import { compareRefs, compareText, reference } from './identity.js';
import type { Component } from './schema.js';

/** An item as drift output names it (design D9): `path` is null for sources without one. */
export interface ItemRef { source: SourceName; id: string; path: string | null }
export interface NotDeclared extends ItemRef {
  versions: string[]; title: string | null; annotation: string | null; note: string | null; suggestedComponents: string[];
}
export interface Missing { component: string; source: SourceName; id: string; incomplete: boolean }
export interface NotChecked { component: string; source: SourceName; id: string; status: 'skipped' | 'failed' }
export interface MatchedItem extends ItemRef { components: string[] }
export interface ProposedRelation { from: string; to: string; reasons: { from: ItemRef; to: ItemRef }[] }
export interface DriftCounts {
  items: number; matched: number; notDeclared: number; dependencies: number; macos: number; missing: number;
  notChecked: number; shared: number; proposedRelations: number; componentsWithoutAnnotations: number;
}
export interface Drift {
  snapshot: { machine: Machine; takenAt: string }; counts: DriftCounts; notDeclared: NotDeclared[]; missing: Missing[];
  notChecked: NotChecked[]; shared: MatchedItem[]; matched: MatchedItem[]; proposedRelations: ProposedRelation[];
}

export const CANNOT_BE_ANNOTATED = 'cannot be annotated';
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
/** The Homebrew prefixes whose Cellar and opt folders tie a program to a formula (spec, Inferred needs). */
const BREW_PROGRAM = /^(?:\/opt\/homebrew|\/usr\/local)\/(?:Cellar|opt)\/([^/]+)\//;
const APPLE = 'com.apple.';

export const pathOf = (item: Item): string | null => ('path' in item ? item.path : null);
export const itemRef = (item: Item): ItemRef => ({ source: item.source, id: item.id, path: pathOf(item) });
/** The key of an item in maps: source, id and path identify one snapshot item. */
export const itemKey = (ref: ItemRef): string => JSON.stringify([ref.source, ref.id, ref.path]);
const matchKey = (source: SourceName, id: string): string => `${source}\0${normaliseId(source, id)}`;
const sortRefs = (refs: Iterable<string>): string[] => [...new Set(refs)].sort(compareRefs);

/** Whether an id can be written in an annotation: no comma, no control character, no white space at an end. */
export function annotatable(id: string): boolean {
  return !id.includes(',') && !CONTROL.test(id) && id.trim() === id;
}

/** Items that are only counted when nothing matches them: dependency-only formulae and macOS's own items. */
function countedOnly(item: Item): 'dependencies' | 'macos' | undefined {
  if (item.source === 'brew' && !item.onRequest) return 'dependencies';
  if (item.source === 'app' && item.id.startsWith(APPLE) && !item.appStore) return 'macos';
  if (item.source === 'launchd' && item.id.startsWith(APPLE)) return 'macos';
  return undefined;
}

/** The items each item needs (spec, Inferred needs), computed on the snapshot alone, in item order. */
export function itemNeeds(snapshot: Snapshot): Map<Item, Item[]> {
  const brewById = new Map<string, Item>(), brewByShortName = new Map<string, Item[]>(), appsByPath = new Map<string, Item[]>();
  for (const item of snapshot.items) {
    if (item.source === 'brew') {
      brewById.set(item.id, item);
      const short = item.id.slice(item.id.lastIndexOf('/') + 1);
      brewByShortName.set(short, [...(brewByShortName.get(short) ?? []), item]);
    }
    if (item.source === 'app') appsByPath.set(item.path, [...(appsByPath.get(item.path) ?? []), item]);
  }
  const needs = new Map<Item, Item[]>();
  for (const item of snapshot.items) {
    const needed = new Set<Item>();
    if (item.source === 'brew') for (const dependency of item.dependsOn) { const target = brewById.get(dependency); if (target) needed.add(target); }
    if (item.source === 'launchd' && item.program !== null) {
      const program = item.program;
      // Every folder of the program's path is a candidate app path; `<app path>/` must be a prefix,
      // so `Northwind Sync Helper.app` never matches `Northwind Sync.app`.
      for (let slash = program.indexOf('/', 1); slash !== -1; slash = program.indexOf('/', slash + 1)) {
        for (const target of appsByPath.get(program.slice(0, slash)) ?? []) needed.add(target);
      }
      const short = BREW_PROGRAM.exec(program)?.[1];
      const formulae = short === undefined ? [] : brewByShortName.get(short) ?? [];
      // Two formulae with the same short name (a core one and a tap one): the job needs neither.
      if (formulae.length === 1) needed.add(formulae[0]!);
    }
    needed.delete(item);
    if (needed.size) needs.set(item, [...needed].sort(compareItems));
  }
  return needs;
}

interface Claim { component: string; source: SourceName; id: string }

/** The discovery identifiers of each component, once per source and normalised id, as written (trimmed). */
function claimsOf(components: Component[]): { claims: Claim[]; byKey: Map<string, string[]>; unannotated: number } {
  const claims: Claim[] = [], byKey = new Map<string, string[]>();
  let unannotated = 0;
  for (const component of components) {
    const ref = `component:${component.metadata.name}`, seen = new Set<string>();
    let annotated = false;
    for (const [key, value] of Object.entries(component.metadata.annotations ?? {})) {
      const source = annotationSource(key);
      if (!source) continue;
      annotated = true;
      for (const id of identifiers(value).ids) {
        const match = matchKey(source, id);
        if (seen.has(match)) continue;
        seen.add(match);
        claims.push({ component: ref, source, id });
        byKey.set(match, [...(byKey.get(match) ?? []), ref]);
      }
    }
    if (!annotated) unannotated++;
  }
  return { claims, byKey, unannotated };
}

/** Whether a component's spec.dependsOn already references `target` (`component:<name>`), ignoring case. */
function declares(component: Component | undefined, target: string): boolean {
  const key = target.toLowerCase();
  return (component?.spec.dependsOn ?? []).some(value => { const ref = reference(value); return ref !== undefined && ref.namespace === 'default' && ref.key === key; });
}

const byComponentThenItem = (left: { component: string; source: SourceName; id: string }, right: { component: string; source: SourceName; id: string }) =>
  compareRefs(left.component, right.component) || SOURCES.indexOf(left.source) - SOURCES.indexOf(right.source) || compareText(left.id, right.id);

export function buildDrift(snapshot: Snapshot, components: Component[]): Drift {
  const { claims, byKey, unannotated } = claimsOf(components);
  const items = [...snapshot.items].sort(compareItems);
  const componentsOf = new Map<Item, string[]>(), installed = new Set<string>();
  for (const item of items) {
    if (!annotatable(item.id)) continue;
    installed.add(matchKey(item.source, item.id));
    const refs = byKey.get(matchKey(item.source, item.id));
    if (refs) componentsOf.set(item, sortRefs(refs));
  }

  const matched: MatchedItem[] = [], notDeclared: NotDeclared[] = [];
  const counted = { dependencies: 0, macos: 0 };
  // An app a matched cask installs: its folder name points at the cask's components.
  const casksByApp = new Map<string, string[]>();
  for (const [item, refs] of componentsOf) {
    matched.push({ ...itemRef(item), components: refs });
    if (item.source === 'cask') for (const name of item.apps) casksByApp.set(name, [...(casksByApp.get(name) ?? []), ...refs]);
  }
  matched.sort(compareItemRefs);
  for (const item of items) {
    if (componentsOf.has(item)) continue;
    const only = countedOnly(item);
    if (only) { counted[only]++; continue; }
    const canAnnotate = annotatable(item.id);
    const folder = item.source === 'app' ? item.path.slice(item.path.lastIndexOf('/') + 1) : undefined;
    notDeclared.push({ ...itemRef(item), versions: [...item.versions], title: 'title' in item ? item.title : null,
      annotation: canAnnotate ? `stackledger/${item.source}: ${item.id}` : null, note: canAnnotate ? null : CANNOT_BE_ANNOTATED,
      suggestedComponents: folder === undefined ? [] : sortRefs(casksByApp.get(folder) ?? []) });
  }

  const status = new Map(snapshot.sources.map(source => [source.source, source]));
  const missing: Missing[] = [], notChecked: NotChecked[] = [];
  for (const claim of claims) {
    const source = status.get(claim.source)!;
    if (source.status !== 'ok') notChecked.push({ ...claim, status: source.status });
    else if (!installed.has(matchKey(claim.source, claim.id))) missing.push({ ...claim, incomplete: source.ignored !== 0 });
  }
  missing.sort(byComponentThenItem);
  notChecked.sort(byComponentThenItem);

  const proposedRelations = proposeRelations(itemNeeds(snapshot), componentsOf, components);
  const shared = matched.filter(entry => entry.components.length > 1);
  return {
    snapshot: { machine: { ...snapshot.machine }, takenAt: snapshot.takenAt },
    counts: { items: snapshot.items.length, matched: matched.length, notDeclared: notDeclared.length, ...counted,
      missing: missing.length, notChecked: notChecked.length, shared: shared.length, proposedRelations: proposedRelations.length,
      componentsWithoutAnnotations: unannotated },
    notDeclared, missing, notChecked, shared, matched, proposedRelations,
  };
}

/** Item order for entries that name an item (source order, id, path with none first). */
function compareItemRefs(left: ItemRef, right: ItemRef): number {
  return SOURCES.indexOf(left.source) - SOURCES.indexOf(right.source) || compareText(left.id, right.id) || compareText(left.path ?? '', right.path ?? '');
}

/** `A dependsOn B` for each item of A that needs an item of B, when A and B differ and A does not declare it yet. */
function proposeRelations(needs: Map<Item, Item[]>, componentsOf: Map<Item, string[]>, components: Component[]): ProposedRelation[] {
  const byRef = new Map(components.map(component => [`component:${component.metadata.name}`.toLowerCase(), component]));
  const relations = new Map<string, ProposedRelation>();
  for (const [item, needed] of needs) {
    for (const from of componentsOf.get(item) ?? []) for (const target of needed) for (const to of componentsOf.get(target) ?? []) {
      if (from.toLowerCase() === to.toLowerCase() || declares(byRef.get(from.toLowerCase()), to)) continue;
      const key = JSON.stringify([from, to]);
      const relation = relations.get(key) ?? { from, to, reasons: [] };
      relation.reasons.push({ from: itemRef(item), to: itemRef(target) });
      relations.set(key, relation);
    }
  }
  const list = [...relations.values()];
  for (const relation of list) {
    relation.reasons.sort((left, right) => compareItemRefs(left.from, right.from) || compareItemRefs(left.to, right.to));
  }
  return list.sort((left, right) => compareRefs(left.from, right.from) || compareRefs(left.to, right.to));
}
