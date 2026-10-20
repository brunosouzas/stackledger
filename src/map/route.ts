/** Octilinear routing in grid cells. Call routeMap(model, positions) or routeHop().
 * A stable binary heap, direction state and admissible heuristic bound each hop to 50,000
 * expansions inside its own box plus three cells. Failure is a reported straight segment.
 */
import type { MapModel, Point } from './model.js';
import { octile, pointKey } from './suggest.js';
import { MinHeap } from './heap.js';

export const directions: Point[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export const comparePoints = (a: Point, b: Point): number => a[0] - b[0] || a[1] - b[1];

export const edgeKey = (a: Point, b: Point): string =>
  comparePoints(a, b) < 0 ? `${pointKey(a)}|${pointKey(b)}` : `${pointKey(b)}|${pointKey(a)}`;

export const directionOf = (a: Point, b: Point): number =>
  directions.findIndex(direction => direction[0] === Math.sign(b[0] - a[0]) && direction[1] === Math.sign(b[1] - a[1]));

/** Turn between two direction indices in 45-degree steps (0 to 4). */
const turn = (one: number, two: number): number => Math.min(Math.abs(one - two), 8 - Math.abs(one - two));

interface State { point: Point; direction: number; cost: number; previous: State | undefined }

export interface Route { points: Point[]; unrouted: boolean; expanded: number }
export interface RoutedHop extends Route { from: string; to: string; lines: string[] }
export interface Routes { hops: RoutedHop[]; paths: Map<string, Point[]> }

const STATE_BUDGET = 50000;
const BOX_PADDING = 3;
const REUSED_EDGE_COST = 0.7;
const DIAGONAL_CROSSING_PENALTY = 6;
const TURN_COSTS = [0, 0.35, 1.2];
const STATION_TURN_COSTS = [0, 0.8, 2.5, 9, 9];

const stateKey = (point: Point, direction: number): string => `${pointKey(point)},${direction}`;

export function routeHop(
  from: Point,
  to: Point,
  blocked: ReadonlySet<string>,
  used: ReadonlySet<string> = new Set(),
  preferredFrom: number[] = [],
  preferredTo: number[] = [],
): Route {
  let expanded = 0;
  const fallback = (): Route => ({ points: [from, to], unrouted: true, expanded });
  // A route this long cannot finish within the expansion budget. Avoid allocating typo-sized grids.
  if (Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) >= STATE_BUDGET) return fallback();
  const minX = Math.min(from[0], to[0]) - BOX_PADDING;
  const maxX = Math.max(from[0], to[0]) + BOX_PADDING;
  const minY = Math.min(from[1], to[1]) - BOX_PADDING;
  const maxY = Math.max(from[1], to[1]) + BOX_PADDING;
  const open = new MinHeap<State>();
  const best = new Map<string, number>();
  const end = pointKey(to);
  open.push({ point: from, direction: -1, cost: 0, previous: undefined }, octile(from, to) * REUSED_EDGE_COST);
  while (open.size && expanded < STATE_BUDGET) {
    const current = open.pop()!;
    if ((best.get(stateKey(current.point, current.direction)) ?? Infinity) < current.cost) continue;
    expanded++;
    if (pointKey(current.point) === end) {
      const points: Point[] = [];
      for (let state: State | undefined = current; state; state = state.previous) points.push(state.point);
      return { points: points.reverse(), unrouted: false, expanded };
    }
    for (let direction = 0; direction < 8; direction++) {
      const [dx, dy] = directions[direction]!;
      const next: Point = [current.point[0] + dx, current.point[1] + dy];
      const key = pointKey(next);
      const outside = next[0] < minX || next[0] > maxX || next[1] < minY || next[1] > maxY;
      if (outside || (key !== end && blocked.has(key))) continue;
      const bend = current.direction < 0 ? 0 : turn(current.direction, direction);
      if (bend > 2) continue;
      const edge = edgeKey(current.point, next);
      const diagonal = dx !== 0 && dy !== 0;
      let cost = current.cost + (diagonal ? Math.SQRT2 : 1) * (used.has(edge) ? REUSED_EDGE_COST : 1) + TURN_COSTS[bend]!;
      const crossing = edgeKey([current.point[0] + dx, current.point[1]], [current.point[0], current.point[1] + dy]);
      if (diagonal && used.has(crossing)) cost += DIAGONAL_CROSSING_PENALTY;
      if (current.direction < 0) {
        for (const preferred of preferredFrom) cost += STATION_TURN_COSTS[turn(direction, preferred)]!;
      }
      if (key === end) {
        for (const preferred of preferredTo) cost += STATION_TURN_COSTS[turn(direction, preferred)]!;
      }
      const signature = stateKey(next, direction);
      if ((best.get(signature) ?? Infinity) <= cost) continue;
      best.set(signature, cost);
      open.push({ point: next, direction, cost, previous: current }, cost + octile(next, to) * REUSED_EDGE_COST);
    }
  }
  return fallback();
}

export function routeMap(model: MapModel, positions: Map<string, Point>): Routes {
  const blocked = new Set(model.stations.map(station => pointKey(positions.get(station.ref)!)));
  const used = new Set<string>();
  const hops: RoutedHop[] = [];
  const cache = new Map<string, RoutedHop>();
  const paths = new Map<string, Point[]>();
  const hopKey = (one: string, two: string): string => [one, two].sort().join('|');

  /** Directions of already-routed hops at `at`, so a line can run straight through a station. */
  const preferred = (at: string, other: string, leaving: boolean): number[] => {
    const result: number[] = [];
    for (const line of model.lines) {
      const index = line.stops.indexOf(at);
      if (index < 0) continue;
      for (const neighbour of [line.stops[index - 1], line.stops[index + 1]]) {
        if (!neighbour || neighbour === other) continue;
        const hop = cache.get(hopKey(at, neighbour));
        if (!hop || hop.unrouted || hop.points.length < 2) continue;
        const points = hop.from === at ? hop.points : [...hop.points].reverse();
        const direction = directionOf(points[0]!, points[1]!);
        result.push(leaving ? (direction + 4) % 8 : direction);
      }
    }
    return result;
  };

  for (const line of model.lines) {
    const path: Point[] = [];
    for (let i = 1; i < line.stops.length; i++) {
      const from = line.stops[i - 1]!;
      const to = line.stops[i]!;
      const key = hopKey(from, to);
      let hop = cache.get(key);
      if (!hop) {
        const route = routeHop(positions.get(from)!, positions.get(to)!, blocked, used, preferred(from, to, true), preferred(to, from, false));
        hop = { ...route, from, to, lines: [] };
        cache.set(key, hop);
        hops.push(hop);
        if (!hop.unrouted) {
          for (let j = 1; j < hop.points.length; j++) used.add(edgeKey(hop.points[j - 1]!, hop.points[j]!));
        }
      }
      if (!hop.lines.includes(line.ref)) hop.lines.push(line.ref);
      const points = hop.from === from ? hop.points : [...hop.points].reverse();
      path.push(...(path.length ? points.slice(1) : points));
    }
    paths.set(line.ref, path);
  }
  return { hops, paths };
}
