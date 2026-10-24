/** Round bends (metro-map: Round bends, Bend candidates, Room for an arc, Bundles through bends,
 * Arc obstacles, Label placement). Routes are given by hand, so each bend is exactly where the
 * scenario puts it. Run npm test.
 */
import { test, expect } from 'vitest';
import { tokens } from '@brunosouzas/design-system/tokens';
import { buildMapModel } from '../../src/map/model.js';
import { parallelLines, type PathPart, type Stroke } from '../../src/map/parallel.js';
import { overlapScore, placeLabels, segmentObstacle } from '../../src/map/labels.js';
import { layoutMap, pathObstacles } from '../../src/map/layout.js';
import { placeBadges } from '../../src/map/badges.js';
import { pathData } from '../../src/map/svg.js';
import { buildSkillsMapModel } from '../../src/skills/metro.js';
import type { Point } from '../../src/map/model.js';
import { component, journey, positions, viewOf } from './map-helpers.js';

const R = tokens.map.bendRadius;
// layoutMap's gap between bundled lines with the current tokens: lineWidth + casing / 2 (+ 1.5 in parallelLines).
const GAP = tokens.map.lineWidth + tokens.map.casing / 2;
const OUTER = tokens.map.lineWidth + tokens.map.casing;
const model = (...docs: unknown[]) => buildMapModel(viewOf(docs), '2027-06-01');
const routesOf = (paths: Record<string, number[][]>) => ({ hops: [], paths: new Map(Object.entries(paths).map(([name, path]) => [`line:${name}`, path])) }) as any;
const draw = (docs: unknown[], paths: Record<string, number[][]>, gap = GAP) => parallelLines(model(...docs), routesOf(paths), gap, { outer: OUTER });
const arcs = (stroke: Stroke) => stroke.path.filter((part): part is Required<PathPart> => part.arc !== undefined);
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
/** The start of each arc: the end of the part before it. */
const arcStarts = (stroke: Stroke) => stroke.path.flatMap((part, i) => part.arc ? [stroke.path[i - 1]!.to] : []);
const stations = (...names: string[]) => names.map(name => component(name));

test('Single line turns round', () => {
  const [ship] = draw([...stations('a', 'b'), journey('ship', ['a', 'b']), positions({ a: [0, 2], b: [2, 0] })], { ship: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]] });
  const node: Point = [128, 128];
  expect(arcs(ship!)).toHaveLength(1);
  const arc = arcs(ship!)[0]!;
  close(arc.arc.radius, R);
  close(dist(arcStarts(ship!)[0]!, node), R);close(dist(arc.to, node), R);
  // No mitre corner: the node itself is not a vertex of the drawn path.
  expect(ship!.path.some(part => dist(part.to, node) < 1e-6)).toBe(false);
});

test('45-degree turn', () => {
  const [ship] = draw([...stations('a', 'b'), journey('ship', ['a', 'b']), positions({ a: [0, 0], b: [3, 1] })], { ship: [[0, 0], [1, 0], [2, 0], [3, 1]] });
  const node: Point = [128, 0];
  const arc = arcs(ship!)[0]!;
  close(arc.arc.radius, R);
  close(dist(arc.arc.centre, node), R / Math.cos(Math.PI / 8));
  // On the inside of the turn (the line turns down to the right, so the centre is below the node).
  expect(arc.arc.centre[1]).toBeGreaterThan(0);
  close(dist(arcStarts(ship!)[0]!, node), R * Math.tan(Math.PI / 8));close(dist(arc.to, node), R * Math.tan(Math.PI / 8));
});

test('Offset line is tangent', () => {
  const docs = [...stations('a', 'b'), journey('ship', ['a', 'b'], '1'), journey('secrets', ['a', 'b'], '2'), positions({ a: [0, 0], b: [4, 3] })];
  const path = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 3], [4, 3]];
  const strokes = draw(docs, { ship: path, secrets: path });
  const turns = [{ node: [128, 0], phi: Math.PI / 2 }, { node: [128, 128], phi: Math.PI / 4 }];
  for (const stroke of strokes) {
    expect(arcs(stroke)).toHaveLength(2);
    arcs(stroke).forEach((arc, i) => {
      const start = arcStarts(stroke)[i]!, setback = arc.arc.radius * Math.tan(turns[i]!.phi / 2);
      // The mitre point of this line is where its two offset segments meet: the start and end are one setback from it.
      const mitre = stroke.points.find(point => dist(point, start) > 1e-6 && Math.abs(dist(point, start) - setback) < 1e-6 && Math.abs(dist(point, arc.to) - setback) < 1e-6);
      expect(mitre, `${stroke.ref} ${i}`).toBeDefined();
      close(dist(arc.arc.centre, start), arc.arc.radius);close(dist(arc.arc.centre, arc.to), arc.arc.radius);
    });
  }
  for (const i of [0, 1]) expect(arcs(strokes[0]!)[i]!.arc.centre.map(v => v.toFixed(6))).toEqual(arcs(strokes[1]!)[i]!.arc.centre.map(v => v.toFixed(6)));
});

test('Mirrored turns', () => {
  const docs = [...stations('a', 'b', 'c', 'd'), journey('down', ['a', 'b']), journey('up', ['c', 'd']), positions({ a: [0, 0], b: [2, 2], c: [0, 6], d: [2, 4] })];
  const [down, up] = draw(docs, { down: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], up: [[0, 6], [1, 6], [2, 6], [2, 5], [2, 4]] });
  // East then south turns clockwise on screen (y grows downwards); east then north anticlockwise.
  expect(pathData(down!)).toMatch(new RegExp(`A${R},${R} 0 0 1 `));
  expect(pathData(up!)).toMatch(new RegExp(`A${R},${R} 0 0 0 `));
});

test('Bundle turns around one centre', () => {
  const path = [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]];
  const [ship, secrets] = draw([...stations('a', 'b'), journey('ship', ['a', 'b'], '1'), journey('secrets', ['a', 'b'], '2'), positions({ a: [0, 2], b: [2, 0] })], { ship: path, secrets: path });
  const one = arcs(ship!)[0]!, two = arcs(secrets!)[0]!;
  expect(one.arc.centre).toEqual(two.arc.centre);
  close(Math.abs(one.arc.radius - two.arc.radius), GAP + 1.5);
  expect(Math.sign(one.arc.radius - two.arc.radius)).not.toBe(0);
});

test('Reversed travel draws the same bends', () => {
  const path = [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]];
  const docs = (secrets: string[]) => [...stations('a', 'b'), journey('ship', ['a', 'b'], '1'), journey('secrets', secrets, '2'), positions({ a: [0, 2], b: [2, 0] })];
  const summary = (strokes: Stroke[]) => strokes.flatMap(arcs).map(arc => [arc.arc.centre.map(v => v.toFixed(6)).join(','), arc.arc.radius.toFixed(6)].join(' ')).sort();
  expect(summary(draw(docs(['b', 'a']), { ship: path, secrets: [...path].reverse() }))).toEqual(summary(draw(docs(['a', 'b']), { ship: path, secrets: path })));
});

test('Three lines turn round', () => {
  const path = [[0, 4], [1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [3, 1]];
  const names = ['ship', 'docs', 'secrets'];
  const strokes = draw([...stations('a', 'b'), ...names.map((name, i) => journey(name, ['a', 'b'], String(i + 1))), positions({ a: [0, 4], b: [3, 1] })], Object.fromEntries(names.map(name => [name, path])));
  const radii = strokes.map(stroke => arcs(stroke)[0]!.arc.radius);
  expect(Math.min(...radii)).toBeGreaterThanOrEqual(OUTER / 2);
  for (const stroke of strokes) expect(arcs(stroke)).toHaveLength(1);
});

test('Wide bundle stays mitred', () => {
  const path = [[0, 4], [1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [3, 1]];
  const names = ['ship', 'docs', 'secrets', 'design'];
  const strokes = draw([...stations('a', 'b'), ...names.map((name, i) => journey(name, ['a', 'b'], String(i + 1))), positions({ a: [0, 4], b: [3, 1] })], Object.fromEntries(names.map(name => [name, path])));
  // The innermost line would turn on a radius of 32 - 1.5 × 16.5 = 7.25, under half its outer width (9).
  expect(R - 1.5 * (GAP + 1.5)).toBeLessThan(OUTER / 2);
  for (const stroke of strokes) expect(arcs(stroke)).toHaveLength(0);
});

const splitDocs = () => [...stations('a', 'b', 'c'), journey('ship', ['a', 'b'], '1'), journey('docs', ['a', 'c'], '2'), journey('secrets', ['a', 'b'], '3'), positions({ a: [0, 2], b: [2, 0], c: [4, 2] })];
const splitPaths = { ship: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]], docs: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], secrets: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]] };

test('Middle line goes straight on', () => {
  for (const stroke of draw(splitDocs(), splitPaths)) expect(arcs(stroke), stroke.ref).toHaveLength(0);
});

test('Bundle splits at a bend', () => {
  const strokes = draw(splitDocs(), splitPaths);
  for (const ref of ['line:ship', 'line:secrets']) {
    const stroke = strokes.find(item => item.ref === ref)!;
    expect(arcs(stroke)).toHaveLength(0);
    // The mitred corner is a vertex of the drawn path.
    expect(stroke.path.map(part => part.to)).toEqual(stroke.points);
  }
});

test('Bundles merge at a bend', () => {
  // ship turns at [2, 2] onto the edge [2, 2]-[2, 1], which secrets joins there from the right.
  const docs = [...stations('a', 'b', 'c'), journey('ship', ['a', 'b'], '1'), journey('secrets', ['c', 'b'], '2'), positions({ a: [0, 2], b: [2, 0], c: [4, 2] })];
  const strokes = draw(docs, { ship: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]], secrets: [[4, 2], [3, 2], [2, 2], [2, 1], [2, 0]] });
  expect(arcs(strokes[0]!)).toHaveLength(0);
});

test('Bend at a station stays mitred', () => {
  const [ship] = draw([...stations('a', 'b', 'c'), journey('ship', ['a', 'b', 'c']), positions({ a: [0, 0], b: [2, 0], c: [2, 2] })], { ship: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] });
  expect(arcs(ship!)).toHaveLength(0);
  expect(ship!.path.some(part => dist(part.to, [128, 0]) < 1e-6)).toBe(true);
});

test('Bundle keeps its sides through a bend', () => {
  const m = model(component('a'), component('b'), journey('ship', ['a', 'b'], '1'), journey('secrets', ['a', 'b'], '2'), positions({ a: [0, 1], b: [2, 0] }));
  const path = [[0, 1], [1, 1], [2, 0]];
  const strokes = parallelLines(m, routesOf({ ship: path, secrets: path }));
  const sides = strokes.map(s => s.edges.map(e => { const dx = e.gridB[0] - e.gridA[0], dy = e.gridB[1] - e.gridA[1], ox = e.a[0] - e.gridA[0] * 64, oy = e.a[1] - e.gridA[1] * 64; return Math.sign(dx * oy - dy * ox); }));
  for (const s of sides) { expect(s[0]).not.toBe(0); expect(s[1]).toBe(s[0]); }
  expect(sides[0]![0]).not.toBe(sides[1]![0]);
  for (const s of strokes) { expect(s.points).toHaveLength(3); expect(arcs(s)).toHaveLength(1); }
  expect(arcs(strokes[0]!)[0]!.arc.centre).toEqual(arcs(strokes[1]!)[0]!.arc.centre);
});

// Room for an arc. An S-bend one edge apart: the outer line's setback (32 + 16.5) is more than half the edge.
test('Arcs with no room stay mitred', () => {
  const path = [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]];
  const names = ['ship', 'docs', 'secrets'];
  const strokes = draw([...stations('a', 'b'), ...names.map((name, i) => journey(name, ['a', 'b'], String(i + 1))), positions({ a: [0, 0], b: [4, 1] })], Object.fromEntries(names.map(name => [name, path])));
  for (const stroke of strokes) expect(arcs(stroke), stroke.ref).toHaveLength(0);
});

test('Chained conflicts', () => {
  // A staircase: three candidate turns one edge apart. The two-line bundle's outer setbacks (32 + 8.25) exceed half an edge.
  const path = [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [3, 3]];
  for (const reversed of [false, true]) {
    const stops = reversed ? ['b', 'a'] : ['a', 'b'];
    const route = reversed ? [...path].reverse() : path;
    const strokes = draw([...stations('a', 'b'), journey('ship', stops, '1'), journey('secrets', stops, '2'), positions({ a: [0, 0], b: [3, 3] })], { ship: route, secrets: route }, 7);
    for (const stroke of strokes) expect(arcs(stroke), `${stroke.ref} reversed=${reversed}`).toHaveLength(0);
  }
});

test('Bend next to a connector or an end', () => {
  // ship turns at [4, 0] one edge before its last stop [4, 1]; on [3, 0]-[4, 0] it shares the edge with
  // secrets, so ship changes slot with a connector at [3, 0], one edge before that same bend.
  const docs = [...stations('a', 'b', 'c'), journey('ship', ['a', 'c'], '1'), journey('secrets', ['b', 'c'], '2'), positions({ a: [0, 0], b: [2, 1], c: [4, 1] })];
  const strokes = draw(docs, { ship: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]], secrets: [[2, 1], [3, 0], [4, 0], [4, 1]] }, 7);
  const ship = strokes[0]!;
  expect(ship.points.length).toBeGreaterThan(4);
  // Both lines turn together at [4, 0]: the setbacks fit within the whole segments (connector on one side, the end on the other).
  for (const stroke of strokes) expect(arcs(stroke), stroke.ref).toHaveLength(1);
});

test('Angles', () => {
  const m = model(component('a'), component('b'), component('c'), component('d'), journey('ship', ['a', 'b']), journey('extra', ['b', 'c', 'a', 'd']), positions({ a: [3, 2], b: [6, 2] }));
  let arcCount = 0;
  for (const line of layoutMap(m).lines) {
    let from = line.path[0]!.to;
    for (const part of line.path.slice(1)) {
      if (part.arc) { arcCount++; close(dist(part.arc.centre, from), part.arc.radius); close(dist(part.arc.centre, part.to), part.arc.radius); }
      else {
        const dx = Math.abs(part.to[0] - from[0]), dy = Math.abs(part.to[1] - from[1]);
        expect(dx < 1e-7 || dy < 1e-7 || Math.abs(dx - dy) < 1e-7, JSON.stringify([from, part.to])).toBe(true);
      }
      from = part.to;
    }
  }
  expect(arcCount).toBeGreaterThan(0);
});

test('Skills map turns round', () => {
  const set = {
    skills: ['writer', 'editor'].map(name => ({ name, kind: 'skill', skills: [], agents: [], path: '', description: '', given: '', files: [], rules: [] })),
    agents: [],
    map: {
      lines: [{ apiVersion: 'stackledger/v1alpha1', kind: 'Line', metadata: { name: 'publish' }, spec: { color: '#E4002B', stops: ['skill:writer', 'skill:editor'] } }],
      layout: { apiVersion: 'stackledger/v1alpha1', kind: 'MapLayout', metadata: { name: 'skills' }, spec: { stations: { 'skill:writer': [0, 0], 'skill:editor': [3, 1] } } },
    },
  };
  const geometry = layoutMap(buildSkillsMapModel(set as any));
  const all = geometry.lines.flatMap(arcs);
  expect(all.length).toBeGreaterThan(0);
  for (const arc of all) close(arc.arc.radius, R);
});

// Arc obstacles. A hand-made corner: east along y = 20, then north along x = 115, turning round
// around (83, -12). Its mitre strips (y 11..29, x 106..124) leave the inside of the corner free.
const corner = (): PathPart[] => [{ to: [0, 20] }, { to: [83, 20] }, { to: [115, -12], arc: { radius: R, sweep: 0, centre: [83, -12] } }, { to: [115, -100] }];
const mitre = (): ReturnType<typeof segmentObstacle>[] => [segmentObstacle([0, 20], [115, 20], OUTER), segmentObstacle([115, 20], [115, -100], OUTER)];

test('Label clears the outside of a curve', () => {
  // Also on a real bend from parallelLines.
  const real = draw([...stations('a', 'b'), journey('ship', ['a', 'b']), positions({ a: [3, 1], b: [1, -1] })], { ship: [[3, 1], [2, 1], [1, 1], [1, 0], [1, -1]] })[0]!;
  for (const path of [corner(), real.path]) {
    const obstacles = pathObstacles(path, OUTER);
    const i = path.findIndex(part => part.arc), arc = path[i]!.arc!, start = path[i - 1]!.to, end = path[i]!.to;
    const [cx, cy] = arc.centre;
    const a1 = Math.atan2(start[1] - cy, start[0] - cx), a2 = Math.atan2(end[1] - cy, end[0] - cx);
    let sweep = a2 - a1; if (sweep > Math.PI) sweep -= 2 * Math.PI; if (sweep < -Math.PI) sweep += 2 * Math.PI;
    const outer = arc.radius + OUTER / 2 - 0.05;
    const steps = Math.ceil(Math.abs(sweep) / (Math.PI / 12) - 1e-9);
    // Midway along each chord, at each joint between chords, and at the joints with the straight parts.
    for (let k = 0; k <= steps * 2; k++) {
      const angle = a1 + sweep * k / (steps * 2);
      const point: Point = [cx + outer * Math.cos(angle), cy + outer * Math.sin(angle)];
      expect(overlapScore({ x: point[0] - 0.01, y: point[1] - 0.01, w: 0.02, h: 0.02 }, obstacles), `${k}`).toBeGreaterThan(0);
    }
  }
});

test('Label clears a round bend', () => {
  // The first candidate, to the right of the station, sits inside the corner: clear of the mitre, not of the arc.
  const station = { ref: 'component:x', title: 'Vault', lines: [], point: [70, -2] as Point, marker: { box: { x: 64, y: -8, w: 12, h: 12 } } };
  const first = placeLabels([station], mitre())[0]!.box;
  expect(overlapScore(first, mitre())).toBe(0);
  expect(overlapScore(first, pathObstacles(corner(), OUTER))).toBeGreaterThan(0);
  const placed = placeLabels([station], pathObstacles(corner(), OUTER))[0]!.box;
  expect(placed).not.toEqual(first);
  expect(overlapScore(placed, pathObstacles(corner(), OUTER))).toBe(0);
});

test('Terminal badge clears a round bend', () => {
  // ship ends at (64, 0) heading east: its first badge position, 20 units on, sits inside the corner.
  const [ship] = draw([...stations('a', 'b'), journey('ship', ['a', 'b']), positions({ a: [0, 0], b: [1, 0] })], { ship: [[0, 0], [1, 0]] });
  const east = (badges: ReturnType<typeof placeBadges>) => badges.find(badge => badge.box.x > 64)!.box;
  const withMitre = east(placeBadges([ship!], mitre()));
  expect(overlapScore(withMitre, mitre())).toBe(0);
  expect(overlapScore(withMitre, pathObstacles(corner(), OUTER))).toBeGreaterThan(0);
  const withArc = east(placeBadges([ship!], pathObstacles(corner(), OUTER)));
  expect(withArc).not.toEqual(withMitre);
  expect(overlapScore(withArc, pathObstacles(corner(), OUTER))).toBe(0);
});
