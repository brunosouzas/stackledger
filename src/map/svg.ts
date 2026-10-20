/** Render plain geometry as a self-contained, safe SVG. Call renderSvg(geometry, themes.light).
 * Text has one escaping path; geometry has no external resources, IDs, links or CSS.
 * Every visual choice comes from Theme data. Invalid colours/nonfinite geometry throw.
 */
import type { MapGeometry, Marker, Badge } from './layout.js';
import type { Point } from './model.js';
import type { Theme } from './themes.js';
import type { Box } from './labels.js';
import { tag, escapeXml, number, color, type Attributes } from './xml.js';
export { escapeXml } from './xml.js';
export function renderSvg(geometry:MapGeometry,theme:Theme):string{
  const g=geometry,t=theme;
  const text=(value:string,x:number,y:number,attrs:Attributes={})=>tag('text',{x,y,fill:t.text,'font-size':13,...attrs},escapeXml(value));
  const rect=(b:Box,attrs:Attributes={})=>tag('rect',{x:b.x,y:b.y,width:b.w,height:b.h,...attrs});
  const line=(a:Point,b:Point,attrs:Attributes)=>tag('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],...attrs});
  const circle=(p:Point,r:number,attrs:Attributes)=>tag('circle',{cx:p[0],cy:p[1],r,...attrs});
  const shiftBox=(b:Box):Box=>({...b,x:b.x+t.shadow.dx,y:b.y+t.shadow.dy});
  const shift=(p:Point):Point=>[p[0]+t.shadow.dx,p[1]+t.shadow.dy];
  const badge=(b:Badge):string=>[
    t.shadow.enabled?rect(shiftBox(b.box),{fill:t.shadow.color,rx:3}):'',
    rect(b.box,{fill:b.color,rx:3}),text(b.text,b.point[0],b.point[1]+4.5,{fill:t.badgeText,'font-size':12,'font-weight':700,'text-anchor':'middle'})
  ].join('');
  const marker=(m:Marker,muted:boolean,strokeColor:string,shadow=false):string=>{
    const fill=shadow?t.shadow.color:muted?t.muted:t.station,outline=shadow?t.shadow.color:muted?t.muted:t.outline;
    if(m.kind==='interchange')return rect(shadow?shiftBox(m.box):m.box,{fill,stroke:outline,'stroke-width':3,rx:7});
    return line(shadow?shift(m.a):m.a,shadow?shift(m.b):m.b,{stroke:shadow?t.shadow.color:muted?t.muted:strokeColor,'stroke-width':t.lineWidth-1,'stroke-linecap':'butt'});
  };
  const licence=(p:Point,hollow:boolean)=>circle(p,4,{fill:hollow?'none':t.licence,stroke:t.licence,'stroke-width':1.8});
  const title=tag('title',{},'Software map'),description=tag('desc',{},'Software journeys, stations, licences and zones.');
  const background=rect(g.viewBox,{fill:t.background});
  const grid:string[]=[rect(g.frame,{fill:'none',stroke:t.grid,'stroke-width':1})];
  for(let i=1;i<6;i++){const x=g.frame.x+g.frame.w*i/6;grid.push(line([x,g.frame.y],[x,g.frame.y+g.frame.h],{stroke:t.grid,'stroke-width':1}));}
  for(let i=1;i<4;i++){const y=g.frame.y+g.frame.h*i/4;grid.push(line([g.frame.x,y],[g.frame.x+g.frame.w,y],{stroke:t.grid,'stroke-width':1}));}
  const zones=g.zones.map(z=>{
    color(z.color);let shape:string;
    if(z.hull.length===1)shape=circle(z.hull[0]!,z.padding,{fill:z.color});
    else if(z.hull.length===2)shape=line(z.hull[0]!,z.hull[1]!,{stroke:z.color,'stroke-width':z.padding*2,'stroke-linecap':'round'});
    else shape=tag('polygon',{points:z.hull.map(p=>p.map(number).join(',')).join(' '),fill:z.color,stroke:z.color,'stroke-width':z.padding*2,'stroke-linejoin':'round'});
    return tag('g',{opacity:t.zoneOpacity},shape)+text(z.title,z.titleBox.x,z.titleBox.y+13,{fill:z.color,'font-weight':700});
  }).join('');
  const lines=g.lines.map(l=>{
    const d=l.points.map((p,i)=>`${i?'L':'M'}${number(p[0])},${number(p[1])}`).join(' ');
    const path=(stroke:string,width:number)=>tag('path',{d,fill:'none',stroke,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round'});
    return tag('g',{'data-ref':l.ref},tag('title',{},escapeXml(l.title))+(t.casing.enabled?path(t.casing.color,t.lineWidth+t.casing.extraWidth):'')+path(l.color,t.lineWidth));
  }).join('');
  const stations=g.stations.map(s=>{
    const lineColor=g.lines.find(l=>l.ref===s.lines[0])!.color;
    const mark=(t.shadow.enabled?marker(s.marker,s.deprecated,lineColor,true):'')+marker(s.marker,s.deprecated,lineColor);
    const suggested=s.suggested?circle(s.point,18,{fill:'none',stroke:t.muted,'stroke-width':1.5,'stroke-dasharray':'4 3'}):'';
    const ring=s.renewal?circle(s.point,15,{fill:'none',stroke:t.renewal,'stroke-width':3}):'';
    const lic=s.licencePoint?licence(s.licencePoint,s.licence==='hollow'):'';
    return tag('g',{'data-ref':s.ref},tag('title',{},escapeXml(s.title))+suggested+ring+mark+lic);
  }).join('');
  const labels=g.labels.map(label=>{const station=g.stations.find(s=>s.ref===label.ref)!;return label.rows.map((row,i)=>text(row,label.box.x,label.box.y+13+i*17,{fill:station.deprecated?t.muted:t.text,'font-weight':station.lines.length>1?700:500})).join('');}).join('');
  const header=rect({x:g.viewBox.x,y:g.viewBox.y,w:g.viewBox.w,h:64},{fill:t.header})+text('Software map',g.viewBox.x+32,g.viewBox.y+42,{fill:t.headerText,'font-size':29,'font-weight':700})+text(`stackledger · ${g.view} view`,g.viewBox.x+320,g.viewBox.y+40,{fill:t.headerText});
  const panel=g.legend.box;let y=panel.y+28;const legend:string[]=[];
  if(t.shadow.enabled)legend.push(rect(shiftBox(panel),{fill:t.shadow.color,rx:8}));legend.push(rect(panel,{fill:t.panel,rx:8}));legend.push(text('Lines (journeys)',panel.x+18,y,{'font-size':16,'font-weight':700}));y+=30;
  for(const l of g.legend.lines){legend.push(badge({point:[panel.x+28,y-5],box:{x:panel.x+18,y:y-15,w:Math.max(20,l.badge.length*9+6),h:20},text:l.badge,color:l.color}));legend.push(line([panel.x+56,y-5],[panel.x+85,y-5],{stroke:l.color,'stroke-width':t.lineWidth}));legend.push(text(l.title,panel.x+98,y));y+=30;}
  y+=18;legend.push(text('Symbols',panel.x+18,y,{'font-size':16,'font-weight':700}));y+=30;
  for(const symbol of g.legend.symbols){const p:Point=[panel.x+28,y-4];
    if(symbol==='interchange')legend.push(circle(p,7,{fill:t.station,stroke:t.outline,'stroke-width':3}));
    else if(symbol==='licence' || symbol==='licence to buy')legend.push(licence(p,symbol==='licence to buy'));
    else legend.push(circle(p,10,{fill:'none',stroke:symbol==='suggested position'?t.muted:t.renewal,'stroke-width':symbol==='suggested position'?1.5:3,...(symbol==='suggested position'?{'stroke-dasharray':'4 3'}:{})}));
    legend.push(text(symbol[0]!.toUpperCase()+symbol.slice(1),panel.x+52,y));y+=32;
  }
  const empty=g.lines.length?'':text('No journeys yet',g.frame.x+32,g.frame.y+64,{'font-size':22});
  const layers=[background,grid.join(''),zones,lines+g.badges.map(badge).join(''),stations,labels+empty,header,legend.join('')].map(content=>tag('g',{},content)).join('\n');
  return tag('svg',{xmlns:'http://www.w3.org/2000/svg',role:'img',viewBox:[g.viewBox.x,g.viewBox.y,g.viewBox.w,g.viewBox.h].map(number).join(' '),width:g.viewBox.w,height:g.viewBox.h,'font-family':t.font},title+description+'\n'+layers);
}
