/** Settings kind scenarios of the catalogue spec: schema, hide list and one settings document. Run npm test. */
import { test, expect } from 'vitest';
import { component, settings, check, checkFiles, errors, set } from './helpers.js';
const hiding = (hide: unknown, name = 'settings') => settings(name, { views: { staff: { hide } } });
test('Settings is a supported kind', () => { expect(check(settings()).problems).toEqual([]); });
test('Unsupported pair', () => { const result = errors(set(settings(), 'apiVersion', 'backstage.io/v1alpha1')); expect(result).toMatchObject([{ field: 'apiVersion' }]); expect(result[0].message).toContain('stackledger/v1alpha1 Settings'); });
test('Kind in the wrong case', () => { const result = errors(set(component(), 'kind', 'component')); expect(result).toHaveLength(1); for (const kind of ['Component', 'Resource', 'Line', 'MapLayout', 'Settings']) expect(result[0].message).toContain(kind); });
test('Typo in settings', () => { expect(errors(settings('settings', { view: { staff: { hide: ['vendor'] } } }))).toMatchObject([{ field: 'spec.view', message: 'Unlisted field' }]); });
test('Settings needs a spec and accepts only its metadata', () => {
 expect(errors(set(settings(), 'spec', undefined))).toMatchObject([{ field: 'spec' }]);
 expect(check(set(set(settings(), 'metadata.title', 'Northwind Studio'), 'metadata.namespace', 'default')).problems).toEqual([]);
 expect(errors(set(settings(), 'metadata.labels', { a: 'b' }))).toMatchObject([{ field: 'metadata.labels' }]);
});
test('Staff hide list', () => { expect(check(hiding(['cost', 'renewsOn'])).problems).toEqual([]); });
test('Unknown field name in the hide list', () => {
 const result = errors(hiding(['price'])); expect(result).toMatchObject([{ field: 'spec.views.staff.hide[0]' }]);
 for (const field of ['vendor', 'status', 'cycle', 'cost', 'currency', 'renewsOn', 'seats', 'paidBy', 'vaultItem', 'note']) expect(result[0].message).toContain(field);
});
test('Repeated field name', () => { expect(errors(hiding(['cost', 'cost']))).toMatchObject([{ field: 'spec.views.staff.hide[1]' }]); expect(errors(hiding(['cost', 'cost']))).toHaveLength(1); });
test('Second settings document', () => {
 const result = checkFiles({ 'a.yaml': [settings('settings')], 'b.yaml': [hiding(['vendor'], 'company')] });
 expect(result.problems).toHaveLength(1); expect(result.problems[0]).toMatchObject({ path: 'b.yaml', severity: 'error' }); expect(result.problems[0]!.message).toContain('a.yaml');
 expect(result.served.settings.map(s => s.metadata.name)[0]).toBe('settings');
});
test('Two settings with the same name', () => {
 const result = checkFiles({ 'a.yaml': [settings('settings')], 'b.yaml': [settings('settings')] });
 expect(result.problems).toHaveLength(1); expect(result.problems[0]).toMatchObject({ path: 'b.yaml', field: 'metadata.name' }); expect(result.problems[0]!.message).toContain('Duplicate name');
});
