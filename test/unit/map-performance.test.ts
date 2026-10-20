/** Fixed-seed size/speed acceptance fixture. Run npm run build && npm test.
 * 200 unique even-coordinate stations on a 50x24 grid, 20 journeys with 12 unique stops.
 */
import { test, expect } from 'vitest';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap } from '../../src/map/layout.js';
import { renderSvg } from '../../src/map/svg.js';
import { themes } from '../../src/map/themes.js';
import type { View } from '../../src/views.js';
test('Large catalogue',()=>{
 let seed=20271020;const random=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const cells=Array.from({length:25*12},(_,i)=>[i%25*2,Math.floor(i/25)*2] as [number,number]);
 for(let i=cells.length-1;i>0;i--){const j=random(i+1);[cells[i],cells[j]]=[cells[j]!,cells[i]!];}
 const names=Array.from({length:200},(_,i)=>`station-${String(i).padStart(3,'0')}`);
 const stopLists=Array.from({length:20},(_,i)=>names.slice(i*10,i*10+10));
 for(const stops of stopLists)while(stops.length<12){const n=names[random(200)]!;if(!stops.includes(n))stops.push(n);}
 const view:View={name:'full',components:names.map(name=>({apiVersion:'backstage.io/v1alpha1',kind:'Component',metadata:{name},spec:{type:'tool',lifecycle:'active',owner:'group:demo'}})),licences:[],resources:[],lines:stopLists.map((stops,i)=>({apiVersion:'stackledger/v1alpha1',kind:'Line',metadata:{name:`journey-${i}`},spec:{code:String(i),color:'#336699',stops:stops.map(n=>`component:${n}`)}})),layout:{apiVersion:'stackledger/v1alpha1',kind:'MapLayout',metadata:{name:'performance'},spec:{stations:Object.fromEntries(names.map((n,i)=>[`component:${n}`,cells[i]!]))}}};
 const start=performance.now(),geometry=layoutMap(buildMapModel(view,'2027-06-01')),svg=renderSvg(geometry,themes.light),elapsed=performance.now()-start;
 console.info(`metro-map-engine: seeded 200 stations, 20 lines, 240 stops: ${elapsed.toFixed(1)} ms`);
 expect(geometry.stations).toHaveLength(200);expect(geometry.lines).toHaveLength(20);expect(svg).toContain('component:station-199');expect(elapsed).toBeLessThan(5000);
},10000);
