/** Draft catalogue files for the items `stackledger drift` lists as not declared (design D10,
 * drift-command spec, Scaffold content, grouping, relations and names). Pure: src/drift-command.ts
 * writes the files (`--scaffold <dir>`).
 *
 * Why: a person or their agent reviews these drafts and copies them into the catalogue instead of
 * writing each file by hand; journeys, licences, prices and the real owner stay manual (`owner: unknown`).
 *
 * - buildScaffold(drift, snapshot, catalogueNames): from the not-declared list, leaving out entries
 *   with suggested components or without annotation, one file per source and identifier (as matching
 *   compares them); an undeclared app a listed cask installs joins the file of the first such cask.
 *   Names come from the title (else the id after its last `/`) folded as the machine name is, with
 *   `-2`, `-3` suffixes against every catalogue Component name and earlier file, ignoring case.
 *   `spec.dependsOn` names the catalogue components and other files that match what the file's items
 *   need (src/drift.ts itemNeeds). Only identifiers and titles are copied: never a path, program,
 *   version or machine name. YAML comes from the `yaml` package, so any title stays one scalar.
 * - checkScaffold(files): each file checked as a one-file catalogue with the rules of `stackledger
 *   validate` (secret guard and the 1 MiB limit included); files with errors are left out, and the
 *   other files stop naming them in `dependsOn`.
 */
import { stringify } from 'yaml';
import { normaliseId, SOURCES } from './discovery/annotations.js';
import { fold } from './discovery/machine.js';
import type { Snapshot } from './discovery/snapshot.js';
import type { Item } from './discovery/types.js';
import { itemKey, itemNeeds, itemRef, type Drift, type NotDeclared } from './drift.js';
import { compareRefs } from './identity.js';
import { MAX_FILE_BYTES, parseSource } from './source.js';
import { validateSources } from './validate.js';

const MAX_NAME_LENGTH = 63;
const EMPTY_NAME = 'item';
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

interface ScaffoldDocument {
  apiVersion: 'backstage.io/v1alpha1'; kind: 'Component';
  metadata: { name: string; title: string; annotations: Record<string, string> };
  spec: { type: 'tool' | 'service'; lifecycle: 'active'; owner: 'unknown'; dependsOn?: string[] };
}
export interface ScaffoldFile { name: string; file: string; header: string; document: ScaffoldDocument; text: string }

const render = (header: string, document: ScaffoldDocument): string => `${header}${stringify(document, { lineWidth: 0 })}`;
const folderName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** A name not used yet (ignoring case), with `-2`, `-3`… and the base cut to keep 63 characters. */
function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = `-${n}`;
    name = `${base.slice(0, MAX_NAME_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
  }
  taken.add(name.toLowerCase());
  return name;
}

export function buildScaffold(drift: Drift, snapshot: Snapshot, catalogueNames: readonly string[]): ScaffoldFile[] {
  const items = new Map(snapshot.items.map(item => [itemKey(itemRef(item)), item]));
  const itemOf = (entry: NotDeclared): Item => items.get(itemKey(entry))!;

  // One group per source and identifier, in not-declared order.
  const groups: NotDeclared[][] = [], bySourceAndId = new Map<string, NotDeclared[]>();
  for (const entry of drift.notDeclared) {
    if (entry.annotation === null || entry.suggestedComponents.length) continue;
    const key = `${entry.source}\0${normaliseId(entry.source, entry.id)}`;
    const group = bySourceAndId.get(key);
    if (group) group.push(entry);
    else { const created = [entry]; bySourceAndId.set(key, created); groups.push(created); }
  }
  // An app joins the file of the first cask that installs one of its folders.
  const casks = groups.filter(group => group[0]!.source === 'cask');
  const files = groups.filter(group => {
    if (group[0]!.source !== 'app') return true;
    const folders = new Set(group.map(entry => folderName(entry.path!)));
    const cask = casks.find(candidate => { const item = itemOf(candidate[0]!); return item.source === 'cask' && item.apps.some(name => folders.has(name)); });
    if (cask) cask.push(...group);
    return !cask;
  });

  const taken = new Set(catalogueNames.map(name => name.toLowerCase()));
  const named = files.map(entries => {
    const title = entries.map(entry => entry.title?.replace(CONTROL, '') ?? '').find(text => text !== '');
    const id = entries[0]!.id;
    const name = uniqueName(fold(title ?? id.slice(id.lastIndexOf('/') + 1)) || EMPTY_NAME, taken);
    return { entries, name, title: title ?? id };
  });

  const fileOf = new Map<string, string>();
  for (const file of named) for (const entry of file.entries) fileOf.set(itemKey(entry), file.name);
  const matched = new Map(drift.matched.map(entry => [itemKey(entry), entry.components]));
  const needs = itemNeeds(snapshot);
  const header = `# Draft written by stackledger drift --scaffold from a snapshot taken ${drift.snapshot.takenAt}.\n`
    + '# Review the owner, lifecycle, description and journeys, then move it into the catalogue.\n';

  return named.map(({ entries, name, title }) => {
    const dependsOn = new Set<string>();
    for (const entry of entries) for (const needed of needs.get(itemOf(entry)) ?? []) {
      const key = itemKey(itemRef(needed));
      for (const ref of matched.get(key) ?? []) dependsOn.add(ref);
      const other = fileOf.get(key);
      if (other !== undefined && other !== name) dependsOn.add(`component:${other}`);
    }
    const annotations: Record<string, string> = {};
    for (const source of SOURCES) {
      const ids = new Map<string, string>();
      for (const entry of entries) if (entry.source === source && !ids.has(normaliseId(source, entry.id))) ids.set(normaliseId(source, entry.id), entry.id);
      if (ids.size) annotations[`stackledger/${source}`] = [...ids.values()].join(', ');
    }
    const document: ScaffoldDocument = { apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name, title, annotations },
      spec: { type: entries[0]!.source === 'launchd' ? 'service' : 'tool', lifecycle: 'active', owner: 'unknown',
        ...(dependsOn.size ? { dependsOn: [...dependsOn].sort(compareRefs) } : {}) } };
    return { name, file: `${name}.yaml`, header, document, text: render(header, document) };
  });
}

/** Whether the file alone, with a stand-in for each component it depends on, has no validate error. */
function passes(file: ScaffoldFile): boolean {
  if (Buffer.byteLength(file.text) > MAX_FILE_BYTES) return false;
  const parsed = parseSource(file.file, file.text);
  // The targets of dependsOn exist by construction (catalogue components or other files); stand-ins
  // keep "Reference target does not exist" from rejecting every file with a relation.
  const standIns = (file.document.spec.dependsOn ?? []).map((ref, index) => parseSource(`\0stand-in-${index}.yaml`,
    stringify({ apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: ref.slice('component:'.length) }, spec: { type: 'tool', lifecycle: 'active', owner: 'unknown' } })));
  const catalogue = validateSources([...parsed.sources, ...standIns.flatMap(standIn => standIn.sources)], parsed.problems, 1 + standIns.length, parsed.settingsUnread);
  return parsed.sources.length === 1 && !catalogue.problems.some(problem => problem.severity === 'error' && problem.path === file.file);
}

export function checkScaffold(files: ScaffoldFile[]): { files: ScaffoldFile[]; leftOut: number } {
  let kept = files, leftOut = 0;
  for (;;) {
    const failing = new Set(kept.filter(file => !passes(file)).map(file => `component:${file.name}`));
    if (!failing.size) return { files: kept, leftOut };
    leftOut += failing.size;
    kept = kept.filter(file => !failing.has(`component:${file.name}`)).map(file => {
      const dependsOn = file.document.spec.dependsOn?.filter(ref => !failing.has(ref));
      if (dependsOn?.length === file.document.spec.dependsOn?.length) return file;
      const { dependsOn: _removed, ...spec } = file.document.spec;
      const document = { ...file.document, spec: dependsOn?.length ? { ...spec, dependsOn } : spec };
      return { ...file, document, text: render(file.header, document) };
    });
  }
}
