/** Assign missing stations without moving stored points. Call suggestPositions(model).
 * Local octile search expands only around the target, including far-away stored coordinates.
 * All stored cells stay reserved; suggestions never modify the model or catalogue.
 */
import type { MapModel, Point } from './model.js';
export const pointKey = (point: Point): string => point.join(',');
export const octile = (a: Point,b: Point): number => { const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1]); return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy); };
export interface Suggestion { ref: string; point: Point }
export function suggestPositions(model: MapModel): { positions: Map<string,Point>; suggestions: Suggestion[] } {
  const positions = new Map([...model.positions].map(([ref,p])=>[ref,[...p] as Point]));
  const taken = new Set(model.occupied.map(pointKey)), suggestions:Suggestion[]=[];
  let maxColumn = Math.max(-1,...model.occupied.map(p=>p[0]));
  for (const station of model.stations) {
    if (positions.has(station.ref)) continue;
    const neighbours = new Set<string>();
    for(const line of model.lines) {
      const i=line.stops.indexOf(station.ref); if(i<0)continue;
      for(const ref of [line.stops[i-1],line.stops[i+1]])if(ref && positions.has(ref))neighbours.add(ref);
    }
    let chosen:Point=[maxColumn+1,0];
    if(neighbours.size) {
      const points=[...neighbours].map(ref=>positions.get(ref)!);
      const target:Point=[points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];
      let best=Infinity;
      const c=Math.floor(target[0]),r=Math.floor(target[1]);
      // A cell outside the visited square is at least radius units from the target.
      for(let radius=0;radius<=best;radius++) {
        for(let y=Math.max(0,r-radius);y<=r+radius+1;y++)for(let x=Math.max(0,c-radius);x<=c+radius+1;x++) {
          if(radius && x>c-radius && x<c+radius+1 && y>r-radius && y<r+radius+1)continue;
          const point:Point=[x,y]; if(taken.has(pointKey(point)))continue;
          const distance=octile(point,target);
          if(distance<best-1e-9 || (Math.abs(distance-best)<1e-9 && (y<chosen[1] || (y===chosen[1] && x<chosen[0])))){best=distance;chosen=point;}
        }
      }
    }
    taken.add(pointKey(chosen));positions.set(station.ref,chosen);maxColumn=Math.max(maxColumn,chosen[0]);suggestions.push({ref:station.ref,point:chosen});
  }
  return {positions,suggestions};
}
