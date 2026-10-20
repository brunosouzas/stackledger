/** Full and staff views: allow-lists, hidden lists and fail-closed settings. Run npm test. */
import { test, expect } from 'vitest';
import { applyView, resolveHidden, type ViewName } from '../../src/views.js';
import { buildGraph, findItems, itemDetail, impact, gaps, lookup, type Item } from '../../src/graph.js';
import { component, licence, settings, check, checkFiles, set } from './helpers.js';
type Checked = ReturnType<typeof check>;
const view = (result: Checked, name: ViewName = 'staff') => applyView(result.served, name, resolveHidden(result));
const details = (result: Checked, name: ViewName = 'staff') => view(result, name).licences[0]!.spec.licence ?? {};
const hiding = (hide: unknown, name = 'settings') => settings(name, { views: { staff: { hide } } });
const allFields = ['vendor', 'status', 'cycle', 'cost', 'currency', 'renewsOn', 'seats', 'paidBy', 'vaultItem', 'note'];
const full = () => set(set(set(set(set(licence(), 'spec.licence.seats', 3), 'spec.licence.paidBy', 'company'), 'spec.licence.vaultItem', 'Northwind item'), 'spec.licence.note', 'renegotiate in March'), 'spec.licence.cost', 120);
test('Full view keeps the cost', () => { expect(details(check(full()), 'full').cost).toBe(120); });
test('Staff view keeps the vendor', () => { expect(details(check(full())).vendor).toBe('Northwind Studio'); });
test('Cost in the wrong place', () => { const result = view(check(set(full(), 'spec.cost', 98765))); expect(result.licences[0]!.spec).not.toHaveProperty('cost'); expect(JSON.stringify(result)).not.toContain('98765'); });
test('Dependencies on a licence', () => { const result = check(set(full(), 'spec.dependsOn', ['98765 GBP'])); expect(view(result).licences[0]!.spec).not.toHaveProperty('dependsOn'); expect(view(result, 'full').licences[0]!.spec).toHaveProperty('dependsOn'); });
test('Licence block on a component', () => { const result = view(check(set(component(), 'spec.licence', { cost: 98765 }))); expect(result.components[0]!.spec).not.toHaveProperty('licence'); expect(result.components[0]!.spec).toEqual({ type: 'tool', lifecycle: 'active', owner: 'user:alex' }); });
test('Staff component and licence keep only listed fields', () => {
 const odd = set(set(set(component(), 'metadata.links', [{ url: 'https://example.com' }]), 'spec.system', 'payments'), 'extra', 1);
 const result = view(check(odd, set(set(full(), 'spec.lifecycle', 'production'), 'metadata.title', 'Chat')));
 expect(result.components[0]).toEqual({ apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'a' }, spec: { type: 'tool', lifecycle: 'active', owner: 'user:alex' } });
 expect(result.licences[0]).toEqual({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'licence-chat', title: 'Chat' }, spec: { type: 'licence', owner: 'user:alex', licence: { vendor: 'Northwind Studio', status: 'active' } } });
});
test('Default list', () => { const fields = details(check(full())); for (const field of ['cost', 'currency', 'cycle', 'renewsOn', 'paidBy', 'seats', 'vaultItem', 'note']) expect(fields).not.toHaveProperty(field); expect(Object.keys(fields)).toEqual(['vendor', 'status']); });
test('Default list when settings have no hide list', () => { expect(resolveHidden(check(settings('settings', { views: { staff: {} } })))).toEqual(['cost', 'currency', 'cycle', 'renewsOn', 'paidBy', 'seats', 'vaultItem', 'note']); });
test('Custom list', () => { const fields = details(check(hiding(['cost']), full())); expect(fields).not.toHaveProperty('cost'); expect(fields.renewsOn).toBe('2027-02-28'); });
test('Empty list', () => { const result = check(hiding([]), full()); expect(details(result)).toEqual(details(result, 'full')); });
test('Typo next to valid names', () => { const result = check(hiding(['vendor', 'cosst']), full()); expect(resolveHidden(result)).toEqual(allFields); expect(view(result).licences[0]!.spec).not.toHaveProperty('licence'); });
test('Typo in the path', () => { const result = check(settings('settings', { view: { staff: { hide: ['vendor'] } } }), full()); expect(details(result)).not.toHaveProperty('vendor'); expect(resolveHidden(result)).toEqual(allFields); });
test('Real list in a second settings document', () => { const result = checkFiles({ 'a.yaml': [settings('settings')], 'b.yaml': [hiding(['vendor'], 'company')], 'c.yaml': [full()] }); expect(details(result)).not.toHaveProperty('vendor'); });
test('Syntax error in stackledger.yaml', () => { const result = checkFiles({ 'stackledger.yaml': ['spec: "unclosed\n'], 'c.yaml': [full()] }); expect(result.served.licences).toHaveLength(1); expect(view(result).licences[0]!.spec).not.toHaveProperty('licence'); });
test('Settings in a file that cannot be parsed or expanded fail closed', () => {
 const custom = 'apiVersion: stackledger/v1alpha1\nkind: Settings\nmetadata: {name: settings}\nspec: {views: {staff: {hide: [vendor]}}}\n';
 for (const broken of [custom + 'extra: *missing\n', custom + 'extra: "unclosed\n', custom.replace('kind: Settings', '{kind: "settings"')]) {
  const result = checkFiles({ 'policy.yaml': [broken], 'c.yaml': [full()] });
  expect(result.served.settings).toEqual([]); expect(resolveHidden(result)).toEqual(allFields);
 }
 expect(resolveHidden(checkFiles({ 'notes.yaml': ['note: "unclosed\n'], 'c.yaml': [full()] }))).toEqual(['cost', 'currency', 'cycle', 'renewsOn', 'paidBy', 'seats', 'vaultItem', 'note']);
});
test('Settings-like documents fail closed', () => {
 for (const broken of [set(settings(), 'kind', 'settings'), set(settings(), 'apiVersion', 'backstage.io/v1alpha1'), set(settings(), 'metadata.name', 'café'), set(hiding([]), 'metadata.description', '-----BEGIN OPENSSH PRIVATE KEY-----')]) expect(resolveHidden(check(broken, full()))).toEqual(allFields);
 expect(resolveHidden(checkFiles({ 'team/stackledger.yml': [set(component(), 'spec.owner', undefined)], 'c.yaml': [hiding([])] }))).toEqual(allFields);
 expect(resolveHidden(checkFiles({ 'a.yaml': [hiding([])], 'b.yaml': [hiding([])] }))).toEqual(allFields);
});
test('No trace of the cost', () => {
 const result = check(set(set(full(), 'spec.licence.cost', 98765), 'spec.cost', 98765), set(set(component('editor'), 'spec.licence', { cost: 98765 }), 'spec.dependsOn', ['resource:licence-chat']));
 const staff = view(result); const graph = buildGraph(staff); const outputs: unknown[] = [staff, gaps(graph), findItems(graph, { limit: 200 }), findItems(graph, { query: '98765', limit: 200 })];
 for (const item of graph.items.values()) outputs.push(itemDetail(graph, item), impact(graph, item));
 for (const output of outputs) expect(JSON.stringify(output)).not.toContain('98765');
 expect(findItems(graph, { query: '98765', limit: 200 }).total).toBe(0); expect(JSON.stringify(view(result, 'full'))).toContain('98765');
});
test('Order does not reveal the hidden field', () => {
 const result = check(set(licence('c-tool'), 'spec.licence.renewsOn', '2027-01-01'), set(licence('a-tool'), 'spec.licence.renewsOn', '2027-12-01'), set(licence('b-tool'), 'spec.licence.renewsOn', '2027-06-01'));
 const graph = buildGraph(view(result)); expect(findItems(graph, { kind: 'licence', limit: 50 }).items.map(i => i.ref)).toEqual(['resource:a-tool', 'resource:b-tool', 'resource:c-tool']);
 expect(itemDetail(graph, lookup(graph, 'resource:a-tool') as Item)).toMatchObject({ spec: { licence: { vendor: 'Northwind Studio', status: 'active' } } });
});
test('Views are deep copies', () => { const result = check(full()); view(result, 'full').licences[0]!.spec.licence.vendor = 'changed'; expect(result.served.licences[0]!.spec.licence.vendor).toBe('Northwind Studio'); });
