/** In-memory synthetic catalogue builders for rule tests. Run npm test; no real inventory. */
import { stringify } from 'yaml';
import { parseSource } from '../../src/source.js';
import { validateSources } from '../../src/validate.js';
export function component(name = 'a') { return { apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name }, spec: { type: 'tool', lifecycle: 'active', owner: 'user:alex' } }; }
export function licence(name = 'licence-chat') { return { apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name }, spec: { type: 'licence', owner: 'user:alex', licence: { vendor: 'Northwind Studio', status: 'active', cycle: 'monthly', cost: 10, currency: 'GBP', renewsOn: '2027-02-28' } } }; }
export function line(name = 'ship') { return { apiVersion: 'stackledger/v1alpha1', kind: 'Line', metadata: { name }, spec: { color: '#FF0000', stops: ['component:a', 'component:b'] } }; }
export function layout(name = 'map') { return { apiVersion: 'stackledger/v1alpha1', kind: 'MapLayout', metadata: { name }, spec: { stations: { 'component:a': [0, 0], 'component:b': [1, 0] } } }; }
export function settings(name = 'settings', spec: unknown = {}) { return { apiVersion: 'stackledger/v1alpha1', kind: 'Settings', metadata: { name }, spec }; }
/** Validate documents saved under the given file names, for rules that name files. */
export function checkFiles(files: Record<string, unknown[]>) {
 const parsed = Object.entries(files).map(([path, docs]) => parseSource(path, docs.map(doc => typeof doc === 'string' ? doc : stringify(doc)).join('---\n')));
 return validateSources(parsed.flatMap(p => p.sources), parsed.flatMap(p => p.problems), parsed.length);
}
export function check(...documents: unknown[]) {
 const parsed = documents.map((doc, i) => parseSource(`${String(i).padStart(3, '0')}.yaml`, stringify(doc)));
 return validateSources(parsed.flatMap(p => p.sources), parsed.flatMap(p => p.problems));
}
export function errors(...documents: unknown[]) { return check(...documents).problems.filter(p => p.severity === 'error'); }
export function set(document: unknown, path: string, value: unknown): unknown {
 const result = structuredClone(document) as Record<string, any>;
 const parts = path.split('.'); let current = result;
 for (const part of parts.slice(0, -1)) { current[part] ??= {}; current = current[part]; }
 if (value === undefined) delete current[parts.at(-1)!]; else current[parts.at(-1)!] = value;
 return result;
}
