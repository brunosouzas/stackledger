/** Allocate strokes per undirected grid edge, then join slots with octilinear connectors.
 * Call parallelLines(model, routes, lineWidth). Catalogue order is never direction dependent.
 * Straight fallbacks remain visible; parallel transitions may cross at interchanges by design.
 */
import type { MapLine, MapModel, Point } from './model.js';
import { comparePoints, edgeKey, type Routes } from './route.js';
export interface OffsetEdge { key:string;a:Point;b:Point;offset:number;normal:Point;gridA:Point;gridB:Point }
export interface Stroke extends MapLine { points:Point[];edges:OffsetEdge[] }
export const GRID=64;
export function parallelLines(model:MapModel,routes:Routes,lineWidth=7):Stroke[]{
  const users=new Map<string,string[]>();
  for(const line of model.lines){const path=routes.paths.get(line.ref)!;for(let i=1;i<path.length;i++){const key=edgeKey(path[i-1]!,path[i]!);const refs=users.get(key)??[];if(!refs.includes(line.ref))refs.push(line.ref);users.set(key,refs);}}
  return model.lines.map(line=>{
    const path=routes.paths.get(line.ref)!,edges:OffsetEdge[]=[];
    const stationCells=new Set(routes.hops.flatMap(h=>[h.points[0]!.join(','),h.points.at(-1)!.join(',')]));
    for(let i=1;i<path.length;i++){
      const a=path[i-1]!,b=path[i]!,key=edgeKey(a,b),refs=users.get(key)!;
      const offset=(refs.indexOf(line.ref)-(refs.length-1)/2)*(lineWidth+1.5);
      const sign=comparePoints(a,b)<0?1:-1,dx=(b[0]-a[0])*sign,dy=(b[1]-a[1])*sign,length=Math.hypot(dx,dy),normal:Point=[-dy/length,dx/length];
      const move=(p:Point):Point=>[p[0]*GRID+normal[0]*offset,p[1]*GRID+normal[1]*offset];
      edges.push({key,a:move(a),b:move(b),offset,normal,gridA:a,gridB:b});
    }
    const points:Point[]=edges.length?[]:[[path[0]![0]*GRID,path[0]![1]*GRID]];
    const append=(p:Point)=>{const last=points.at(-1);if(!last || Math.hypot(last[0]-p[0],last[1]-p[1])>1e-8)points.push(p);};
    for(let i=0;i<edges.length;i++){
      const edge=edges[i]!,length=Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]),unit:Point=[(edge.b[0]-edge.a[0])/length,(edge.b[1]-edge.a[1])/length];
      const previous=edges[i-1],next=edges[i+1];
      const same=(one:OffsetEdge|undefined,two:OffsetEdge)=>one && Math.abs(one.offset-two.offset)<1e-9 && Math.abs(one.normal[0]-two.normal[0])<1e-9 && Math.abs(one.normal[1]-two.normal[1])<1e-9;
      const trimStart=previous && !stationCells.has(edge.gridA.join(',')) && !same(previous,edge)?Math.min(16,length/4):0,trimEnd=next && !stationCells.has(edge.gridB.join(',')) && !same(edge,next)?Math.min(16,length/4):0;
      const start:Point=[edge.a[0]+unit[0]*trimStart,edge.a[1]+unit[1]*trimStart],end:Point=[edge.b[0]-unit[0]*trimEnd,edge.b[1]-unit[1]*trimEnd];
      const last=points.at(-1);
      if(last){const dx=start[0]-last[0],dy=start[1]-last[1],diagonal=Math.min(Math.abs(dx),Math.abs(dy));
        // A diagonal followed by the remaining axis works for every slot change, including diagonal edges.
        append([last[0]+Math.sign(dx)*diagonal,last[1]+Math.sign(dy)*diagonal]);}
      append(start);append(end);
    }
    // Remove collinear grid subdivisions, preserving actual slot changes and bends.
    const compact:Point[]=[];for(const p of points){while(compact.length>1){const a=compact.at(-2)!,b=compact.at(-1)!;if(Math.abs((b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]))>1e-7 || (b[0]-a[0])*(p[0]-b[0])+(b[1]-a[1])*(p[1]-b[1])<0)break;compact.pop();}compact.push(p);}
    return {...line,points:compact,edges};
  });
}
