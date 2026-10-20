/** Exact output paths, positions, counts and deterministic JSON. Run after npm run build. */
import { test, expect } from 'vitest';
import { run, demo } from './helpers.js';
import { folder, component } from '../helpers.js';
import { MAX_FILE_BYTES } from '../../src/source.js';
import { stringify } from 'yaml';
import { line, licence } from '../unit/helpers.js';
test('Error line', () => { const result = run(['validate', folder({ 'apps/slack.yaml': component().replace('  owner: user:alex\n', '') })]); expect(result.stdout).toMatch(/^apps\/slack.yaml:1:1 error spec.owner /); });
test('Clean catalogue', () => { const result = run(['validate', demo]); expect(result.stdout.split('\n')).toHaveLength(2); expect(result.stdout).toMatch(/^files: 1, documents: 5, ignored: 0, errors: 0, warnings: 0\n$/); });
test('Annotation key with a slash', () => { const result = run(['validate', folder({ 'a.yaml': component().replace('  name: a', '  name: a\n  annotations:\n    deploy/Token: abc') })]); expect(result.stdout).toMatch(/^a.yaml:6:5 error metadata.annotations\["deploy\/Token"\] /); expect(result.stdout).not.toContain('abc'); });
test('Key with a quote', () => { const value = line(); value.spec['a"b'] = true; const result = run(['validate', folder({ 'a.yaml': stringify(value), 'b.yaml': component('a') + '---\n' + component('b') })]); expect(result.stdout).toContain('error spec["a\\"b"] Unlisted field'); });
test('Problem about a file', () => { const result = run(['validate', folder({ 'big.yaml': 'x'.repeat(MAX_FILE_BYTES + 1) })]); expect(result.stdout).toMatch(/^big.yaml:1:1 error - File exceeds 1 MiB\n/); });
test('Error on a nested field', () => {
 const text = 'apiVersion: backstage.io/v1alpha1\nkind: Resource\nmetadata: {name: chat}\nspec:\n  type: licence\n  owner: user:alex\n  licence:\n    vendor: Northwind Studio\n    status: active\n    cycle: monthly\n    currency: GBP\n    cost: -5\n    renewsOn: unknown\n';
 const result = run(['validate', folder({ 'licence.yaml': text })]); expect(result.stdout).toMatch(/^licence.yaml:12:11 error spec.licence.cost /);
});
test('Error on a station key', () => { const text = 'apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: map\nspec:\n  stations:\n    component:ghost: [0, 0]\n'; const result = run(['validate', folder({ 'map.yaml': text })]); expect(result.stdout).toMatch(/^map.yaml:7:5 error spec.stations\["component:ghost"\] /); });
test('Mixed folder', () => { const result = run(['validate', folder({ 'a.yaml': component(), 'b.yaml': 'kind: System\n---\n# empty\n', 'c.yaml': 'x'.repeat(MAX_FILE_BYTES + 1) })]); expect(result.stdout).toContain('files: 3, documents: 1, ignored: 1, errors: 1, warnings: 0'); });
test('JSON for a pipeline', () => { const result = run(['validate', '--json', folder({ 'a.yaml': component().replace('  owner: user:alex\n', '') })]); expect(result.status).toBe(1); const value = JSON.parse(result.stdout); expect(Object.keys(value)).toEqual(['problems', 'summary']); expect(value.summary.errors).toBe(1); expect(value.problems).toEqual([{ path: 'a.yaml', line: 1, column: 1, field: 'spec.owner', severity: 'error', message: 'Expected string' }]); expect(result.stderr).toBe(''); });
test('Two runs', () => {
 const root = folder({ 'a.yaml': component().replace('  owner: user:alex\n', '').replace('  name: a', '  name: a\n  namespace: team'), 'B.yaml': 'kind: nope\n', 'c.yaml': component('c').replace('  name: c', '  name: c\n  namespace: other\n  description: alex@example.com') });
 const first = run(['validate', '--json', root]); const second = run(['validate', '--json', root]); expect(first).toEqual(second);
 const { problems } = JSON.parse(first.stdout); expect(problems).toHaveLength(5);
 // Independent comparator: code-point arrays, then numeric positions and contract tie-breakers.
 const cmp = (a: string, b: string) => { const left = [...a].map(c => c.codePointAt(0)!); const right = [...b].map(c => c.codePointAt(0)!); for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i]; return left.length - right.length; };
 const expected = [...problems].sort((a, b) => cmp(a.path, b.path) || a.line - b.line || a.column - b.column || cmp(a.field ?? '', b.field ?? '') || cmp(a.severity, b.severity) || cmp(a.message, b.message));
 expect(problems).toEqual(expected); expect(problems.map(p => p.path)).toEqual(['B.yaml', 'a.yaml', 'a.yaml', 'c.yaml', 'c.yaml']);
 expect(run(['validate', root])).toEqual(run(['validate', root]));
});
