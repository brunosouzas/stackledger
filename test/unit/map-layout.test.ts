/** Layout scenarios against numeric geometry, without rendering. Run npm test. */
import { test, expect } from 'vitest';
import { buildMapModel } from '../../src/map/model.js';
import { suggestPositions, octile } from '../../src/map/suggest.js';
import { routeHop, routeMap, edgeKey } from '../../src/map/route.js';
import { parallelLines } from '../../src/map/parallel.js';
import { wrapLabel, textWidth, labelCandidates, chooseLabel, overlapArea, placeLabels, segmentObstacle } from '../../src/map/labels.js';
import { layoutMap } from '../../src/map/layout.js';
import { component, journey, positions, set, viewOf } from './map-helpers.js';
const model = (...docs: unknown[]) => buildMapModel(viewOf(docs),'2027-06-01');
const base = () => [component('a'),component('b'),journey('ship',['a','b']),positions({ a:[3,2],b:[6,2] })];
const octilinear = (points: number[][]) => { for(let i=1;i<points.length;i++){ const dx=Math.abs(points[i]![0]!-points[i-1]![0]!),dy=Math.abs(points[i]![1]!-points[i-1]![1]!); expect(dx<1e-7 || dy<1e-7 || Math.abs(dx-dy)<1e-7,JSON.stringify(points.slice(i-1,i+1))).toBe(true); } };
test('Station coordinates',()=>{ expect(layoutMap(model(...base())).stations.find(s=>s.name==='a')!.point).toEqual([192,128]); });
test('New line does not move stations',()=>{ const before=layoutMap(model(...base())); const after=layoutMap(model(...base(),journey('extra',['b','a']))); expect(after.stations.map(s=>s.point)).toEqual(before.stations.map(s=>s.point)); });
test('Cell of an undrawn station',()=>{ const m=model(...base(),component('old'),component('c'),journey('extra',['a','c','b']),positions({old:[0,0]})); m.occupied.push([4,2]); const p=suggestPositions(m); expect([...p.positions.values()]).not.toContainEqual([4,2]); });
test('Between two neighbours',()=>{ const m=model(component('a'),component('forge'),component('b'),journey('ship',['a','forge','b']),positions({a:[2,2],b:[4,2]})); expect(suggestPositions(m).suggestions).toEqual([{ref:'component:forge',point:[3,2]}]); });
test('Nothing placed',()=>{ const m=model(component('a'),component('b'),component('c'),journey('ship',['a','b','c'])); expect(suggestPositions(m).suggestions.map(s=>s.point)).toEqual([[0,0],[1,0],[2,0]]); });
test('Suggestions deduplicate neighbours, use earlier suggestions, and break ties by row then column',()=>{
 const m=model(component('a'),component('b'),component('c'),journey('ship',['a','b','c']),journey('other',['a','b']),positions({a:[2,2],c:[3,3]}));
 expect(suggestPositions(m).positions.get('component:b')).toEqual([3,2]); expect(octile([0,0],[2,1])).toBeCloseTo(1+Math.SQRT2);
 m.occupied.push([3,2],[2,3]); expect(suggestPositions(m).positions.get('component:b')).toEqual([2,1]);
});
test('No-neighbour suggestion uses all stored columns and does not mutate input',()=>{ const m=model(component('a'),component('b'),journey('ship',['a','b']),positions({old:[100000,8]})); const snapshot=structuredClone(m); expect(suggestPositions(m).suggestions[0]!.point).toEqual([100001,0]); expect(m).toEqual(snapshot); });
test('Station in the way',()=>{ const r=routeHop([0,0],[4,0],new Set(['2,0'])); expect(r.unrouted).toBe(false); expect(r.points).not.toContainEqual([2,0]); octilinear(r.points); });
test('Straight when nothing is in the way',()=>{ const r=routeHop([0,0],[3,0],new Set()); expect(r.points).toEqual([[0,0],[1,0],[2,0],[3,0]]); expect(r.unrouted).toBe(false); });
test('Far-away typo',()=>{ const start=performance.now();const r=routeHop([0,0],[100000,100000],new Set());expect(r.unrouted).toBe(true);expect(r.expanded).toBeLessThanOrEqual(50000); expect(r.points).toEqual([[0,0],[100000,100000]]);expect(performance.now()-start).toBeLessThan(1000); });
test('Router bounds, state budget and turns',()=>{
 const blocked=new Set<string>();for(let x=-3;x<=7;x++)for(let y=-3;y<=3;y++)if(x!==0||y!==0)blocked.add(`${x},${y}`);
 expect(routeHop([0,0],[4,0],blocked).unrouted).toBe(true);
 const r=routeHop([0,0],[8,6],new Set(['2,2','3,3','4,4']));expect(r.expanded).toBeLessThanOrEqual(50000);
 for(const p of r.points){expect(p[0]).toBeGreaterThanOrEqual(-3);expect(p[0]).toBeLessThanOrEqual(11);expect(p[1]).toBeGreaterThanOrEqual(-3);expect(p[1]).toBeLessThanOrEqual(9);}
 for(let i=2;i<r.points.length;i++){const [a,b,c]=r.points.slice(i-2,i+1);const u=[b![0]-a![0],b![1]-a![1]],v=[c![0]-b![0],c![1]-b![1]];expect(u[0]!*v[0]!+u[1]!*v[1]!).toBeGreaterThanOrEqual(0);}
});
test('Routes prefer reused corridors and penalise diagonal crossings',()=>{
 const a=routeHop([0,0],[4,2],new Set()); const used=new Set<string>(); for(let i=1;i<a.points.length;i++)used.add(edgeKey(a.points[i-1]!,a.points[i]!));
 expect(routeHop([0,0],[4,2],new Set(),used).points).toEqual(a.points);
 // Crossing a used corridor diagonally only breaks ties between routes of equal length and bends.
 const cross=new Set([edgeKey([0,1],[1,0])]); const diverted=routeHop([0,0],[2,1],new Set(),cross);expect(diverted.points).toEqual([[0,0],[1,0],[2,1]]);
 expect(routeHop([0,0],[2,2],new Set(),cross).points).toEqual([[0,0],[1,1],[2,2]]);
});
test('Reuse never buys extra length or bends',()=>{
 const used=new Set([edgeKey([0,0],[0,1]),edgeKey([0,1],[0,2]),edgeKey([0,2],[1,2]),edgeKey([1,2],[2,2])]);
 expect(routeHop([0,0],[2,2],new Set(),used).points).toEqual([[0,0],[1,1],[2,2]]);
 const corridor=new Set([edgeKey([0,0],[1,0]),edgeKey([1,0],[2,0]),edgeKey([2,0],[3,0])]);
 expect(routeHop([0,0],[3,0],new Set(),corridor).points).toEqual([[0,0],[1,0],[2,0],[3,0]]);
});
test('Routes avoid cells beside other stations when an equal-length route exists',()=>{
 // [0,0] to [2,1]: right-then-diagonal passes [1,0], beside the station at [1,-1]; diagonal-then-right does not.
 const r=routeHop([0,0],[2,1],new Set(['0,0','2,1','1,-1']));expect(r.points).toEqual([[0,0],[1,1],[2,1]]);
});
test('Two lines on one hop',()=>{const m=model(...base(),journey('secrets',['b','a']));const p=suggestPositions(m).positions,r=routeMap(m,p);expect(r.hops).toHaveLength(1);expect(r.hops[0]!.lines).toHaveLength(2); const strokes=parallelLines(m,r);expect(strokes[0]!.points).not.toEqual([...strokes[1]!.points].reverse());});
test('Different hops on one edge',()=>{
 const m=model(component('a'),component('b'),component('c'),component('d'),journey('ship',['a','b']),journey('secrets',['c','d']),positions({a:[0,0],b:[6,0],c:[1,1],d:[5,1]}));
 const routes={hops:[],paths:new Map([['line:secrets',[[1,1],[2,0],[3,0],[4,0],[5,1]]],['line:ship',[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]]])} as any;
 const strokes=parallelLines(m,routes);const edge=strokes.map(s=>s.edges.find(e=>e.key===edgeKey([3,0],[4,0]))!);expect(edge.every(Boolean)).toBe(true);expect(edge[0]!.offset).not.toBe(edge[1]!.offset);expect(edge[0]!.a[1]).not.toBe(edge[1]!.a[1]);for(const s of strokes)octilinear(s.points);
});
test('Bends are mitred and a bundle keeps its sides through the bend',()=>{
 const m=model(component('a'),component('b'),journey('ship',['a','b'],'1'),journey('secrets',['a','b'],'2'),positions({a:[0,1],b:[1,0]}));
 const routes={hops:[],paths:new Map([['line:ship',[[0,1],[1,1],[1,0]]],['line:secrets',[[0,1],[1,1],[1,0]]]])} as any;
 const strokes=parallelLines(m,routes);
 const sides=strokes.map(s=>s.edges.map(e=>{const dx=e.gridB[0]-e.gridA[0],dy=e.gridB[1]-e.gridA[1],ox=e.a[0]-e.gridA[0]*64,oy=e.a[1]-e.gridA[1]*64;return Math.sign(dx*oy-dy*ox);}));
 for(const s of sides){expect(s[0]).not.toBe(0);expect(s[1]).toBe(s[0]);}
 expect(sides[0]![0]).not.toBe(sides[1]![0]);
 for(const s of strokes){expect(s.points).toHaveLength(3);octilinear(s.points);}
});
test('A single line bends without steps',()=>{const routes={hops:[],paths:new Map([['line:ship',[[3,2],[4,2],[5,3],[5,4],[6,4]]]])} as any;const m=model(...base());expect(parallelLines(m,routes)[0]!.points).toEqual([[192,128],[256,128],[320,192],[320,256],[384,256]]);});
test('Collinear slot changes use one 45-degree connector',()=>{
 const m=model(component('a'),component('b'),component('c'),journey('ship',['a','c'],'1'),journey('secrets',['b','c'],'2'),positions({a:[0,0],b:[2,1],c:[4,0]}));
 const routes={hops:[],paths:new Map([['line:ship',[[0,0],[1,0],[2,0],[3,0],[4,0]]],['line:secrets',[[2,1],[3,0],[4,0]]]])} as any;
 const ship=parallelLines(m,routes)[0]!;octilinear(ship.points);expect(ship.points).toHaveLength(4);
});
test('Angles',()=>{const m=model(...base(),component('c'),component('d'),journey('extra',['b','c','a','d']),positions({}));const g=layoutMap(m); for(const l of g.lines)octilinear(l.points);});
test('Long title',()=>{const title='Northwind Customer Relationship Manager';const rows=wrapLabel(title);expect(rows).toHaveLength(2);expect(rows[1]).toMatch(/…$/);for(const r of rows)expect([...r].length).toBeLessThanOrEqual(18);expect(wrapLabel('😀'.repeat(30))[0]).toMatch(/…$/);});
test('Labels wrap at spaces, cut each long word, and use fixed widths',()=>{expect(wrapLabel('short title')).toEqual(['short title']);expect(wrapLabel('abcdefghijklmnopqrst more')).toEqual(['abcdefghijklmnopq…','more']);expect(textWidth('WWW')).toBeGreaterThan(textWidth('iii'));expect(textWidth('😀')).toBeGreaterThan(0);});
test('Label candidates, scoring and exact order',()=>{const candidates=labelCandidates([100,100],20,10,20);expect(candidates).toEqual([{x:120,y:95,w:20,h:10},{x:60,y:95,w:20,h:10},{x:90,y:70,w:20,h:10},{x:90,y:120,w:20,h:10},{x:120,y:70,w:20,h:10},{x:120,y:120,w:20,h:10},{x:60,y:70,w:20,h:10},{x:60,y:120,w:20,h:10}]); expect(chooseLabel(candidates,[])).toEqual(candidates[0]);expect(chooseLabel(candidates,[candidates[0]!])).toEqual(candidates[1]);expect(overlapArea({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10})).toBe(25); expect(chooseLabel(candidates,[{x:0,y:0,w:1000,h:1000}])).toEqual(candidates[0]);});
test('Interchange',()=>{const g=layoutMap(model(...base(),component('slack'),journey('two',['slack','a']),journey('three',['slack','b']),journey('four',['slack','a']),positions({})));const s=g.stations.find(s=>s.name==='slack')!;expect(s.marker.kind).toBe('interchange');expect(s.lines).toHaveLength(3);for(const p of s.marker.contacts)expect(s.marker.box.x<=p[0]&&p[0]<=s.marker.box.x+s.marker.box.w&&s.marker.box.y<=p[1]&&p[1]<=s.marker.box.y+s.marker.box.h).toBe(true);});
test('Suggested interchange',()=>{const g=layoutMap(model(component('slack'),component('a'),component('b'),journey('one',['slack','a']),journey('two',['slack','b'])));expect(g.stations.find(s=>s.name==='slack')).toMatchObject({suggested:true,marker:{kind:'interchange'}});});
test('Line without code',()=>{expect(layoutMap(model(...base())).badges.map(b=>b.text)).toEqual(['S','S']);});
test('Zone area',()=>{const zone={name:'finance',title:'Finance',color:'#123456'};const m=model(set(component('xero'),'metadata.labels',{'stackledger/zone':'Finance'}),set(component('stripe'),'metadata.labels',{'stackledger/zone':'finance'}),journey('pay',['xero','stripe']),set(positions({xero:[0,0],stripe:[4,2]}),'spec.zones',[zone]));const g=layoutMap(m); expect(g.zones).toHaveLength(1);expect(g.zones[0]).toMatchObject(zone);expect(g.zones[0]!.hull).toEqual([[0,0],[256,128]]);expect(g.zones[0]!.padding).toBe(32);});
test('Legend in staff',()=>{const g=layoutMap(buildMapModel(viewOf(base(),'staff'),'ignored'));expect(g.legend.symbols).toEqual(['interchange','licence','licence to buy','suggested position']);expect(g.legend.lines.map(l=>l.name)).toEqual(['ship']);});
test('Deprecated marker and label are muted but lines stay intact',()=>{const g=layoutMap(model(...base().map(d=>(d as any).metadata.name==='a'?set(d,'spec.lifecycle','DePrEcAtEd'):d)));expect(g.stations.find(s=>s.name==='a')!.deprecated).toBe(true);expect(g.lines[0]!.color).toBe('#FF0000');});

test('Routing stops at exactly the expanded-state budget',()=>{const blocked=new Set<string>();for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy)blocked.add(`${300+dx},${300+dy}`);const r=routeHop([0,0],[300,300],blocked);expect(r.unrouted).toBe(true);expect(r.expanded).toBe(50000);expect(r.points).toEqual([[0,0],[300,300]]);});
test('Label placement uses interchange count then reference and exact segment rectangles',()=>{
 const s=(ref:string,lines:number)=>({ref,title:ref,lines:Array.from({length:lines},(_,i)=>String(i)),point:[0,0] as [number,number],marker:{box:{x:-7,y:-7,w:14,h:14}}});
 expect(placeLabels([s('component:z',1),s('component:a',1),s('component:slack',3)],[]).map(l=>l.ref)).toEqual(['component:slack','component:a','component:z']);
 const outside={x:0,y:80,w:10,h:10},inside={x:45,y:45,w:10,h:10};expect(chooseLabel([outside,inside],[segmentObstacle([0,0],[100,100],7)])).toEqual(outside);
});
