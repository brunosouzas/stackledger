/** Allocate strokes per undirected grid edge, then join slots with octilinear connectors.
 * Call parallelLines(model, routes, lineWidth). Catalogue order is never direction dependent.
 * Straight fallbacks remain visible; parallel transitions may cross at interchanges by design.
 */
import type { MapLine, MapModel, Point } from './model.js';
import { comparePoints, edgeKey, type Routes } from './route.js';

export interface OffsetEdge { key: string; a: Point; b: Point; offset: number; normal: Point; gridA: Point; gridB: Point }
export interface Stroke extends MapLine { points: Point[]; edges: OffsetEdge[] }

export const GRID = 64;
const EPSILON = 1e-9;

/** One undirected grid edge: `start` is the end whose coordinates sort first. */
interface SharedEdge { key: string; start: Point; end: Point; refs: string[] }

/** Two edges that every one of their lines uses consecutively through `node`. */
interface BundleLink { from: string; to: string; node: Point }

const samePoint = (one: Point, two: Point): boolean => one[0] === two[0] && one[1] === two[1];

const cross = (one: Point, two: Point): number => one[0] * two[1] - one[1] * two[0];

function unit(from: Point, to: Point): Point {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

function collectEdges(model: MapModel, routes: Routes): Map<string, SharedEdge> {
  const edges = new Map<string, SharedEdge>();
  for (const line of model.lines) {
    const path = routes.paths.get(line.ref)!;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      if (samePoint(a, b)) continue;
      const key = edgeKey(a, b);
      const [start, end] = comparePoints(a, b) < 0 ? [a, b] : [b, a];
      const edge = edges.get(key) ?? { key, start, end, refs: [] };
      if (!edge.refs.includes(line.ref)) edge.refs.push(line.ref);
      edges.set(key, edge);
    }
  }
  return edges;
}

/** Links where a whole bundle turns or continues together: same lines on both edges, all passing through. */
function bundleLinks(model: MapModel, routes: Routes, edges: Map<string, SharedEdge>): BundleLink[] {
  const passing = new Map<string, { link: BundleLink; refs: Set<string> }>();
  for (const line of model.lines) {
    const path = routes.paths.get(line.ref)!;
    for (let i = 1; i + 1 < path.length; i++) {
      const node = path[i]!;
      if (samePoint(path[i - 1]!, node) || samePoint(node, path[i + 1]!)) continue;
      const from = edgeKey(path[i - 1]!, node);
      const to = edgeKey(node, path[i + 1]!);
      if (from === to) continue;
      const [first, second] = from < to ? [from, to] : [to, from];
      const id = `${first}>${second}@${node.join(',')}`;
      const entry = passing.get(id) ?? { link: { from: first, to: second, node }, refs: new Set<string>() };
      entry.refs.add(line.ref);
      passing.set(id, entry);
    }
  }
  const links: BundleLink[] = [];
  for (const id of [...passing.keys()].sort()) {
    const { link, refs } = passing.get(id)!;
    const one = edges.get(link.from)!.refs;
    const two = edges.get(link.to)!.refs;
    const together = one.length > 1 && one.length === two.length && one.length === refs.size && one.every(ref => two.includes(ref) && refs.has(ref));
    if (together) links.push(link);
  }
  return links;
}

/**
 * Left-to-right order of lines on each edge. An edge starts with the spec order (line order,
 * walking from its first-sorting end). A bundle whose lines all continue together onto the next
 * edge keeps each line on the same side through the bend, so the order is carried across instead
 * of being recomputed from that edge's own direction, which would swap sides and cross strokes.
 */
function slotOrders(edges: Map<string, SharedEdge>, links: BundleLink[]): Map<string, string[]> {
  const orders = new Map<string, string[]>();
  const linksByEdge = new Map<string, BundleLink[]>();
  for (const link of links) {
    for (const key of [link.from, link.to]) linksByEdge.set(key, [...(linksByEdge.get(key) ?? []), link]);
  }
  for (const anchor of [...edges.keys()].sort()) {
    if (orders.has(anchor)) continue;
    orders.set(anchor, edges.get(anchor)!.refs);
    const queue = [anchor];
    while (queue.length) {
      const key = queue.shift()!;
      const known = edges.get(key)!;
      for (const link of linksByEdge.get(key) ?? []) {
        const otherKey = link.from === key ? link.to : link.from;
        if (orders.has(otherKey)) continue;
        const other = edges.get(otherKey)!;
        // Walking known -> node -> other: each edge's spec order reads along or against that walk.
        const knownTowardsNode = samePoint(known.end, link.node);
        const otherAwayFromNode = samePoint(other.start, link.node);
        const order = orders.get(key)!;
        orders.set(otherKey, knownTowardsNode === otherAwayFromNode ? order : [...order].reverse());
        queue.push(otherKey);
      }
    }
  }
  return orders;
}

/** Points that join two consecutive offset edges of one line, all segments octilinear. */
function joint(previous: OffsetEdge, next: OffsetEdge): Point[] {
  const along = unit(previous.a, previous.b);
  const onward = unit(next.a, next.b);
  const turn = cross(along, onward);
  const dot = along[0] * onward[0] + along[1] * onward[1];
  if (Math.abs(turn) < EPSILON && dot > 0) {
    // Collinear: a centred 45-degree connector only where the slot changes.
    const shift = Math.hypot(next.a[0] - previous.b[0], next.a[1] - previous.b[1]);
    if (shift < EPSILON) return [];
    const half = shift / 2;
    return [
      [previous.b[0] - along[0] * half, previous.b[1] - along[1] * half],
      [next.a[0] + along[0] * half, next.a[1] + along[1] * half],
    ];
  }
  if (dot > -EPSILON) {
    // A bend of 45 or 90 degrees: mitre at the intersection of the two offset lines.
    const gap: Point = [next.a[0] - previous.b[0], next.a[1] - previous.b[1]];
    const distance = cross(gap, onward) / turn;
    return [[previous.b[0] + along[0] * distance, previous.b[1] + along[1] * distance]];
  }
  // Sharper turns happen only at stations: a diagonal followed by the remaining axis.
  const dx = next.a[0] - previous.b[0];
  const dy = next.a[1] - previous.b[1];
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
  return [previous.b, [previous.b[0] + Math.sign(dx) * diagonal, previous.b[1] + Math.sign(dy) * diagonal], next.a];
}

/** Remove repeated and collinear points, keeping bends and reversals. */
function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && Math.hypot(last[0] - point[0], last[1] - point[1]) < 1e-7) continue;
    while (result.length > 1) {
      const a = result.at(-2)!;
      const b = result.at(-1)!;
      const turn = (b[0] - a[0]) * (point[1] - b[1]) - (b[1] - a[1]) * (point[0] - b[0]);
      const forward = (b[0] - a[0]) * (point[0] - b[0]) + (b[1] - a[1]) * (point[1] - b[1]);
      if (Math.abs(turn) > 1e-7 || forward < 0) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}

export function parallelLines(model: MapModel, routes: Routes, lineWidth = 7): Stroke[] {
  const shared = collectEdges(model, routes);
  const orders = slotOrders(shared, bundleLinks(model, routes, shared));
  return model.lines.map(line => {
    const path = routes.paths.get(line.ref)!;
    const edges: OffsetEdge[] = [];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      if (samePoint(a, b)) continue;
      const edge = shared.get(edgeKey(a, b))!;
      const order = orders.get(edge.key)!;
      const offset = (order.indexOf(line.ref) - (order.length - 1) / 2) * (lineWidth + 1.5);
      const [dx, dy] = unit(edge.start, edge.end);
      const normal: Point = [-dy, dx];
      const move = (point: Point): Point => [point[0] * GRID + normal[0] * offset, point[1] * GRID + normal[1] * offset];
      edges.push({ key: edge.key, a: move(a), b: move(b), offset, normal, gridA: a, gridB: b });
    }
    if (!edges.length) return { ...line, points: [[path[0]![0] * GRID, path[0]![1] * GRID]], edges };
    const points: Point[] = [edges[0]!.a];
    for (let i = 1; i < edges.length; i++) points.push(...joint(edges[i - 1]!, edges[i]!));
    points.push(edges.at(-1)!.b);
    return { ...line, points: compact(points), edges };
  });
}
