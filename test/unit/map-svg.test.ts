/** Parse real SVG with an independently pinned XML parser; allow-lists copied from the spec.
 * Run npm test. Differential catalogues prove the hidden/date paths actually affect full output.
 */
import { test, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { renderSvg, escapeXml } from '../../src/map/svg.js';
import { themes } from '../../src/map/themes.js';
import { tag } from '../../src/map/xml.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap } from '../../src/map/layout.js';
import { component, journey, positions, set, viewOf } from './map-helpers.js';
import { licence, settings, checkFiles } from './helpers.js';
import { applyView, resolveHidden } from '../../src/views.js';
export const elements=new Set('svg title desc g path line rect circle ellipse polygon polyline text tspan'.split(' '));
export const attributes=new Set('xmlns role viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray opacity fill-opacity stroke-opacity font-family font-size font-weight text-anchor dominant-baseline data-ref'.split(' '));
const docs=()=>[component('a'),component('b'),journey('ship',['a','b']),positions({a:[0,0],b:[4,0]})];
const geometry=(documents=docs(),view:'full'|'staff'='full',date='2027-06-01')=>layoutMap(buildMapModel(viewOf(documents,view),date));
// U+FFFD is required output for invalid XML characters; the parser warns on this valid character.
export function parseSvg(svg:string){return new DOMParser({onError:(level,message)=>{if(level!=='warning' || message!=='Unicode replacement character detected, source encoding issues?')throw new Error(`${level}: ${message}`);}}).parseFromString(svg,'image/svg+xml');}
export function safe(svg:string){
 const doc=parseSvg(svg);expect(doc.documentElement.tagName).toBe('svg');expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');expect(doc.documentElement.getAttribute('role')).toBe('img');
 expect(svg).not.toMatch(/<!DOCTYPE|<!ENTITY|<\?/i);
 for(const element of Array.from(doc.getElementsByTagName('*'))){expect(elements.has(element.tagName),element.tagName).toBe(true);for(const attr of Array.from(element.attributes)){expect(attributes.has(attr.name),attr.name).toBe(true);if(['fill','stroke'].includes(attr.name))expect(attr.value).toMatch(/^(?:#[0-9A-Fa-f]{6}|none)$/);expect(attr.value).not.toMatch(/url\(/i);}}
 return doc;
}
test('No lines',()=>{const doc=safe(renderSvg(geometry([]),themes.light));expect(doc.documentElement.textContent).toContain('No journeys yet');});
test('Allowed names only',()=>{const g=geometry(),doc=safe(renderSvg(g,themes.light));const refs=Array.from(doc.getElementsByTagName('*')).map(e=>e.getAttribute('data-ref')).filter(Boolean);expect(refs.sort()).toEqual(['component:a','component:b','line:ship']);expect(doc.getElementsByTagName('title').length).toBe(4);});
const hostile='<script>&"\' ]]> javascript: \u0001 \uFFFE';
function hostileGeometry(){const g=geometry();g.stations[0]!.title=hostile;g.lines[0]!.title=hostile;g.legend.lines[0]!.title=hostile;g.zones.push({name:'zone',title:hostile,color:'#ABCDEF',hull:[[0,0],[256,0]],padding:32,titleBox:{x:0,y:-60,w:200,h:17}});return g;}
test('Hostile titles through the real pipeline',()=>{
 const long=`${hostile} Northwind Customer Relationship Manager`;
 const docs=[set(set(component('a'),'metadata.title',long),'metadata.labels',{'stackledger/zone':'zone'}),component('b'),set(journey('ship',['a','b']),'metadata.title',hostile),set(positions({a:[0,0],b:[4,0]}),'spec.zones',[{name:'zone',title:hostile,color:'#ABCDEF'}])];
 const g=geometry(docs);
 expect(g.lines).toHaveLength(1);expect(g.zones).toHaveLength(1);expect(g.labels.find(l=>l.ref==='component:a')!.rows).toHaveLength(2);
 const clean=(text:string)=>text.replace(/[\u0001￾]/g,'�');
 for(const theme of Object.values(themes)){
  const doc=safe(renderSvg(g,theme)),text=doc.documentElement.textContent!;
  expect(text).toContain(clean(long));expect(text).toContain(clean(hostile));
  expect(doc.getElementsByTagName('script')).toHaveLength(0);
  for(const e of Array.from(doc.getElementsByTagName('*')))for(const a of Array.from(e.attributes))expect(a.value).not.toMatch(/javascript:|<script/);
 }
});
test('Unknown attribute',()=>{safe(renderSvg(hostileGeometry(),themes.light));});
test('Paint values',()=>{for(const theme of Object.values(themes))safe(renderSvg(geometry(),theme));const g=geometry();g.lines[0]!.color='url(javascript:alert(1))';expect(()=>renderSvg(g,themes.light)).toThrow(/colour/);});
test('Hostile titles',()=>{const svg=renderSvg(hostileGeometry(),themes.light),doc=safe(svg);const clean=hostile.replace(/[\u0001\uFFFE]/g,'�');expect(doc.documentElement.textContent).toContain(clean);expect(doc.getElementsByTagName('script')).toHaveLength(0);for(const e of Array.from(doc.getElementsByTagName('*')))for(const a of Array.from(e.attributes))expect(a.value).not.toContain('javascript:');expect(escapeXml('&<>"\'\ud800')).toBe('&amp;&lt;&gt;&quot;&apos;�');});
test('Long title keeps full station title',()=>{const full='Northwind Customer Relationship Manager';const g=geometry([set(component('a'),'metadata.title',full),...docs().slice(1)]);const doc=parseSvg(renderSvg(g,themes.light));const station=Array.from(doc.getElementsByTagName('g')).find(e=>e.getAttribute('data-ref')==='component:a')!;expect(station.getElementsByTagName('title')[0]!.textContent).toBe(full);expect(g.labels.find(l=>l.ref==='component:a')!.rows[1]).toMatch(/…$/);});
test('Dark theme',()=>{const g=geometry(),svg=renderSvg(g,themes.dark);expect(svg).toContain(`fill="${themes.dark.background}"`);expect(svg).toContain('stroke="#FF0000"');expect(svg).not.toBe(renderSvg(g,themes.light));});
test('Themes are data, with casing and offset shadows off by default',()=>{
 for(const t of Object.values(themes)){expect(t.casing.enabled).toBe(false);expect(t.shadow.enabled).toBe(false);expect(t.font).toContain('sans-serif');}
 const t=structuredClone(themes.light);t.background='#ABCDEF';t.lineWidth=9;t.casing={enabled:true,color:'#0A1033',extraWidth:4};t.shadow={enabled:true,color:'#123456',dx:5,dy:6};
 const svg=renderSvg(geometry(),t);safe(svg);expect(svg).toContain('stroke="#0A1033" stroke-width="13"');expect(svg).toContain('fill="#123456"');expect(svg).not.toContain('transform=');expect(svg).toContain('fill="#ABCDEF"');
});
test('Numbers have at most two decimals and finite geometry is required',()=>{const g=geometry();const svg=renderSvg(g,themes.light);expect(svg).not.toMatch(/\d+\.\d{3}/);g.viewBox.w=Infinity;expect(()=>renderSvg(g,themes.light)).toThrow(/finite/);});
test('Files renamed',()=>{const a=checkFiles({'a.yaml':docs()}),b=checkFiles({'z.yaml':[...docs()].reverse()});const svg=(c:typeof a)=>renderSvg(layoutMap(buildMapModel(applyView(c.served,'full',resolveHidden(c)),'2027-06-01')),themes.light);expect(svg(a)).toBe(svg(b));});
test('Staff ignores hidden fields and the date',()=>{
 const variants=[{cost:10,currency:'GBP',cycle:'monthly',renewsOn:'2027-06-15',paidBy:'company-a',seats:2,vaultItem:'item-a',note:'term-a'},{cost:900,currency:'USD',cycle:'yearly',renewsOn:'2027-08-01',paidBy:'company-b',seats:8,vaultItem:'item-b',note:'term-b'}];
 const fixtures=variants.map(fields=>{let lic:unknown=licence('licence-a');for(const [k,v]of Object.entries(fields))lic=set(lic,`spec.licence.${k}`,v);return [set(component('a'),'spec.dependsOn',['resource:licence-a']),...docs().slice(1),lic];});
 const first=renderSvg(geometry(fixtures[0],'staff','2027-06-01'),themes.light),second=renderSvg(geometry(fixtures[1],'staff','2027-09-01'),themes.light);expect(first).toBe(second);
 const full=fixtures.map(d=>geometry(d,'full','2027-06-01'));expect(full[0]!.stations[0]!.renewal).toBe(true);expect(full[1]!.stations[0]!.renewal).toBe(false);expect(renderSvg(full[0]!,themes.light)).not.toBe(renderSvg(full[1]!,themes.light));
 // Even custom staff settings exposing renewsOn do not make the map depend on date.
 const custom=[...fixtures[0]!,settings('settings',{views:{staff:{hide:[]}}})];expect(renderSvg(geometry(custom,'staff','invalid date'),themes.light)).toBe(renderSvg(geometry(custom,'staff','9999-12-31'),themes.light));
 for(const fields of variants)for(const value of [fields.renewsOn,fields.paidBy,fields.vaultItem,fields.note])expect(first).not.toContain(value);
});
test('Repeated consecutive stops collapse before the two-stop rule',()=>{
 const draw=(stops:string[])=>geometry([component('a'),component('b'),journey('ship',stops),positions({a:[0,0],b:[3,0]})]);
 const single=draw(['a','a']);expect(single.lines).toHaveLength(0);expect(single.stations).toHaveLength(0);expect(single.badges).toHaveLength(0);safe(renderSvg(single,themes.light));
 for(const stops of [['a','a','b'],['a','b','b']]){const g=draw(stops);expect(g.lines).toHaveLength(1);expect(g.lines[0]!.stops).toEqual(['component:a','component:b']);expect(g.lines[0]!.points).toEqual([[0,0],[192,0]]);expect(g.badges).toHaveLength(2);expect(g.badges[0]!.box).not.toEqual(g.badges[1]!.box);safe(renderSvg(g,themes.light));}
 const back=draw(['a','b','a']);expect(back.lines[0]!.stops).toHaveLength(3);safe(renderSvg(back,themes.light));
});
test('Legend badges fit long codes without covering the line sample',()=>{
 const g=geometry([component('a'),component('b'),journey('ship',['a','b'],'WWW'),positions({a:[0,0],b:[4,0]})]);
 const doc=parseSvg(renderSvg(g,themes.light)),inside=(e:any)=>Number(e.getAttribute('x'))>=g.legend.box.x;
 const badge=Array.from(doc.getElementsByTagName('rect')).filter(e=>e.getAttribute('fill')==='#FF0000'&&inside(e)).at(-1)!;
 const sample=Array.from(doc.getElementsByTagName('line')).find(e=>e.getAttribute('stroke')==='#FF0000'&&Number(e.getAttribute('x1'))>=g.legend.box.x)!;
 const mapBadge=g.badges[0]!.box;expect(Number(badge.getAttribute('width'))).toBe(mapBadge.w);
 expect(Number(sample.getAttribute('x1'))).toBeGreaterThan(Number(badge.getAttribute('x'))+Number(badge.getAttribute('width')));
});
test('The root namespace and role are fixed values',()=>{expect(()=>tag('svg',{xmlns:'http://example.com/other'})).toThrow(/namespace/);expect(()=>tag('svg',{role:'presentation'})).toThrow(/role/);});
test('Zone titles are readable in both themes',()=>{
 const luminance=(hex:string)=>{const [r,g,b]=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;});return 0.2126*r!+0.7152*g!+0.0722*b!;};
 const contrast=(a:string,b:string)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x!+0.05)/(y!+0.05);};
 const zone={name:'finance',title:'Zone 2 · Finance',color:'#9B0056'};
 const g=geometry([set(component('a'),'metadata.labels',{'stackledger/zone':'finance'}),component('b'),journey('ship',['a','b']),set(positions({a:[0,0],b:[4,0]}),'spec.zones',[zone])]);
 for(const theme of Object.values(themes)){
  const doc=parseSvg(renderSvg(g,theme));const title=Array.from(doc.getElementsByTagName('text')).find(e=>e.textContent===zone.title)!;
  expect(contrast(title.getAttribute('fill')!,theme.background)).toBeGreaterThanOrEqual(4.5);
 }
});
