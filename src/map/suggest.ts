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

/** Rings searched around a target; beyond this a station takes the fallback cell. */
export const SEARCH_RADIUS = 64;

const usable = (x: number, y: number): boolean => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0;

/** Placed or already-suggested stops right before or after any occurrence of `ref` on any line, each once. */
function neighbourPoints(model: MapModel, ref: string, positions: Map<string, Point>): Point[] {
  const neighbours = new Set<string>();
  for (const line of model.lines) {
    line.stops.forEach((stop, index) => {
      if (stop !== ref) return;
      for (const neighbour of [line.stops[index - 1], line.stops[index + 1]]) {
        if (neighbour && neighbour !== ref && positions.has(neighbour)) neighbours.add(neighbour);
      }
    });
  }
  return [...neighbours].map(neighbour => positions.get(neighbour)!);
}

/**
 * Free cell nearest the target by octile distance, ties by smaller row then smaller column.
 * Only cells within SEARCH_RADIUS rings of the target with safe-integer, nonnegative
 * coordinates are tried, so the search always ends; undefined when none is free.
 */
function nearestFreeCell(target: Point, taken: Set<string>): Point | undefined {
  let chosen: Point | undefined;
  let best = Infinity;
  const column = Math.floor(target[0]);
  const row = Math.floor(target[1]);
  // A cell outside the visited square is at least radius units from the target.
  for (let radius = 0; radius <= SEARCH_RADIUS && radius <= best; radius++) {
    for (let dy = -radius; dy <= radius + 1; dy++) {
      for (let dx = -radius; dx <= radius + 1; dx++) {
        const inner = dx > -radius && dx < radius + 1 && dy > -radius && dy < radius + 1;
        if (radius && inner) continue;
        const x = column + dx;
        const y = row + dy;
        if (!usable(x, y) || taken.has(pointKey([x, y]))) continue;
        const distance = octile([x, y], target);
        const tie = chosen && Math.abs(distance - best) < 1e-9 && (y < chosen[1] || (y === chosen[1] && x < chosen[0]));
        if (distance < best - 1e-9 || tie) {
          best = distance;
          chosen = [x, y];
        }
      }
    }
  }
  return chosen;
}

/** Fallback: the free cell in row 0 with the smallest column. Ends because `taken` is finite. */
function firstFreeInRowZero(taken: Set<string>): Point {
  let column = 0;
  while (taken.has(`${column},0`)) column++;
  return [column, 0];
}

export function suggestPositions(model: MapModel): { positions: Map<string, Point>; suggestions: Suggestion[] } {
  const positions = new Map([...model.positions].map(([ref, point]) => [ref, [...point] as Point]));
  const taken = new Set(model.occupied.map(pointKey));
  const suggestions: Suggestion[] = [];
  let maxColumn = model.occupied.reduce((largest, point) => Math.max(largest, point[0]), -1);
  for (const station of model.stations) {
    if (positions.has(station.ref)) continue;
    const neighbours = neighbourPoints(model, station.ref, positions);
    let chosen: Point | undefined;
    if (neighbours.length) {
      const target: Point = [
        neighbours.reduce((sum, point) => sum + point[0], 0) / neighbours.length,
        neighbours.reduce((sum, point) => sum + point[1], 0) / neighbours.length,
      ];
      chosen = nearestFreeCell(target, taken);
    } else if (usable(maxColumn + 1, 0) && !taken.has(`${maxColumn + 1},0`)) {
      chosen = [maxColumn + 1, 0];
    }
    chosen ??= firstFreeInRowZero(taken);
    taken.add(pointKey(chosen));
    positions.set(station.ref, chosen);
    maxColumn = Math.max(maxColumn, chosen[0]);
    suggestions.push({ ref: station.ref, point: chosen });
  }
  return { positions, suggestions };
}
