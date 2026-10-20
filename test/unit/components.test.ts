/** Component shape and dependency scenarios. Run npm test. */
import { test, expect } from 'vitest';
import { component, check, errors, set } from './helpers.js';
test('Backstage fields on a component', () => {
 let value: unknown = component(); for (const [path, field] of Object.entries({ 'metadata.links': [{ url: 'https://example.com' }], 'metadata.namespace': 'default', 'spec.system': 'payments', 'spec.providesApis': ['checkout'] })) value = set(value, path, field);
 expect(check(value).problems).toEqual([]);
});
test('Component without owner', () => { expect(errors(set(component(), 'spec.owner', undefined))).toMatchObject([{ field: 'spec.owner' }]); });
test('Minimal valid component', () => { expect(check(component()).problems).toEqual([]); });
test('Labels that are a number', () => { expect(errors(set(component(), 'metadata.labels', 42))).toMatchObject([{ field: 'metadata.labels' }]); });
test('Reference without kind', () => { const result = errors(set(component(), 'spec.dependsOn', ['caddy'])); expect(result).toMatchObject([{ field: 'spec.dependsOn[0]' }]); expect(result[0].message).toContain('needs a kind'); });
test('Case and default namespace', () => { expect(check(set(component(), 'spec.dependsOn', ['Component:default/Caddy']), component('caddy')).problems).toEqual([]); });
test('Dependency in another namespace', () => { expect(check(set(component(), 'spec.dependsOn', ['component:payments/caddy'])).problems).toMatchObject([{ severity: 'warning', field: 'spec.dependsOn[0]' }]); });
test('Dangling dependency', () => { expect(errors(set(component(), 'spec.dependsOn', ['component:caddy']))).toMatchObject([{ field: 'spec.dependsOn[0]' }]); });
test('Dependency on a database', () => { expect(check(set(component(), 'spec.dependsOn', ['resource:orders-db']), { apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'orders-db' }, spec: { type: 'database' } }).problems).toEqual([]); });
test('Reference to an unchecked kind', () => { const result = check(set(component(), 'spec.dependsOn', ['system:payments'])); expect(result.summary.errors).toBe(0); expect(result.problems).toMatchObject([{ severity: 'warning', field: 'spec.dependsOn[0]' }]); });
