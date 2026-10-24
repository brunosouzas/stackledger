/** Allocate strokes per undirected grid edge, then join slots with octilinear connectors.
 * Call parallelLines(model, routes, lineWidth). Catalogue order is never direction dependent.
 * Straight fallbacks remain visible; parallel transitions may cross at interchanges by design.
 * `points` is the mitred polyline; `path` is the drawn line, where an eligible 45- or 90-degree bend
 * away from stations turns along a circular arc (metro-map: Round bends, Bend candidates, Room for
 * an arc). Every line of a bundle turns around one centre at bendRadius / cos(φ/2) from the node.
 */
import { tokens } from '@brunosouzas/design-system/tokens';
import type { MapLine, MapModel, Point } from './model.js';
import { comparePoints, edgeKey, type Routes } from './route.js';

export interface OffsetEdge { key: string; a: Point; b: Point; offset: number; normal: Point; gridA: Point; gridB: Point }
/** A part of the drawn line: a straight part to `to`, or an arc to `to` around `centre`. */
export interface PathPart { to: Point; arc?: { radius: number; sweep: 0 | 1; centre: Point } }
export interface Stroke extends MapLine { points: Point[]; edges: OffsetEdge[]; path: PathPart[] }
/** Round bends: the bundle's centre-line radius, the full width of a line with its casing, and the
 * grid cells of stations (a bend there stays mitred). Defaults: the design system tokens and the
 * model's stored positions. */
export interface BendOptions { radius?: number; outer?: number; stations?: Point[] }

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

/** A vertex of a line's mitred polyline; `corner` marks the mitre of a 45- or 90-degree bend. */
interface Vertex { point: Point; corner?: Corner }
/** One line's mitre at a bend: its node, directions of travel, centre, signed radius and setback. */
interface Corner { ref: string; bend: string; node: Point; u: Point; v: Point; centre: Point; radius: number; setback: number; sweep: 0 | 1 }

/** Remove repeated and collinear points, keeping bends and reversals. */
function compact(vertices: Vertex[]): Vertex[] {
  const result: Vertex[] = [];
  for (const vertex of vertices) {
    const point = vertex.point;
    const last = result.at(-1);
    if (last && Math.hypot(last.point[0] - point[0], last.point[1] - point[1]) < 1e-7) continue;
    while (result.length > 1) {
      const a = result.at(-2)!.point;
      const b = result.at(-1)!.point;
      const turn = (b[0] - a[0]) * (point[1] - b[1]) - (b[1] - a[1]) * (point[0] - b[0]);
      const forward = (b[0] - a[0]) * (point[0] - b[0]) + (b[1] - a[1]) * (point[1] - b[1]);
      if (Math.abs(turn) > 1e-7 || forward < 0) break;
      result.pop();
    }
    result.push(vertex);
  }
  return result;
}

/** The mitre of a 45- or 90-degree bend between two offset edges (design §1), or undefined. */
function corner(ref: string, previous: OffsetEdge, next: OffsetEdge, radius: number): Corner | undefined {
  const u = unit(previous.a, previous.b);
  const v = unit(next.a, next.b);
  const turn = cross(u, v);
  const dot = u[0] * v[0] + u[1] * v[1];
  if (Math.abs(turn) < EPSILON || dot < -EPSILON) return undefined;
  const half = Math.acos(Math.min(1, dot)) / 2;
  const node: Point = [previous.gridB[0] * GRID, previous.gridB[1] * GRID];
  const inward = unit(u, v);
  const centre: Point = [node[0] + inward[0] * radius / Math.cos(half), node[1] + inward[1] * radius / Math.cos(half)];
  // The incoming edge's normal on the inside of the turn, and the line's offset towards it.
  let normal: Point = [-u[1], u[0]];
  if (normal[0] * inward[0] + normal[1] * inward[1] < 0) normal = [-normal[0], -normal[1]];
  const inside = previous.offset * (previous.normal[0] * normal[0] + previous.normal[1] * normal[1]);
  const signed = radius - inside;
  const [first, second] = previous.key < next.key ? [previous.key, next.key] : [next.key, previous.key];
  return { ref, bend: `${first}>${second}@${previous.gridB.join(',')}`, node, u, v, centre, radius: signed, setback: signed * Math.tan(half), sweep: turn > 0 ? 1 : 0 };
}

/** The drawn path of one line: its polyline, with each eligible corner turned into an arc. */
function drawnPath(vertices: Vertex[], eligible: ReadonlySet<string>): PathPart[] {
  const path: PathPart[] = [];
  for (const { point, corner: bend } of vertices) {
    if (!bend || !eligible.has(bend.bend)) { path.push({ to: point }); continue; }
    const start: Point = [point[0] - bend.u[0] * bend.setback, point[1] - bend.u[1] * bend.setback];
    const end: Point = [point[0] + bend.v[0] * bend.setback, point[1] + bend.v[1] * bend.setback];
    path.push({ to: start }, { to: end, arc: { radius: bend.radius, sweep: bend.sweep, centre: bend.centre } });
  }
  return path;
}

export function parallelLines(model: MapModel, routes: Routes, lineWidth = 7, options: BendOptions = {}): Stroke[] {
  const radius = options.radius ?? tokens.map.bendRadius;
  const outer = options.outer ?? tokens.map.lineWidth + tokens.map.casing;
  const stations = new Set((options.stations ?? [...model.positions.values()]).map(point => point.join(',')));
  const shared = collectEdges(model, routes);
  const orders = slotOrders(shared, bundleLinks(model, routes, shared));
  const lines = model.lines.map(line => {
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
    if (!edges.length) return { line, edges, vertices: [{ point: [path[0]![0] * GRID, path[0]![1] * GRID] as Point }] };
    const vertices: Vertex[] = [{ point: edges[0]!.a }];
    for (let i = 1; i < edges.length; i++) {
      const points = joint(edges[i - 1]!, edges[i]!);
      const bend = points.length === 1 ? corner(line.ref, edges[i - 1]!, edges[i]!, radius) : undefined;
      vertices.push(...points.map(point => bend ? { point, corner: bend } : { point }));
    }
    vertices.push({ point: edges.at(-1)!.b });
    return { line, edges, vertices: compact(vertices) };
  });

  // 1. Candidates: away from stations, the same lines on both edges, each turning there, none too tight.
  const turning = new Map<string, Corner[]>();
  for (const { vertices } of lines) for (const { corner: bend } of vertices) if (bend) turning.set(bend.bend, [...(turning.get(bend.bend) ?? []), bend]);
  const candidates = new Set<string>();
  for (const [bend, corners] of turning) {
    const [edges, node] = bend.split('@') as [string, string];
    const [first, second] = edges.split('>').map(key => shared.get(key)!.refs);
    const same = first!.length === second!.length && first!.every(ref => second!.includes(ref));
    const node0 = corners[0]!.node;
    const atStation = stations.has(node) || stations.has([node0[0] / GRID, node0[1] / GRID].join(','));
    // Every line of the edges turns here (a line may pass the same bend more than once: count lines, not passes).
    const turningRefs = new Set(corners.map(item => item.ref));
    const all = turningRefs.size === first!.length && first!.every(ref => turningRefs.has(ref));
    if (!atStation && same && all && corners.every(item => item.radius >= outer / 2)) candidates.add(bend);
  }
  // 2. Room, from the candidate states only. 3. Eligible when every line of the bundle has room.
  const crowded = new Set<string>();
  const isCandidate = (vertex: Vertex | undefined): boolean => !!vertex?.corner && candidates.has(vertex.corner.bend);
  for (const { vertices } of lines) {
    vertices.forEach((vertex, i) => {
      if (!isCandidate(vertex)) return;
      const budget = (other: Vertex): number => {
        const length = Math.hypot(other.point[0] - vertex.point[0], other.point[1] - vertex.point[1]);
        return isCandidate(other) ? length / 2 : length;
      };
      const setback = vertex.corner!.setback;
      if (setback > budget(vertices[i - 1]!) + 1e-9 || setback > budget(vertices[i + 1]!) + 1e-9) crowded.add(vertex.corner!.bend);
    });
  }
  const eligible = new Set([...candidates].filter(bend => !crowded.has(bend)));
  return lines.map(({ line, edges, vertices }) => ({ ...line, points: vertices.map(vertex => vertex.point), edges, path: drawnPath(vertices, eligible) }));
}
