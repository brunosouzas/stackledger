/** Assemble plain map geometry from a model: suggestions, routes, slots, markers and labels.
 * Call layoutMap(buildMapModel(view,date)); no I/O or mutation. Unrouted hops are retained
 * for the CLI to report. Theme-independent points keep stored stations stable.
 */
import type { MapModel, MapStation, MapLine, Point } from './model.js';
import { suggestPositions, type Suggestion } from './suggest.js';
import { routeMap, type RoutedHop } from './route.js';
import { parallelLines, GRID, type Stroke } from './parallel.js';
import { placeLabels, segmentObstacle, textWidth, type Box, type Label, type Obstacle } from './labels.js';
import { zoneGeometry, type ZoneGeometry } from './zones.js';
export interface Marker { kind:'tick'|'interchange';box:Box;contacts:Point[];normal:Point;a:Point;b:Point }
export interface StationGeometry extends MapStation { point:Point;suggested:boolean;marker:Marker }
export interface Badge { point:Point;box:Box;text:string;color:string }
export interface MapGeometry { view:MapModel['view'];stations:StationGeometry[];lines:Stroke[];badges:Badge[];labels:Label[];zones:ZoneGeometry[];suggestions:Suggestion[];unrouted:RoutedHop[];legend:{lines:MapLine[];symbols:string[];box:Box};frame:Box;viewBox:Box }
const bounding=(points:Point[],padding:number):Box=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-padding,y=Math.min(...ys)-padding;return {x,y,w:Math.max(...xs)-x+padding,h:Math.max(...ys)-y+padding};};
export function layoutMap(model:MapModel,lineWidth=7):MapGeometry{
  const {positions,suggestions}=suggestPositions(model),routes=routeMap(model,positions),lines=parallelLines(model,routes,lineWidth);
  const pointMap=new Map([...positions].map(([ref,p])=>[ref,[p[0]*GRID,p[1]*GRID] as Point]));
  const stations:StationGeometry[]=model.stations.map(s=>{
    const point=pointMap.get(s.ref)!,contacts:Point[]=[],normals:Point[]=[];
    for(const line of lines.filter(l=>s.lines.includes(l.ref)))for(const edge of line.edges){if(edge.gridA[0]*GRID===point[0] && edge.gridA[1]*GRID===point[1]){contacts.push(edge.a);normals.push(edge.normal);}if(edge.gridB[0]*GRID===point[0] && edge.gridB[1]*GRID===point[1]){contacts.push(edge.b);normals.push(edge.normal);}}
    if(!contacts.length)contacts.push(point);
    const normal=normals[0]??[0,-1],kind=s.lines.length>1?'interchange':'tick';
    const a=contacts[0]!,b:Point=[a[0]+normal[0]*11,a[1]+normal[1]*11];
    const box=kind==='tick'?bounding([a,b],lineWidth/2):bounding(contacts,7);
    return {...s,point,suggested:suggestions.some(v=>v.ref===s.ref),marker:{kind,box,contacts,normal,a,b}};
  });
  const badges:Badge[]=[];
  for(const line of lines){const p=line.points;
    // A served line can repeat the same stop (a cross-document error). Keep its zero-length journey drawable.
    const first=p[0]!,last=p.at(-1)!;
    for(const [end,inner] of [[first,p[1]??[first[0]+1,first[1]]],[last,p.at(-2)??[last[0]-1,last[1]]]]){
    const dx=end![0]-inner![0],dy=end![1]-inner![1],length=Math.hypot(dx,dy)||1;
    const point:Point=[end![0]+dx/length*26,end![1]+dy/length*26],w=Math.max(20,textWidth(line.badge)+8);
    badges.push({point,text:line.badge,color:line.color,box:{x:point[0]-w/2,y:point[1]-10,w,h:20}});
  }}
  const zones=zoneGeometry(model,pointMap),obstacles:Obstacle[]=[...stations.map(s=>s.marker.box),...badges.map(b=>b.box),...zones.map(z=>z.titleBox)];
  for(const line of lines)for(let i=1;i<line.points.length;i++)obstacles.push(segmentObstacle(line.points[i-1]!,line.points[i]!,lineWidth));
  const labels=placeLabels(stations,obstacles);
  const extent:Point[]=[[0,0],[320,256],...lines.flatMap(l=>l.points)];
  const addBox=(b:Box)=>extent.push([b.x,b.y],[b.x+b.w,b.y+b.h]);
  for(const b of [...labels.map(l=>l.box),...badges.map(b=>b.box),...stations.map(s=>s.marker.box)])addBox(b);
  for(const z of zones){addBox(z.titleBox);addBox(bounding(z.hull,z.padding));}
  const frame=bounding(extent,48);
  const symbols=['interchange','licence','licence to buy','suggested position',...(model.view==='full'?['renewal within 30 days']:[])];
  const legendWidth=Math.max(310,...model.lines.map(l=>textWidth(l.title)+116));
  const legendBox={x:frame.x+frame.w+28,y:frame.y+12,w:legendWidth,h:110+model.lines.length*30+symbols.length*32};
  const viewBox={x:frame.x-16,y:frame.y-88,w:frame.w+legendBox.w+60,h:Math.max(frame.h,legendBox.h+24)+104};
  return {view:model.view,stations,lines,badges,labels,zones,suggestions,unrouted:routes.hops.filter(h=>h.unrouted),legend:{lines:model.lines,symbols,box:legendBox},frame,viewBox};
}
