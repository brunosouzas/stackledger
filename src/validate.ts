/** Validate document stages, then catalogue-wide relations. Used by the CLI and future site.
 * Invalid identity stops a document; cross-checks only use first identities, even if fields fail.
 * Run npm test for rule scenarios; validation only reads and never resolves remote references.
 */
import { z } from 'zod';
import { isMap, isScalar } from 'yaml';
import { name, schemas, type Entity } from './schema.js';
import { scanSecrets } from './secrets.js';
import { compareText, loadFolder, problem, type Source, type Problem, type FieldPath, type Loaded } from './source.js';
export interface Summary { files: number; documents: number; ignored: number; errors: number; warnings: number }
export interface Result { problems: Problem[]; summary: Summary }
export interface Catalogue extends Result { entities: Entity[] }
interface Identified { source: Source; kind: keyof typeof schemas; name: string }
const ignoredKinds = new Set(['System', 'API', 'Group', 'User', 'Domain', 'Location', 'Template']);
const pairs: Record<string, string> = { Component: 'backstage.io/v1alpha1', Resource: 'backstage.io/v1alpha1', Line: 'stackledger/v1alpha1', MapLayout: 'stackledger/v1alpha1' };
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function spec(entity: Identified): Record<string, unknown> { return object(entity.source.value.spec); }
function metadata(entity: Identified): Record<string, unknown> { return object(entity.source.value.metadata); }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; }
function identityKey(kind: string, entityName: string): string { return `${kind.toLowerCase()}:${entityName.toLowerCase()}`; }
interface Reference { kind: string; namespace: string; name: string; key: string }
function reference(value: string): Reference | undefined {
  const match = /^([A-Za-z][A-Za-z0-9]*):(?:([A-Za-z0-9._-]+)\/)?([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(value);
  if (!match) return;
  const kind = match[1]!.toLowerCase(), namespace = match[2]?.toLowerCase() ?? 'default', name = match[3]!.toLowerCase();
  return { kind, namespace, name, key: identityKey(kind, name) };
}
function schemaProblems(source: Source, issues: z.core.$ZodIssue[]): Problem[] {
  const seen = new Set<string>();
  return issues.flatMap(issue => {
    const path = issue.path.map(part => typeof part === 'number' ? part : String(part));
    // A type error and its refinements describe the same broken field, not separate problems.
    const signature = JSON.stringify(path);
    if (issue.code !== 'unrecognized_keys' && seen.has(signature)) return [];
    if (issue.code !== 'unrecognized_keys') seen.add(signature);
    if (issue.code === 'unrecognized_keys') return issue.keys.map(key => problem(source, [...path, key], 'Unlisted field', 'error', true));
    // Zod messages may include enum/input text; generate only known rule text or type names.
    let message = 'Invalid value';
    if (issue.code === 'invalid_type') message = `Expected ${issue.expected}`;
    else if (issue.code === 'invalid_value') message = `Allowed values: ${issue.values.map(String).join(', ')}`;
    else if (issue.code === 'too_small') message = `Must have minimum ${String(issue.minimum)}`;
    else if (issue.code === 'custom' || issue.code === 'invalid_format') message = issue.message;
    // A station's position is one field: point to that entry rather than an invalid tuple index.
    const stationPath = path[0] === 'spec' && path[1] === 'stations' ? path.slice(0, 3) : path;
    return [problem(source, stationPath, message)];
  });
}
export function sortProblems(problems: Problem[]): Problem[] {
  return problems.sort((a, b) => compareText(a.path, b.path) || a.line - b.line || a.column - b.column
    || compareText(a.field ?? '', b.field ?? '') || (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || compareText(a.message, b.message));
}
export function validateLoaded(loaded: Loaded): Catalogue {
  const problems = [...loaded.problems];
  const identities: Identified[] = [];
  const entities: Entity[] = [];
  let ignored = 0;
  for (const source of loaded.sources) {
    const value = source.value;
    const kind = value.kind;
    if (typeof kind !== 'string' || !kind) { problems.push(problem(source, ['kind'], 'kind is required')); continue; }
    if (ignoredKinds.has(kind)) { ignored++; continue; }
    if (!Object.hasOwn(pairs, kind) || value.apiVersion !== pairs[kind]) {
      problems.push(problem(source, [Object.hasOwn(pairs, kind) ? 'apiVersion' : 'kind'],
        Object.hasOwn(pairs, kind) ? `Supported pair: ${pairs[kind]} ${kind}` : 'Supported kinds: Component, Resource, Line, MapLayout')); continue;
    }
    const entityName = object(value.metadata).name;
    const parsedName = name.safeParse(entityName);
    if (!parsedName.success) { problems.push(problem(source, ['metadata', 'name'], 'Name must be 1–63 ASCII letters, digits, dots, underscores or hyphens, with alphanumeric ends')); continue; }
    const entity: Identified = { source, kind: kind as Identified['kind'], name: parsedName.data };
    identities.push(entity);
    const namespace = metadata(entity).namespace;
    if (namespace !== undefined && namespace !== 'default') problems.push(problem(source, ['metadata', 'namespace'], 'Namespaces are not supported; treated as default', 'warning'));
    if (kind === 'Resource') {
      const type = spec(entity).type;
      if (typeof type !== 'string' || !type) { problems.push(problem(source, ['spec', 'type'], 'spec.type is required')); continue; }
      if (type !== 'licence') {
        ignored++;
        if (/^(licence|license)$/i.test(type)) problems.push(problem(source, ['spec', 'type'], 'Not read as a licence; use exactly licence', 'warning'));
        continue;
      }
    }
    const parsed = schemas[entity.kind].safeParse(value);
    const fieldProblems = parsed.success ? [] : schemaProblems(source, parsed.error.issues);
    if (kind === 'Component' || kind === 'Resource') {
      // JavaScript coerces mapping keys to strings; retain YAML's original key types for this rule.
      for (const field of ['labels', 'annotations']) {
        const mapping = source.document.getIn(['metadata', field], true);
        if (isMap(mapping)) for (const pair of mapping.items) {
          if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
            fieldProblems.push(problem(source, ['metadata', field, String(pair.key)], 'Mapping keys must be strings', 'error', true));
          }
        }
      }
    }
    if (fieldProblems.length || !parsed.success) { problems.push(...fieldProblems); continue; }
    entities.push(parsed.data);
    problems.push(...scanSecrets(source));
  }
  // Duplicate identity has precedence over every cross-document use, regardless of field validity.
  const first = new Map<string, Identified>();
  const unique: Identified[] = [];
  for (const entity of identities) {
    const key = identityKey(entity.kind, entity.name), earlier = first.get(key);
    if (earlier) problems.push(problem(entity.source, ['metadata', 'name'], `Duplicate name; earlier document is in ${earlier.source.path}`));
    else { first.set(key, entity); unique.push(entity); }
  }
  crossCheck(unique, first, problems);
  sortProblems(problems);
  // Valid non-mapping documents also count, although they have no Source to check.
  const documents = loaded.sources.length - ignored + loaded.problems.filter(p => p.message === 'Document must be a mapping' || p.message === 'Document cannot be expanded safely').length;
  return { entities, problems, summary: { files: loaded.files, documents, ignored,
    errors: problems.filter(p => p.severity === 'error').length, warnings: problems.filter(p => p.severity === 'warning').length } };
}
function crossCheck(unique: Identified[], first: Map<string, Identified>, problems: Problem[]): void {
  function add(entity: Identified, path: FieldPath, message: string, severity: Problem['severity'] = 'error', key = false) {
    problems.push(problem(entity.source, path, message, severity, key));
  }
  function target(entity: Identified, value: string, path: FieldPath, dependency = false, key = false): Reference | undefined {
    const ref = reference(value);
    if (!ref) { add(entity, path, 'Reference needs a kind: use kind:name or kind:default/name', 'error', key); return; }
    if (dependency && (ref.namespace !== 'default' || !['component', 'resource'].includes(ref.kind))) {
      add(entity, path, 'Reference is not checked (unsupported kind or namespace)', 'warning', key); return;
    }
    if (ref.namespace !== 'default') { add(entity, path, 'Reference namespace must be default', 'error', key); return; }
    if (!dependency && ref.kind !== 'component') { add(entity, path, 'Stops and stations must be components', 'error', key); return; }
    if (!first.has(ref.key)) { add(entity, path, 'Reference target does not exist', 'error', key); return; }
    return ref;
  }
  const components = unique.filter(e => e.kind === 'Component');
  const lines = unique.filter(e => e.kind === 'Line');
  const layouts = unique.filter(e => e.kind === 'MapLayout');
  const layout = layouts[0];
  for (const later of layouts.slice(1)) add(later, [], `Only one MapLayout is allowed; earlier document is in ${layout!.source.path}`);
  for (const component of components) {
    const dependencies = spec(component).dependsOn;
    if (Array.isArray(dependencies)) dependencies.forEach((value, index) => { if (typeof value === 'string') target(component, value, ['spec', 'dependsOn', index], true); });
  }
  const codes = new Map<string, Identified>(), colors = new Map<string, Identified>();
  const stops = new Map<string, { entity: Identified; path: FieldPath }>();
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
      if (seenStops.has(ref.key)) add(line, path, 'Component is visited more than once');
      seenStops.add(ref.key);
      if (!stops.has(ref.key)) stops.set(ref.key, { entity: line, path });
    });
  }
  const stations = new Map<string, { entity: Identified; path: FieldPath }>();
  const zones = new Set<string>();
  if (layout) {
    const positions = new Map<string, string>();
    for (const [key, position] of Object.entries(object(spec(layout).stations))) {
      const path: FieldPath = ['spec', 'stations', key], ref = target(layout, key, path, false, true);
      if (!ref) continue;
      if (Array.isArray(position) && position.length === 2 && position.every(v => Number.isInteger(v) && v >= 0)) {
        const cell = position.join(',');
        const earlier = positions.get(cell);
        if (earlier) add(layout, path, `Position already used by ${earlier}`, 'error', true);
        else positions.set(cell, key);
        stations.set(ref.key, { entity: layout, path });
      }
    }
    if (Array.isArray(spec(layout).zones)) (spec(layout).zones as unknown[]).forEach((zone, index) => {
      const value = object(zone).name;
      if (typeof value !== 'string') return;
      if (zones.has(value.toLowerCase())) add(layout, ['spec', 'zones', index, 'name'], 'Duplicate zone name');
      else zones.add(value.toLowerCase());
    });
  }
  for (const [key, stop] of stops) if (!stations.has(key)) add(stop.entity, stop.path, 'No position; the map will place this component', 'warning');
  for (const [key, station] of stations) if (!stops.has(key)) add(station.entity, station.path, 'No line stops here; the map will not show this component', 'warning', true);
  for (const component of components) {
    const zone = object(metadata(component).labels)['stackledger/zone'];
    if (typeof zone === 'string' && !zones.has(zone.toLowerCase())) add(component, ['metadata', 'labels', 'stackledger/zone'], 'Zone is not declared in the layout');
  }
}
export async function validateFolder(folder: string): Promise<Catalogue> { return validateLoaded(await loadFolder(folder)); }

/** In-memory entry point preserves exactly the same ordering and parser behavior as disk input. */
export function validateSources(sources: Source[], problems: Problem[] = [], files = new Set(sources.map(s => s.path)).size): Catalogue {
  return validateLoaded({ sources: [...sources].sort((a, b) => compareText(a.path, b.path)), problems, files });
}
