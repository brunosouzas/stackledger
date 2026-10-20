/** Octilinear routing in grid cells. Call routeMap(model, positions) or routeHop().
 * A stable binary heap, direction state and admissible heuristic bound each hop to 50,000
 * expansions inside its own box plus three cells. Failure is a reported straight segment.
 */
import type { MapModel, Point } from './model.js';
import { octile, pointKey } from './suggest.js';
import { MinHeap } from './heap.js';
export const directions:Point[]=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
export const comparePoints=(a:Point,b:Point):number=>a[0]-b[0] || a[1]-b[1];
export const edgeKey=(a:Point,b:Point):string=>comparePoints(a,b)<0?`${pointKey(a)}|${pointKey(b)}`:`${pointKey(b)}|${pointKey(a)}`;
const turn=(a:number,b:number)=>Math.min(Math.abs(a-b),8-Math.abs(a-b));
export const directionOf=(a:Point,b:Point):number=>directions.findIndex(d=>d[0]===Math.sign(b[0]-a[0]) && d[1]===Math.sign(b[1]-a[1]));
interface State { point:Point;direction:number;cost:number;previous:State|undefined }
export interface Route { points:Point[];unrouted:boolean;expanded:number }
const STATE_BUDGET=50000,BOX_PADDING=3,REUSED_EDGE_COST=0.7,DIAGONAL_CROSSING_PENALTY=6;
const TURN_COSTS=[0,0.35,1.2],STATION_TURN_COSTS=[0,0.8,2.5,9,9];
const stateKey=(p:Point,d:number)=>`${pointKey(p)},${d}`;
export function routeHop(from:Point,to:Point,blocked:ReadonlySet<string>,used:ReadonlySet<string>=new Set(),preferredFrom:number[]=[],preferredTo:number[]=[]):Route {
  let expanded=0;
  const fallback=():Route=>({points:[from,to],unrouted:true,expanded});
  // A route this long cannot finish within the expansion budget. Avoid allocating typo-sized grids.
  if(Math.max(Math.abs(to[0]-from[0]),Math.abs(to[1]-from[1]))>=STATE_BUDGET)return fallback();
  const bounds=[Math.min(from[0],to[0])-BOX_PADDING,Math.max(from[0],to[0])+BOX_PADDING,Math.min(from[1],to[1])-BOX_PADDING,Math.max(from[1],to[1])+BOX_PADDING];
  const open=new MinHeap<State>(),best=new Map<string,number>();
  open.push({point:from,direction:-1,cost:0,previous:undefined},octile(from,to)*REUSED_EDGE_COST);
  const end=pointKey(to);
  while(open.size && expanded<STATE_BUDGET){
    const current=open.pop()!;if((best.get(stateKey(current.point,current.direction))??Infinity)<current.cost)continue;
    expanded++;
    if(pointKey(current.point)===end){const points:Point[]=[];for(let s:State|undefined=current;s;s=s.previous)points.push(s.point);return {points:points.reverse(),unrouted:false,expanded};}
    for(let d=0;d<8;d++){
      const [dx,dy]=directions[d]!,next:Point=[current.point[0]+dx,current.point[1]+dy],key=pointKey(next);
      if(next[0]<bounds[0]! || next[0]>bounds[1]! || next[1]<bounds[2]! || next[1]>bounds[3]! || (key!==end && blocked.has(key)))continue;
      const bend=current.direction<0?0:turn(current.direction,d);if(bend>2)continue;
      const edge=edgeKey(current.point,next);
      let cost=current.cost+(dx && dy?Math.SQRT2:1)*(used.has(edge)?REUSED_EDGE_COST:1)+TURN_COSTS[bend]!;
      if(dx && dy && used.has(edgeKey([current.point[0]+dx,current.point[1]],[current.point[0],current.point[1]+dy])))cost+=DIAGONAL_CROSSING_PENALTY;
      if(current.direction<0)for(const preferred of preferredFrom)cost+=STATION_TURN_COSTS[turn(d,preferred)]!;
      if(key===end)for(const preferred of preferredTo)cost+=STATION_TURN_COSTS[turn(d,preferred)]!;
      const signature=stateKey(next,d);if((best.get(signature)??Infinity)<=cost)continue;
      best.set(signature,cost);open.push({point:next,direction:d,cost,previous:current},cost+octile(next,to)*REUSED_EDGE_COST);
    }
  }
  return fallback();
}
export interface RoutedHop extends Route { from:string;to:string;lines:string[] }
export interface Routes { hops:RoutedHop[];paths:Map<string,Point[]> }
export function routeMap(model:MapModel,positions:Map<string,Point>):Routes {
  const blocked=new Set(model.stations.map(s=>pointKey(positions.get(s.ref)!))),used=new Set<string>();
  const hops:RoutedHop[]=[],cache=new Map<string,RoutedHop>(),paths=new Map<string,Point[]>();
  const hopKey=(a:string,b:string)=>[a,b].sort().join('|');
  const preferred=(at:string,other:string,leaving:boolean):number[]=>{
    const result:number[]=[];
    for(const line of model.lines){const i=line.stops.indexOf(at);if(i<0)continue;for(const nb of [line.stops[i-1],line.stops[i+1]]){
      if(!nb || nb===other)continue;const hop=cache.get(hopKey(at,nb));if(!hop || hop.unrouted || hop.points.length<2)continue;
      const p=hop.from===at?hop.points:[...hop.points].reverse();const d=directionOf(p[0]!,p[1]!);result.push(leaving?(d+4)%8:d);
    }}return result;
  };
  for(const line of model.lines){const path:Point[]=[];
    for(let i=1;i<line.stops.length;i++){
      const from=line.stops[i-1]!,to=line.stops[i]!,key=hopKey(from,to);let hop=cache.get(key);
      if(!hop){hop={...routeHop(positions.get(from)!,positions.get(to)!,blocked,used,preferred(from,to,true),preferred(to,from,false)),from,to,lines:[]};cache.set(key,hop);hops.push(hop);
        if(!hop.unrouted)for(let j=1;j<hop.points.length;j++)used.add(edgeKey(hop.points[j-1]!,hop.points[j]!));}
      if(!hop.lines.includes(line.ref))hop.lines.push(line.ref);
      const points=hop.from===from?hop.points:[...hop.points].reverse();path.push(...(path.length?points.slice(1):points));
    }paths.set(line.ref,path);
  }
  return {hops,paths};
}
