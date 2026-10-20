/** What validateLoaded serves to consumers: checked, scanned, first identities only. Run npm test. */
import { test, expect } from 'vitest';
import { component, licence, line, layout, check, set } from './helpers.js';
test('Served documents passed every document check and are not later duplicates', () => {
 const key = set(component('keyed'), 'metadata.description', '-----BEGIN OPENSSH PRIVATE KEY-----');
 const mail = set(component('mailed'), 'metadata.description', 'alex@example.com');
 const result = check(component('a'), component('A'), set(component('b'), 'spec.owner', undefined), key, mail, set(licence(), 'spec.licence.cost', -5), line(), layout());
 expect(result.served.components.map(c => c.metadata.name)).toEqual(['a', 'mailed']);
 expect(result.served.licences).toEqual([]); expect(result.served.lines).toHaveLength(1); expect(result.served.layouts).toHaveLength(1);
});
test('Cross-document errors other than duplicates do not stop serving', () => {
 const result = check(set(component('a'), 'spec.dependsOn', ['component:ghost']));
 expect(result.summary.errors).toBe(1); expect(result.served.components.map(c => c.metadata.name)).toEqual(['a']);
});
test('Non-licence resources are served as reference and safe type only', () => {
 const resource = (name: string, type: string) => ({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name, description: 'nightly backup' }, spec: { type, owner: 'group:data' } });
 const result = check(resource('orders-db', 'database'), resource('odd', 'has space'), resource('Licence-like', 'license'));
 expect(result.served.resources).toEqual([{ ref: 'resource:orders-db', type: 'database' }, { ref: 'resource:odd' }, { ref: 'resource:Licence-like', type: 'license' }]);
});
