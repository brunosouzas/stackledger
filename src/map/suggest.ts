/** Assign missing stations without moving stored points. Call suggestPositions(model).
 * Local octile search expands only around the target, including far-away stored coordinates.
 * All stored cells stay reserved; suggestions never modify the model or catalogue.
 */
import type { MapModel, Point } from './model.js';

export interface Suggestion { ref: string; point: Point }

export const pointKey = (point: Point): string => point.join(',');

export const octile = (a: Point, b: Point): number => {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};

/** Placed or already-suggested stops right before or after `ref` on any line, each once. */
function neighbourPoints(model: MapModel, ref: string, positions: Map<string, Point>): Point[] {
  const neighbours = new Set<string>();
  for (const line of model.lines) {
    const index = line.stops.indexOf(ref);
    if (index < 0) continue;
    for (const neighbour of [line.stops[index - 1], line.stops[index + 1]]) {
      if (neighbour && positions.has(neighbour)) neighbours.add(neighbour);
    }
  }
  return [...neighbours].map(neighbour => positions.get(neighbour)!);
}

/** Free cell nearest the target by octile distance, ties by smaller row then smaller column. */
function nearestFreeCell(target: Point, taken: Set<string>, fallback: Point): Point {
  let chosen = fallback;
  let best = Infinity;
  const column = Math.floor(target[0]);
  const row = Math.floor(target[1]);
  // A cell outside the visited square is at least radius units from the target.
  for (let radius = 0; radius <= best; radius++) {
    for (let y = Math.max(0, row - radius); y <= row + radius + 1; y++) {
      for (let x = Math.max(0, column - radius); x <= column + radius + 1; x++) {
        const inner = x > column - radius && x < column + radius + 1 && y > row - radius && y < row + radius + 1;
        if (radius && inner) continue;
        const point: Point = [x, y];
        if (taken.has(pointKey(point))) continue;
        const distance = octile(point, target);
        const tie = Math.abs(distance - best) < 1e-9 && (y < chosen[1] || (y === chosen[1] && x < chosen[0]));
        if (distance < best - 1e-9 || tie) {
          best = distance;
          chosen = point;
        }
      }
    }
  }
  return chosen;
}

export function suggestPositions(model: MapModel): { positions: Map<string, Point>; suggestions: Suggestion[] } {
  const positions = new Map([...model.positions].map(([ref, point]) => [ref, [...point] as Point]));
  const taken = new Set(model.occupied.map(pointKey));
  const suggestions: Suggestion[] = [];
  let maxColumn = Math.max(-1, ...model.occupied.map(point => point[0]));
  for (const station of model.stations) {
    if (positions.has(station.ref)) continue;
    const neighbours = neighbourPoints(model, station.ref, positions);
    let chosen: Point = [maxColumn + 1, 0];
    if (neighbours.length) {
      const target: Point = [
        neighbours.reduce((sum, point) => sum + point[0], 0) / neighbours.length,
        neighbours.reduce((sum, point) => sum + point[1], 0) / neighbours.length,
      ];
      chosen = nearestFreeCell(target, taken, chosen);
    }
    taken.add(pointKey(chosen));
    positions.set(station.ref, chosen);
    maxColumn = Math.max(maxColumn, chosen[0]);
    suggestions.push({ ref: station.ref, point: chosen });
  }
  return { positions, suggestions };
}
