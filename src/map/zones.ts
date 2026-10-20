/** Convex zone hulls, in declaration order. Call zoneGeometry(model, station points).
 * Widening is a 32-unit round stroke around the convex hull, including one/two-point hulls.
 * Zone title boxes are layout obstacles; zones without drawn members are omitted.
 */
import type { MapModel, Point, MapZone } from './model.js';
import { textWidth, type Box } from './labels.js';
export interface ZoneGeometry extends MapZone { hull:Point[];padding:number;titleBox:Box }
export function convexHull(points:Point[]):Point[]{
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0] || a[1]-b[1]);if(sorted.length<3)return sorted;
  const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=(ps:Point[])=>{const out:Point[]=[];for(const p of ps){while(out.length>1 && cross(out.at(-2)!,out.at(-1)!,p)<=0)out.pop();out.push(p);}return out.slice(0,-1);};
  return [...half(sorted),...half([...sorted].reverse())];
}
export function zoneGeometry(model:MapModel,points:Map<string,Point>):ZoneGeometry[]{
  return model.zones.flatMap(zone=>{
    const members=model.stations.filter(s=>s.zone===zone.name.toLowerCase()).map(s=>points.get(s.ref)!);if(!members.length)return [];
    const hull=convexHull(members),left=Math.min(...members.map(p=>p[0]))-24,top=Math.min(...members.map(p=>p[1]))-56;
    return [{...zone,hull,padding:32,titleBox:{x:left,y:top,w:textWidth(zone.title),h:17}}];
  });
}
