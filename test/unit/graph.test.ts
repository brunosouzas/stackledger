/** Relation queries: references, order, impact, gaps and the renewal window. Run npm test. */
import { test, expect } from 'vitest';
import { applyView, resolveHidden } from '../../src/views.js';
import { buildGraph, findItems, itemDetail, impact, gaps, lookup, renewals, addDays, isDate, localDate, compareRefs, type Item } from '../../src/graph.js';
import { component, licence, line, check, set } from './helpers.js';
const graphOf = (...documents: unknown[]) => { const result = check(...documents); return buildGraph(applyView(result.served, 'full', resolveHidden(result))); };
const uses = (name: string, ...refs: string[]) => set(component(name), 'spec.dependsOn', refs);
const item = (graph: ReturnType<typeof graphOf>, ref: string) => lookup(graph, ref) as Item;
test('References sort by name by code point, ties component, resource, line', () => {
 expect(['line:a', 'resource:a', 'component:b', 'component:Z', 'component:a'].sort(compareRefs)).toEqual(['component:Z', 'component:a', 'resource:a', 'line:a', 'component:b']);
});
test('Lookup accepts case and default namespace only', () => {
 const graph = graphOf(component('Editor'));
 expect(item(graph, 'COMPONENT:default/editor').ref).toBe('component:Editor');
 for (const value of ['component:payments/editor', 'system:editor', 'editor', 'component:ghost']) expect(lookup(graph, value)).toMatchObject({ error: expect.stringContaining(value) });
});
test('Dependencies in file order, unresolved as written', () => {
 const graph = graphOf(uses('editor', 'resource:licence-chat', 'component:ghost', 'Component:Forge', 'system:x', 'component:forge'), component('forge'), licence());
 expect(itemDetail(graph, item(graph, 'component:editor'))).toMatchObject({ dependsOn: ['resource:licence-chat', 'component:forge'], unresolved: ['component:ghost', 'system:x'], dependants: [], lines: [], zone: null });
});
test('Chain of dependants', () => { const graph = graphOf(component('vault'), uses('forge', 'component:vault'), uses('editor', 'component:forge')); expect(impact(graph, item(graph, 'component:vault'))).toEqual({ dependants: [{ ref: 'component:forge', depth: 1 }, { ref: 'component:editor', depth: 2 }], lines: [], truncated: false }); });
test('Smallest depth wins', () => { const graph = graphOf(component('vault'), uses('forge', 'component:vault'), uses('editor', 'component:forge', 'component:vault')); expect(impact(graph, item(graph, 'component:vault')).dependants).toEqual([{ ref: 'component:editor', depth: 1 }, { ref: 'component:forge', depth: 1 }]); });
test('Cycle', () => { const graph = graphOf(uses('a', 'component:b'), uses('b', 'component:a')); expect(impact(graph, item(graph, 'component:a')).dependants).toEqual([{ ref: 'component:b', depth: 1 }]); });
test('Journeys affected', () => { const graph = graphOf(component('vault'), uses('editor', 'component:vault'), component('forge'), set(line('ship'), 'spec.stops', ['component:editor', 'component:forge'])); expect(impact(graph, item(graph, 'component:vault')).lines).toEqual(['line:ship']); });
test('More than 500 dependants', () => {
 const many = Array.from({ length: 501 }, (_, i) => uses(`app-${String(i).padStart(3, '0')}`, 'component:vault'));
 const graph = graphOf(component('vault'), ...many, set(line('last'), 'spec.stops', ['component:app-500', 'component:vault']));
 const result = impact(graph, item(graph, 'component:vault'));
 expect(result.dependants).toHaveLength(500); expect(result.truncated).toBe(true); expect(result.dependants.at(-1)!.ref).toBe('component:app-499'); expect(result.lines).toEqual(['line:last']);
});
test('Licence dependsOn creates no dependency', () => { const graph = graphOf(component('editor'), set(licence(), 'spec.dependsOn', ['component:editor'])); expect(itemDetail(graph, item(graph, 'component:editor'))).toMatchObject({ dependants: [] }); });
test('Gaps', () => {
 const graph = graphOf(uses('editor', 'resource:licence-chat'), component('scanner'), component('notes'), component('forge'), set(line('ship'), 'spec.stops', ['component:notes', 'component:editor']), licence(), licence('licence-old'), uses('ghosted', 'component:ghost'));
 expect(gaps(graph)).toEqual({ isolated: ['component:forge', 'component:ghosted', 'component:notes', 'component:scanner'], offMap: ['component:forge', 'component:ghosted', 'component:scanner'], unusedLicences: ['resource:licence-old'] });
});
test('Find sorts before the limit and matches visible fields', () => {
 const graph = graphOf(set(component('b'), 'metadata.tags', ['Design']), component('a'), set(component('C'), 'metadata.description', 'design notes'), licence());
 expect(findItems(graph, { query: 'DESIGN', limit: 1 })).toEqual({ items: [{ ref: 'component:C', kind: 'component', type: 'tool', lifecycle: 'active', owner: 'user:alex' }], total: 2, truncated: true });
 expect(findItems(graph, { query: 'northwind', limit: 50 }).items).toEqual([{ ref: 'resource:licence-chat', kind: 'licence', type: 'licence', owner: 'user:alex' }]);
});
test('Dates are calendar dates in UTC', () => {
 expect(isDate('2027-02-30')).toBe(false); expect(isDate('2028-02-29')).toBe(true); expect(isDate('2027-6-01')).toBe(false);
 expect(addDays('2027-06-01', 30)).toBe('2027-07-01'); expect(addDays('2027-12-31', 1)).toBe('2028-01-01'); expect(addDays('2028-02-28', 366)).toBe('2029-02-28');
 expect(localDate(new Date(2027, 0, 5, 23, 59))).toBe('2027-01-05'); expect(isDate(localDate())).toBe(true);
});
test('Renewal window edges', () => {
 const renew = (name: string, renewsOn: string, status = 'active') => set(set(licence(name), 'spec.licence.renewsOn', renewsOn), 'spec.licence.status', status);
 const graph = graphOf(renew('b-tool', '2027-06-10'), renew('a-tool', '2027-06-10'), renew('first', '2027-06-01'), renew('last', '2027-07-01'), renew('after', '2027-07-02'), renew('late', '2027-05-20'), renew('gone', '2027-06-05', 'cancelled'), renew('maybe', 'unknown', 'to-confirm'), renew('never', 'not-applicable'));
 const result = renewals(graph, '2027-06-01', 30);
 expect(result.to).toBe('2027-07-01'); expect(result.licences.map(l => l.ref)).toEqual(['resource:first', 'resource:a-tool', 'resource:b-tool', 'resource:last']);
 expect(result.overdue.map(l => l.ref)).toEqual(['resource:late']); expect(result.unknown).toEqual(['resource:maybe']);
 expect(result.licences[0]).toEqual({ ref: 'resource:first', vendor: 'Northwind Studio', status: 'active', renewsOn: '2027-06-01', cycle: 'monthly', cost: 10, currency: 'GBP' });
 expect(renewals(graph, '2027-06-01', 0).licences.map(l => l.ref)).toEqual(['resource:first']);
});
