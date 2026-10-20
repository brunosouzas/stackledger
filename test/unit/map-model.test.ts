/** Map input, order, layout conflicts and visible licence semantics. Run npm test. */
import { test, expect } from 'vitest';
import { buildMapModel } from '../../src/map/model.js';
import { component, journey, positions, set, viewOf } from './map-helpers.js';
import { licence } from './helpers.js';
const model = (...docs: unknown[]) => buildMapModel(viewOf(docs), '2027-06-01');
test('Component on no line', () => { expect(model(component('scanner')).stations).toEqual([]); });
test('Stop with errors', () => {
 const m = model(component('editor'), set(component('forge'), 'spec.owner', undefined), component('deploy'), journey('ship', ['editor', 'forge', 'deploy']));
 expect(m.lines[0]!.stops).toEqual(['component:editor', 'component:deploy']); expect(m.stations.map(s => s.ref)).toEqual(['component:deploy', 'component:editor']);
});
test('Line left with one stop', () => { expect(model(component('a'), set(component('b'), 'spec.owner', undefined), journey('ship', ['a', 'b'])).lines).toEqual([]); });
test('Codes before names', () => { const m = model(component('a'), component('b'), ...[['ship','2'],['alpha',undefined],['secrets','10'],['lower','a'],['upper','A']].map(([n,c]) => journey(n!, ['a','b'], c))); expect(m.lines.map(l => l.name)).toEqual(['secrets','ship','lower','upper','alpha']); });
test('Two stations in one cell', () => { const m = model(component('a'), component('b'), journey('ship',['a','b']), positions({ a:[3,2], b:[3,2] })); expect([...m.positions]).toEqual([['component:a',[3,2]]]); expect(m.occupied).toEqual([[3,2],[3,2]]); });
test('First component key wins even when the first cell is claimed', () => {
 const p = set(positions({}), 'spec.stations', { 'component:b':[0,0], 'Component:default/A':[0,0], 'component:a':[5,5] });
 expect([...model(component('a'),component('b'),journey('ship',['a','b']),p).positions]).toEqual([['component:b',[0,0]]]);
});
test('Layout with a fractional position', () => { const m = model(component('a'),component('b'),journey('ship',['a','b']),positions({ a:[2.5,1], b:[2,2] })); expect(m.positions.size).toBe(0); expect(m.occupied).toEqual([]); });
const using = set(component('editor'), 'spec.dependsOn', ['resource:solid', 'resource:hollow']);
const lic = (name: string, status: string, date = '2027-07-01') => set(set(licence(name),'spec.licence.status',status),'spec.licence.renewsOn',date);
test('Active and to-buy', () => { expect(model(using,component('b'),journey('ship',['editor','b']),lic('solid','active'),lic('hollow','to-buy')).stations.find(s=>s.name==='editor')).toMatchObject({ licence:'solid', renewal:true }); });
test('Licence markers require visible status and served licences', () => {
 const docs = [using,component('b'),journey('ship',['editor','b']),lic('solid','expired'),lic('hollow','to-buy')];
 expect(model(...docs).stations.find(s=>s.name==='editor')!.licence).toBe('hollow');
 const v = viewOf(docs,'staff'); for (const l of v.licences) delete (l.spec.licence as any).status;
 expect(buildMapModel(v,'not a date').stations.find(s=>s.name==='editor')!.licence).toBe('none');
});
test('Renewal soon in full', () => {
 for (const [date,ring] of [['2027-05-31',false],['2027-06-01',true],['2027-07-01',true],['2027-07-02',false],['unknown',false],['not-applicable',false]] as const) {
  const m=model(using,component('b'),journey('ship',['editor','b']),lic('solid','to-confirm',date),lic('hollow','to-buy'));
  expect(m.stations.find(s=>s.name==='editor')!.renewal,date).toBe(ring);
 }
});
