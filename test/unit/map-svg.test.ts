/** Parse real SVG with an independently pinned XML parser; allow-lists copied from the spec.
 * Run npm test. Differential catalogues prove the hidden/date paths actually affect full output.
 */
import { test, expect } from 'vitest';
import { renderSvg, renderSymbol, escapeXml } from '../../src/map/svg.js';
import { themes, inkOf } from '../../src/map/themes.js';
import { labelCandidates, overlapArea, placeLabels, textWidth } from '../../src/map/labels.js';
import { tag } from '../../src/map/xml.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap, inkBox } from '../../src/map/layout.js';
import { component, journey, positions, set, viewOf } from './map-helpers.js';
import { licence, settings, checkFiles } from './helpers.js';
import { applyView, resolveHidden } from '../../src/views.js';
import { attributes, parseSvg, safe } from './svg-helpers.js';
import { tokens } from '@brunosouzas/design-system/tokens';
// The only attributes that may carry catalogue text (Safe SVG text).
const textAttributes=new Set(['data-ref','data-line','data-zone']);
const docs=()=>[component('a'),component('b'),journey('ship',['a','b']),positions({a:[0,0],b:[4,0]})];
const geometry=(documents=docs(),view:'full'|'staff'='full',date='2027-06-01')=>layoutMap(buildMapModel(viewOf(documents,view),date));
test('No lines',()=>{const doc=safe(renderSvg(geometry([]),themes.light));expect(doc.documentElement.textContent).toContain('No journeys yet');});
test('Allowed names only',()=>{const g=geometry(),doc=safe(renderSvg(g,themes.light));const refs=Array.from(doc.getElementsByTagName('*')).map(e=>e.getAttribute('data-ref')).filter(Boolean);expect(refs.sort()).toEqual(['component:a','component:b','line:ship']);expect(doc.getElementsByTagName('title').length).toBe(4);});
const hostile='<script>&"\' ]]> javascript: \u0001 \uFFFE';
function hostileGeometry(){const g=geometry();g.stations[0]!.title=hostile;g.lines[0]!.title=hostile;g.legend.lines[0]!.title=hostile;g.zones.push({name:'zone',title:hostile,color:'#ABCDEF',hull:[[0,0],[256,0]],padding:32,titleBox:{x:0,y:-60,w:200,h:17}});return g;}
test('Hostile titles through the real pipeline',()=>{
 const long=`${hostile} Northwind Customer Relationship Manager`;
 const docs=[set(set(component('a'),'metadata.title',long),'metadata.labels',{'stackledger/zone':'zone'}),component('b'),set(journey('ship',['a','b']),'metadata.title',hostile),set(positions({a:[0,0],b:[4,0]}),'spec.zones',[{name:'zone',title:hostile,color:'#ABCDEF'}])];
 const g=geometry(docs);
 expect(g.lines).toHaveLength(1);expect(g.zones).toHaveLength(1);{const rows=g.labels.find(l=>l.ref==='component:a')!.rows;expect(rows.length).toBeGreaterThan(2);for(const row of rows)expect(row).not.toMatch(/…$/);}
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
test('Long title keeps full station title',()=>{const full='Northwind Customer Relationship Manager';const g=geometry([set(component('a'),'metadata.title',full),...docs().slice(1)]);const doc=parseSvg(renderSvg(g,themes.light));const station=Array.from(doc.getElementsByTagName('g')).find(e=>e.getAttribute('data-ref')==='component:a')!;expect(station.getElementsByTagName('title')[0]!.textContent).toBe(full);expect(g.labels.find(l=>l.ref==='component:a')!.rows).toEqual(['Northwind Customer','Relationship','Manager']);});
test('Dark theme',()=>{const g=geometry(),svg=renderSvg(g,themes.dark);expect(themes.dark.background).toBe('#14215A');expect(svg).toContain(`fill="${themes.dark.background}"`);expect(svg).toContain('stroke="#FF0000"');expect(svg).not.toBe(renderSvg(g,themes.light));});
test('Themes are data, with casing and offset shadows on in both themes',()=>{
 for(const t of Object.values(themes)){expect(t.casing).toMatchObject({enabled:true,color:INK});expect(t.casing.extraWidth).toBeGreaterThan(0);expect(t.shadow.enabled).toBe(true);expect(t.shadow.dx).toBeGreaterThan(0);expect(t.shadow.dy).toBeGreaterThan(0);expect(t.outline).toBe(INK);expect(t.font).toBe('Lato, Helvetica Neue, Helvetica, Arial, sans-serif');}
 expect(themes.light.shadow.color).toBe(INK);expect(themes.dark.shadow.color).toBe('#4C5CB8');
});
// metro-map "Design system tokens".
test('Theme values are the tokens',()=>{
 const d=tokens.surface.dark,t=themes.dark;
 expect(t.surface).toBe('dark');expect(t.background).toBe(d.background);expect(t.shadow.color).toBe(d.shadow);expect(t.rim.width).toBe(d.rimWidth);
 expect(t.outlineWidth).toBe(tokens.map.outline);expect(t.lineWidth).toBe(tokens.map.lineWidth);expect(t.bendRadius).toBe(tokens.map.bendRadius);
 expect([t.text,t.muted,t.grid,t.panel,t.rim.color]).toEqual([d.text,d.muted,d.grid,d.panel,d.rim]);
 expect([t.casing.extraWidth,t.shadow.dx,t.shadow.dy]).toEqual([tokens.map.casing,tokens.map.shadow,tokens.map.shadow]);
 expect([t.outline,t.station,t.badgeText,t.licence,t.renewal,t.accent]).toEqual([tokens.color.ink,tokens.color.white,tokens.color.white,tokens.color.healthy,tokens.color.blocked,tokens.color.caller]);
});
// metro-map "Piece colours in the themes".
test('Piece colours are the tokens',()=>{
 const t=themes.dark;
 expect([t.licence,t.renewal,t.zoneOpacity,t.zoneTitleTint]).toEqual([tokens.color.healthy,tokens.color.blocked,tokens.surface.dark.zoneOpacity,tokens.map.zoneTitleTint]);
});
test('Light zone titles are not tinted',()=>{
 expect(themes.light.zoneTitleTint).toBe(0);expect(themes.light.zoneOpacity).toBe(tokens.surface.light.zoneOpacity);
});
test('Light theme has no rim',()=>{
 expect(tokens.surface.light.rimWidth).toBe(0);expect(themes.light.rim.enabled).toBe(false);expect(inkOf(themes.light).outline).toBe(tokens.map.outline);
});
// metro-map "Theme ink comes from the design system".
test('Custom ink is refused',()=>{
 const wide=structuredClone(themes.light);wide.outlineWidth=9;
 expect(()=>renderSvg(geometry(),wide)).toThrow(/outlineWidth/);
 const flat=structuredClone(themes.light);flat.shadow.enabled=false;
 expect(()=>renderSvg(geometry(),flat)).toThrow(/shadow/);
 // Same values in another key order are the same ink; a changed value is not.
 const reordered={...themes.dark,shadow:{dy:themes.dark.shadow.dy,dx:themes.dark.shadow.dx,color:themes.dark.shadow.color,enabled:true}};
 expect(()=>renderSvg(geometry(),reordered)).not.toThrow();
 expect(()=>renderSvg(geometry(),{...reordered,shadow:{...reordered.shadow,color:'#4C5CB9'}})).toThrow(/shadow/);
});
test('Custom piece colour is refused',()=>{
 const g=geometry([set(component('a'),'metadata.labels',{'stackledger/zone':'finance'}),component('b'),journey('ship',['a','b']),set(positions({a:[0,0],b:[4,0]}),'spec.zones',[{name:'finance',title:'Finance',color:'#9B0056'}])]);
 const opaque=structuredClone(themes.light);opaque.zoneOpacity=0.5;
 const amber=structuredClone(themes.light);amber.licence='#FFD25A';
 expect(()=>renderSvg(g,opaque)).toThrow(/zoneOpacity/);expect(()=>renderSymbol('licence',opaque)).toThrow(/zoneOpacity/);
 expect(()=>renderSvg(g,amber)).toThrow(/licence/);expect(()=>renderSymbol('licence',amber)).toThrow(/licence/);
 for(const field of ['renewal','zoneTitleTint'] as const){const t=structuredClone(themes.dark) as any;t[field]=field==='renewal'?'#000000':0;expect(()=>renderSvg(g,t)).toThrow(new RegExp(field));}
});
test('Custom bend radius is refused',()=>{
 const t=structuredClone(themes.light);t.bendRadius=16;
 expect(()=>renderSvg(geometry(),t)).toThrow(/bendRadius/);
});
test('Other theme fields stay free',()=>{
 const t=structuredClone(themes.light);t.background='#FFFFFF';
 expect(renderSvg(geometry(),t)).toContain('fill="#FFFFFF"');expect(renderSvg(geometry(),t)).not.toContain(`fill="${themes.light.background}"`);
});
const INK='#0A1033';
// Two lines through `slack` make it an interchange; `a` and `b` stay ticks.
const interchangeDocs=()=>[component('a'),component('b'),component('slack'),journey('ship',['a','slack']),journey('design',['slack','b']),positions({a:[0,0],slack:[4,0],b:[8,0]})];
const groupOf=(doc:Document,ref:string)=>Array.from(doc.getElementsByTagName('g')).find(e=>e.getAttribute('data-ref')===ref)!;
const shapes=(group:Element)=>Array.from(group.childNodes).filter((n:any)=>n.nodeType===1&&n.tagName!=='title') as Element[];
const num=(e:Element,name:string)=>Number(e.getAttribute(name));

test('Pipe line',()=>{
 for(const theme of Object.values(themes)){
  const doc=safe(renderSvg(geometry(),theme)),paths=shapes(groupOf(doc,'line:ship'));
  expect(paths.map(p=>p.getAttribute('stroke'))).toEqual([INK,'#FF0000']);
  expect(paths[0]!.getAttribute('d')).toBe(paths[1]!.getAttribute('d'));
  expect(num(paths[0]!,'stroke-width')).toBeGreaterThan(num(paths[1]!,'stroke-width'));
  expect(paths[0]!.getAttribute('stroke-linecap')).toBe('round');
  // Banner pipes: a thick line inside a clearly wider ink stroke, rounded at ends and corners.
  expect(num(paths[1]!,'stroke-width')).toBeGreaterThanOrEqual(12);
  expect(num(paths[0]!,'stroke-width')-num(paths[1]!,'stroke-width')).toBeGreaterThanOrEqual(6);
  for(const p of paths)expect(p.getAttribute('stroke-linejoin')).toBe('round');
 }
});

test('Stations are circles',()=>{
 for(const theme of Object.values(themes)){
  const g=geometry(interchangeDocs()),doc=safe(renderSvg(g,theme)),outer=theme.lineWidth+theme.casing.extraWidth;
  const stop=shapes(groupOf(doc,'component:a'));
  expect(stop.some(e=>e.tagName==='line')).toBe(false);
  const circles=stop.filter(e=>e.tagName==='circle'),face=circles.at(-1)!;
  expect(circles[0]!.getAttribute('fill')).toBe(theme.shadow.color);
  expect(face.getAttribute('fill')).toBe('#FFFFFF');expect(face.getAttribute('stroke')).toBe(INK);
  // The circle is wider than the pipe it sits on, and centred on it.
  expect(2*num(face,'r')).toBeGreaterThan(outer);
  const a=g.stations.find(s=>s.name==='a')!;expect([num(face,'cx'),num(face,'cy')]).toEqual(a.marker.contacts[0]);
  // An interchange is a capsule round the segment `ends`, larger than a stop, containing every contact.
  const s=g.stations.find(s=>s.name==='slack')!,cap=shapes(groupOf(doc,'component:slack')).filter(e=>e.getAttribute('fill')==='#FFFFFF').at(-1)!;
  expect(s.marker.radius).toBeGreaterThan(num(face,'r'));
  const r=Math.round(s.marker.radius*100)/100;
  if(cap.tagName==='circle')expect(num(cap,'r')).toBe(r);else expect(cap.getAttribute('d')).toContain(`A${r},${r}`);
  for(const p of s.marker.contacts)expect(toSegment(p,s.marker.ends[0],s.marker.ends[1])).toBeLessThanOrEqual(s.marker.radius+1e-6);
 }
});

/** Distance from p to the segment a-b. */
const toSegment=(p:number[],a:number[],b:number[])=>{const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,len=dx*dx+dy*dy;const t=len?Math.max(0,Math.min(1,((p[0]!-a[0]!)*dx+(p[1]!-a[1]!)*dy)/len)):0;return Math.hypot(p[0]!-a[0]!-t*dx,p[1]!-a[1]!-t*dy);};

test('Diagonal interchange contains every contact',()=>{
 // Eight lines share the diagonal from a to b: the drawn capsule must contain all eight contacts at a.
 const names=['l1','l2','l3','l4','l5','l6','l7','l8'];
 const docs8=[component('a'),component('b'),...names.map(n=>journey(n,['a','b'])),positions({a:[0,0],b:[4,4]})];
 for(const theme of Object.values(themes)){
  const g=layoutMap(buildMapModel(viewOf(docs8),'2027-06-01'),theme.lineWidth,inkOf(theme));
  const s=g.stations.find(x=>x.name==='a')!;expect(s.marker.contacts).toHaveLength(8);
  const doc=safe(renderSvg(g,theme)),face=shapes(groupOf(doc,'component:a')).filter(e=>e.getAttribute('fill')==='#FFFFFF').at(-1);
  expect(face).toBeDefined();
  let inside:(p:number[])=>boolean;
  if(face!.tagName==='rect'){
   // An axis-aligned capsule: radius rx around the segment through the rect's long axis.
   const x=num(face!,'x'),y=num(face!,'y'),w=num(face!,'width'),h=num(face!,'height'),r=num(face!,'rx');
   const a=w>=h?[x+r,y+h/2]:[x+w/2,y+r],b=w>=h?[x+w-r,y+h/2]:[x+w/2,y+h-r];
   inside=p=>toSegment(p,a,b)<=r+1e-6;
  }else{
   const {ends,radius}=s.marker as any;
   const r=Math.round(radius*100)/100;expect(face!.getAttribute('d')).toContain(`A${r},${r}`);
   inside=p=>toSegment(p,ends[0],ends[1])<=radius+1e-6;
  }
  for(const p of s.marker.contacts)expect(inside(p),JSON.stringify(p)).toBe(true);
 }
});

test('One-character badge',()=>{
 const g=geometry();expect(g.badges.map(b=>b.text)).toEqual(['S','S']);
 const doc=safe(renderSvg(g,themes.light));
 for(const badge of g.badges){
  expect(badge.box.w).toBeGreaterThan(badge.box.h);
  const face=Array.from(doc.getElementsByTagName('rect')).find(r=>num(r,'x')===badge.box.x&&num(r,'y')===badge.box.y&&r.getAttribute('stroke')===INK)!;
  expect(num(face,'rx')).toBe(badge.box.h/2);
 }
});

test('Bundled pipes fit side by side',()=>{
 // Two lines over the same edge: their colours never overlap and the ink between them stays visible.
 const docs2=[component('a'),component('b'),journey('ship',['a','b']),journey('design',['a','b']),positions({a:[0,0],b:[4,0]})];
 for(const theme of Object.values(themes)){
  const g=layoutMap(buildMapModel(viewOf(docs2),'2027-06-01'),theme.lineWidth,inkOf(theme));
  const [one,two]=g.lines;const gap=Math.abs(one!.points[0]![1]-two!.points[0]![1]);
  expect(gap).toBeGreaterThanOrEqual(theme.lineWidth+theme.casing.extraWidth/2);
 }
});

test('Shadow under an interchange',()=>{
 const g=geometry(interchangeDocs()),svg=renderSvg(g,themes.light),doc=safe(svg);
 const marker=g.stations.find(s=>s.name==='slack')!.marker;expect(marker.kind).toBe('interchange');
 const parts=shapes(groupOf(doc,'component:slack'));
 // The face is drawn last: white with the ink outline; the shadow copy comes right before it, moved by the offset.
 const face=parts.at(-1)!,shadow=parts.at(-2)!;
 expect(face.getAttribute('fill')).toBe('#FFFFFF');expect(face.getAttribute('stroke')).toBe(INK);
 expect(num(face,'stroke-width')).toBe(themes.light.outlineWidth);
 expect(shadow.getAttribute('fill')).toBe(INK);expect(shadow.tagName).toBe(face.tagName);
 const start=(e:Element)=>e.tagName==='circle'?[num(e,'cx'),num(e,'cy')]:e.getAttribute('d')!.slice(1).split(' ')[0]!.split(',').map(Number);
 const [fx,fy]=start(face),[sx,sy]=start(shadow);
 expect(sx!-fx!).toBeCloseTo(themes.light.shadow.dx,1);expect(sy!-fy!).toBeCloseTo(themes.light.shadow.dy,1);
 expect(marker.box.x).toBeLessThanOrEqual(Math.min(...marker.contacts.map(p=>p[0])));
 // Stops start with their shadow; badges are pills holding a shadow copy before their outlined face.
 const stop=shapes(groupOf(doc,'component:a'));expect(stop[0]!.getAttribute('fill')).toBe(INK);expect(stop[0]!.tagName).toBe('circle');
 const badges=Array.from(doc.getElementsByTagName('g')).filter(e=>e.getAttribute('data-line')&&!e.getAttribute('data-ref')&&shapes(e).length===3&&shapes(e)[2]!.tagName==='text');
 expect(badges.length).toBeGreaterThanOrEqual(4);
 for(const badge of badges){const [shade,face]=shapes(badge);expect(shade!.getAttribute('fill')).toBe(INK);expect(face!.getAttribute('stroke')).toBe(INK);expect(num(shade!,'x')-num(face!,'x')).toBe(themes.light.shadow.dx);expect(num(face!,'rx')).toBe(num(face!,'height')/2);}
 expect(svg).not.toMatch(/transform|filter/);
});

test('Dark shadow and rim',()=>{
 const svg=renderSvg(geometry(interchangeDocs()),themes.dark),doc=safe(svg);
 expect(svg).toContain('fill="#4C5CB8"');expect(svg).toContain('stroke="#EEF2FF"');expect(svg).not.toMatch(/transform|filter/);
 // Ink stays the outline and casing; apart from the title band no shape is filled with it.
 for(const e of Array.from(doc.getElementsByTagName('*')))if(e.tagName!=='rect'||num(e,'height')!==64)expect(e.getAttribute('fill'),e.tagName).not.toBe(INK);
 const marker=shapes(groupOf(doc,'component:slack')).filter(e=>e.tagName!=='text');
 expect(marker.map(e=>e.getAttribute('fill'))).toEqual(['#4C5CB8','#EEF2FF','#FFFFFF']);
});

test('Light theme',()=>{
 const doc=safe(renderSvg(geometry(interchangeDocs()),themes.light));
 expect(shapes(doc.documentElement.getElementsByTagName('g')[0]!)[0]!.getAttribute('fill')).toBe('#EEF2FF');
 const font=doc.documentElement.getAttribute('font-family')!;expect(font.startsWith('Lato')).toBe(true);expect(font.endsWith('sans-serif')).toBe(true);
 const labels=Array.from(doc.getElementsByTagName('text')).filter(e=>e.getAttribute('data-line'));
 expect(labels.length).toBeGreaterThanOrEqual(3);
 for(const label of labels)expect(num(label,'font-weight')).toBeGreaterThanOrEqual(700);
});

test('Larger ink pushes a label out',()=>{
 // A marker just above-right of the label's first candidate: clear of its plain box, inside its ink.
 const station={ref:'component:a',title:'abc',lines:['line:x'],point:[0,0] as [number,number],marker:{box:{x:-5,y:-5,w:10,h:10}}};
 const right=labelCandidates([0,0],textWidth('abc'),17,15)[0]!;
 const neighbour={x:right.x-2,y:right.y-11,w:10,h:10};
 expect(placeLabels([station],[neighbour])[0]!.box).toEqual(right);
 const ink=inkOf(themes.light),grown=inkBox(neighbour,ink);
 expect(grown).toEqual({x:neighbour.x-ink.outline/2,y:neighbour.y-ink.outline/2,w:10+ink.outline+ink.shadow[0],h:10+ink.outline+ink.shadow[1]});
 const placed=placeLabels([station],[grown])[0]!.box;
 expect(placed).not.toEqual(right);expect(overlapArea(placed,grown)).toBe(0);
 // layoutMap grows marker obstacles by the ink it is given.
 const inked=layoutMap(buildMapModel(viewOf(interchangeDocs()),'2027-06-01'),7,ink);
 for(const label of inked.labels)for(const s of inked.stations)expect(overlapArea(label.box,inkBox(s.marker.box,ink)),label.ref+' '+s.ref).toBe(0);
});

test('Larger ink pushes a label out in the layout',()=>{
 // The same catalogue laid out with and without a deep shadow: the shadow alone moves a's label.
 const docs3=[set(component('a'),'metadata.title','ab'),set(component('b'),'metadata.title','ab'),component('c'),component('d'),journey('one',['a','c']),journey('two',['b','d']),positions({a:[0,0],c:[0,6],b:[1,1],d:[7,1]})];
 const model=buildMapModel(viewOf(docs3),'2027-06-01');
 const flat={casing:6,outline:3,shadow:[0,0] as [number,number]},deep={casing:6,outline:3,shadow:[9,9] as [number,number]};
 const plain=layoutMap(model,12,flat).labels.find(l=>l.ref==='component:a')!.box;
 const g=layoutMap(model,12,deep),inked=g.labels.find(l=>l.ref==='component:a')!.box;
 const a=g.stations.find(s=>s.name==='a')!;
 // Without growth the plain spot would be kept: it clears the marker but not its shadow.
 expect(overlapArea(plain,a.marker.box)).toBe(0);
 expect(overlapArea(plain,inkBox(a.marker.box,deep))).toBeGreaterThan(0);
 expect(inked).not.toEqual(plain);
 for(const s of g.stations)expect(overlapArea(inked,inkBox(s.marker.box,deep)),s.ref).toBe(0);
});

test('No embedded font',()=>{
 for(const theme of Object.values(themes)){const svg=renderSvg(geometry(interchangeDocs()),theme);expect(svg).toContain(`font-family="${theme.font}"`);expect(svg).not.toMatch(/@font-face|url\(|base64|woff/i);}
});

test('Same input, same SVG in both themes',()=>{
 for(const theme of Object.values(themes))expect(renderSvg(geometry(interchangeDocs()),theme)).toBe(renderSvg(geometry(interchangeDocs()),theme));
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
 // The legend's line sample is a pipe: its colour path starts at the first point of its `d`.
 const start=(e:Element)=>Number(/^M(-?[\d.]+),/.exec(e.getAttribute('d')!)![1]);
 const sample=Array.from(doc.getElementsByTagName('path')).find(e=>e.getAttribute('stroke')==='#FF0000'&&start(e)>=g.legend.box.x)!;
 const mapBadge=g.badges[0]!.box;expect(Number(badge.getAttribute('width'))).toBe(mapBadge.w);
 expect(start(sample)).toBeGreaterThan(Number(badge.getAttribute('x'))+Number(badge.getAttribute('width')));
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
test('Hostile titles in data attributes',()=>{
 const zoneName='Fin<&\"\'>';
 const docs=[set(set(component('a'),'metadata.title',hostile),'metadata.labels',{'stackledger/zone':zoneName}),component('b'),set(journey('ship',['a','b']),'metadata.title',hostile),set(positions({a:[0,0],b:[4,0]}),'spec.zones',[{name:zoneName,title:hostile,color:'#ABCDEF'}])];
 const g=geometry(docs);expect(g.zones).toHaveLength(1);
 for(const theme of Object.values(themes)){
  const doc=safe(renderSvg(g,theme));
  for(const e of Array.from(doc.getElementsByTagName('*')))for(const a of Array.from(e.attributes))if(!textAttributes.has(a.name))expect(a.value,a.name).not.toMatch(/[<>&"']|script|javascript/i);
  const station=Array.from(doc.getElementsByTagName('g')).find(e=>e.getAttribute('data-ref')==='component:a')!;
  expect(station.getAttribute('data-zone')).toBe(zoneName.toLowerCase());
 }
});
test('Interchange in a zone',()=>{
 const docs=[set(component('xero'),'metadata.labels',{'stackledger/zone':'Finance'}),component('stripe'),component('expensify'),
  journey('invoice',['stripe','xero'],'6'),journey('expenses',['expensify','xero'],'7'),
  set(positions({stripe:[0,0],xero:[3,0],expensify:[3,3]}),'spec.zones',[{name:'Finance',title:'Zone 2 · Finance',color:'#9B0056'}])];
 const g=geometry(docs),doc=safe(renderSvg(g,themes.light));
 const groups=Array.from(doc.getElementsByTagName('g'));
 const station=groups.find(e=>e.getAttribute('data-ref')==='component:xero')!;
 expect(station.getAttribute('data-line')).toBe('line:invoice line:expenses');
 expect(station.getAttribute('data-zone')).toBe('finance');
 // Stations outside a drawn zone carry no data-zone; every stroke, badge and legend entry names its line.
 expect(groups.find(e=>e.getAttribute('data-ref')==='component:stripe')!.hasAttribute('data-zone')).toBe(false);
 expect(groups.find(e=>e.getAttribute('data-ref')==='component:stripe')!.getAttribute('data-line')).toBe('line:invoice');
 for(const ref of ['line:invoice','line:expenses']){
  const strokes=groups.filter(e=>e.getAttribute('data-ref')===ref);expect(strokes).toHaveLength(1);expect(strokes[0]!.getAttribute('data-line')).toBe(ref);
  // Two terminal badges and one legend entry per line, besides the stroke.
  expect(groups.filter(e=>e.getAttribute('data-line')===ref&&!e.hasAttribute('data-ref'))).toHaveLength(3);
 }
});

// Site map page: no title band or legend panel, cropped to the frame; the default output keeps both.
test('Map without title band and legend', () => {
  const g = geometry();
  for (const theme of Object.values(themes)) {
    const bare = renderSvg(g, theme, { chrome: false });
    const doc = safe(bare);
    const texts = Array.from(doc.getElementsByTagName('text')).map(element => element.textContent);
    for (const chromeText of ['Software map', 'stackledger · full view', 'Lines (journeys)', 'Symbols', 'Interchange']) expect(texts).not.toContain(chromeText);
    const { frame } = g;
    expect(doc.documentElement.getAttribute('viewBox')).toBe([frame.x - 16, frame.y - 16, frame.w + 32, frame.h + 32].join(' '));
    // Strokes, stations and labels are all still there.
    expect(bare).toContain('data-ref="component:a"');
    expect(bare).toContain('data-ref="line:ship"');
    const full = renderSvg(g, theme);
    expect(renderSvg(g, theme, {})).toBe(full);
    expect(renderSvg(g, theme, { chrome: true })).toBe(full);
    expect(full).toContain('Lines (journeys)');
  }
});

test('Legend symbols on their own', () => {
  for (const theme of Object.values(themes)) {
    for (const symbol of geometry().legend.symbols) {
      const doc = safe(renderSymbol(symbol, theme));
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 24 24');
      if (symbol !== 'interchange') expect(doc.getElementsByTagName('circle').length, symbol).toBeGreaterThan(0);
    }
  }
});
/** Bounds of a symbol's shape, grown by half its stroke: circles, rects and the capsule path of stationMarker. */
function bounds(e: any): [number, number, number, number] {
  const half = Number(e.getAttribute('stroke-width') ?? 0) / 2;
  const n = (name: string) => Number(e.getAttribute(name));
  if (e.tagName === 'circle') return [n('cx') - n('r') - half, n('cy') - n('r') - half, n('cx') + n('r') + half, n('cy') + n('r') + half];
  if (e.tagName === 'rect') return [n('x') - half, n('y') - half, n('x') + n('width') + half, n('y') + n('height') + half];
  // Capsule: M p1 L p2 A r,r 0 0 0 p3 L p4 A r,r 0 0 0 p1; its axis runs from (p1+p4)/2 to (p2+p3)/2.
  const d = e.getAttribute('d')!, r = Number(/A(-?[\d.]+),/.exec(d)![1]);
  const [p1, p2, p3, p4] = d.replace(/A-?[\d.]+,-?[\d.]+ 0 0 0 /g, 'A ').match(/-?[\d.]+,-?[\d.]+/g)!.map(pair => pair.split(',').map(Number));
  const a = [(p1![0]! + p4![0]!) / 2, (p1![1]! + p4![1]!) / 2], b = [(p2![0]! + p3![0]!) / 2, (p2![1]! + p3![1]!) / 2];
  return [Math.min(a[0]!, b[0]!) - r - half, Math.min(a[1]!, b[1]!) - r - half, Math.max(a[0]!, b[0]!) + r + half, Math.max(a[1]!, b[1]!) + r + half];
}
// metro-map "Legend interchange symbol".
test('Legend interchange is a capsule', () => {
  for (const theme of Object.values(themes)) {
    const doc = safe(renderSymbol('interchange', theme));
    expect(doc.getElementsByTagName('circle')).toHaveLength(0);
    const shapes = Array.from(doc.getElementsByTagName('*')).filter(e => ['circle', 'rect', 'path', 'polygon'].includes(e.tagName));
    const face = shapes.at(-1)!;
    expect(face.tagName).toBe('path');expect(face.getAttribute('stroke')).toBe(INK);
    expect(face.getAttribute('d')!.match(/A/g)).toHaveLength(2);
    const [x0, y0, x1, y1] = bounds(face);expect(y1 - y0).toBeGreaterThan(x1 - x0);
    for (const shape of shapes) {
      const [l, t, r, b] = bounds(shape);
      expect(l, theme.background).toBeGreaterThanOrEqual(0);expect(t, theme.background).toBeGreaterThanOrEqual(0);
      expect(r, theme.background).toBeLessThanOrEqual(24);expect(b, theme.background).toBeLessThanOrEqual(24);
    }
  }
});
// metro-map "Software map unchanged": the example's SVGs must place lines, station markers and labels where the
// 0.2.0 engine did (recorded by test/fixtures/map-0.2.0/record.mjs from the 0.2.0 code), as `stackledger map` and
// the site draw them. Only the painting may differ, so geometry is compared, not bytes.
/** A path `d` with each round bend read back to its corner (metro-map "Software map unchanged"): the two
 * tangent points of an arc are replaced by the intersection of the segment that ends at the first and
 * the segment that starts at the second, written with two decimals as the map writes numbers. */
function unround(d:string):string{
 const parts=[...d.matchAll(/([MLA])([^MLA]*)/g)].map(m=>({op:m[1]!,nums:m[2]!.trim().split(/[ ,]+/).map(Number)}));
 const out:number[][]=[];
 for(let i=0;i<parts.length;i++){
  const next=parts[i+1];
  if(next?.op==='A'){
   const a=out.at(-1)!,t1=parts[i]!.nums.slice(-2),t2=next.nums.slice(-2),b=parts[i+2]!.nums.slice(-2);
   const [rx,ry,rotation,large,sweep]=next.nums;
   expect([rx,rotation,large],d).toEqual([ry,0,0]);
   const len=(x:number,y:number)=>Math.hypot(x,y)||1;
   const u=[(t1[0]!-a[0]!)/len(t1[0]!-a[0]!,t1[1]!-a[1]!),(t1[1]!-a[1]!)/len(t1[0]!-a[0]!,t1[1]!-a[1]!)];
   const v=[(b[0]!-t2[0]!)/len(b[0]!-t2[0]!,b[1]!-t2[1]!),(b[1]!-t2[1]!)/len(b[0]!-t2[0]!,b[1]!-t2[1]!)];
   // The arc is tangent to both segments: the centre found from each tangent point, on the side the sweep flag names, is the same.
   const side=sweep===1?1:-1;
   const c1=[t1[0]!-u[1]!*rx!*side,t1[1]!+u[0]!*rx!*side],c2=[t2[0]!-v[1]!*rx!*side,t2[1]!+v[0]!*rx!*side];
   expect(Math.hypot(c1[0]!-c2[0]!,c1[1]!-c2[1]!),d).toBeLessThan(0.05);
   const den=u[0]!*v[1]!-u[1]!*v[0]!,k=((t2[0]!-a[0]!)*v[1]!-(t2[1]!-a[1]!)*v[0]!)/den;
   out.push([a[0]!+u[0]!*k,a[1]!+u[1]!*k]);i++;continue;
  }
  out.push(parts[i]!.nums.slice(-2));
 }
 const n=(x:number)=>String(Math.round(x*100)/100);
 return out.map((p,i)=>`${i?'L':'M'}${n(p[0]!)},${n(p[1]!)}`).join(' ');
}
function placement(svg:string){
 const doc=parseSvg(svg),groups=Array.from(doc.getElementsByTagName('g'));
 // Every path of a line: its casing and its colour.
 const lines=groups.filter(g=>g.getAttribute('data-ref')?.startsWith('line:')).map(g=>[g.getAttribute('data-ref'),Array.from(g.getElementsByTagName('path')).map(p=>unround(p.getAttribute('d')!))]);
 // A station's outlined face is its last white-or-muted shape with an ink stroke; its centre is cx,cy or the capsule's start.
 const stations=groups.filter(g=>g.getAttribute('data-ref')?.startsWith('component:')).map(g=>{
  // Licence markers (radius 5) and renewal rings (no fill) share the group; they are not the marker.
  const face=Array.from(g.children).filter(e=>['circle','path'].includes(e.tagName)&&e.getAttribute('stroke')==='#0A1033'&&e.getAttribute('fill')!=='none'&&e.getAttribute('r')!=='5').at(-1)!;
  return [g.getAttribute('data-ref'),face.tagName==='circle'?[face.getAttribute('cx'),face.getAttribute('cy'),face.getAttribute('r')]:[face.getAttribute('d')]];
 });
 const labels=Array.from(doc.getElementsByTagName('text')).filter(t=>t.parentElement?.tagName==='g'&&!t.parentElement.getAttribute('data-ref')&&t.getAttribute('data-line')).map(t=>[t.textContent,t.getAttribute('x'),t.getAttribute('y')]);
 return {lines,stations,labels};
}
test('Example map',async()=>{
 const { readFileSync } = await import('node:fs'); const { join } = await import('node:path');
 const { loadFolder } = await import('../../src/source.js'); const { validateLoaded } = await import('../../src/validate.js');
 const { widestInk } = await import('../../src/map/themes.js');
 const fixtures=join(import.meta.dirname,'../fixtures/map-0.2.0');
 const catalogue=validateLoaded(await loadFolder(join(import.meta.dirname,'../../examples/northwind')));
 for(const view of ['full','staff'] as const)for(const name of ['light','dark'] as const)for(const chrome of [true,false]){
  const theme=themes[name],ink=chrome?inkOf(theme):widestInk(inkOf(themes.light),inkOf(themes.dark));
  const served=applyView(catalogue.served,view,resolveHidden(catalogue));
  const svg=renderSvg(layoutMap(buildMapModel(served,'2027-06-01'),chrome?theme.lineWidth:themes.light.lineWidth,ink),theme,{chrome});
  const recorded=placement(readFileSync(join(fixtures,`${view}-${name}${chrome?'':'-site'}.svg`),'utf8')),drawn=placement(svg);
  expect(recorded.stations.length).toBeGreaterThan(10);expect(recorded.labels.length).toBeGreaterThan(10);
  expect(drawn,`${view}-${name}${chrome?'':'-site'}`).toEqual(recorded);
 }
});
// metro-map "A cut label now wraps" and "Software map has no rule count", on the example catalogue.
async function exampleGeometry(title?:string){
 const { join } = await import('node:path');const { loadFolder } = await import('../../src/source.js'); const { validateLoaded } = await import('../../src/validate.js');
 const catalogue=validateLoaded(await loadFolder(join(import.meta.dirname,'../../examples/northwind')));
 let served=applyView(catalogue.served,'full',resolveHidden(catalogue));
 const first=served.components.map(c=>c.metadata.name).sort()[0]!;
 if(title!==undefined)served={...served,components:served.components.map(c=>c.metadata.name===first?{...c,metadata:{...c.metadata,title}}:c)};
 return {first,geometry:layoutMap(buildMapModel(served,'2027-06-01'),themes.light.lineWidth,inkOf(themes.light))};
}
test('A cut label now wraps',async()=>{
 const before=await exampleGeometry(),{first,geometry}=await exampleGeometry('Northwind Customer Relationship Manager');
 expect(geometry.labels.find(l=>l.ref===`component:${first}`)!.rows).toEqual(['Northwind Customer','Relationship','Manager']);
 const texts=Array.from(safe(renderSvg(geometry,themes.light)).getElementsByTagName('text')).map(e=>e.textContent??'');
 for(const text of texts)expect(text).not.toMatch(/…$/);
 const rows=(g:typeof geometry)=>Object.fromEntries(g.labels.filter(l=>l.ref!==`component:${first}`).map(l=>[l.ref,l.rows]));
 expect(rows(geometry)).toEqual(rows(before.geometry));
});
test('Software map has no rule count',async()=>{
 const {geometry}=await exampleGeometry();
 for(const station of geometry.stations)expect(station.ruleCount,station.ref).toBeUndefined();
 expect(geometry.legend.symbols).not.toContain('number of rules');
});
// metro-map "Software lines in a skills map file name": a catalogue file with that name is not read, so its lines are not drawn.
test('Software lines in a skills map file name',async()=>{
 const { folder } = await import('../helpers.js'); const { loadFolder } = await import('../../src/source.js'); const { validateLoaded } = await import('../../src/validate.js');
 const { stringify } = await import('yaml');
 const docs=[component('a'),component('b'),journey('ship',['a','b'])].map(d=>stringify(d));
 const read=async(name:string)=>{const c=validateLoaded(await loadFolder(folder({'items.yaml':docs.slice(0,2).join('---\n'),[name]:docs[2]!})));return layoutMap(buildMapModel(applyView(c.served,'full',resolveHidden(c)),'2027-06-01')).lines.map(l=>l.ref);};
 expect(await read('stackledger-skills.yaml')).toEqual([]);
 expect(await read('lines.yaml')).toEqual(['line:ship']);
});
