/** Deterministic two-row labels using fixed character metrics and eight ordered candidates.
 * Call placeLabels(stations, obstacles); npm test checks geometry without installed fonts.
 * Crowded maps choose the least intersected area, rather than hiding labels or adding candidates.
 */
import type { Point } from './model.js';
import { compareRefs } from '../identity.js';

export interface Box { x: number; y: number; w: number; h: number }
export interface PolygonObstacle { polygon: Point[] }
export type Obstacle = Box | PolygonObstacle;
export interface Label { ref: string; rows: string[]; box: Box }
export interface LabelStation { ref: string; title: string; lines: string[]; point: Point; marker: { box: Box } }

const ROW_LENGTH = 18;
const ROW_HEIGHT = 17;

// Widths in map units for 13-unit system text, with generous fixed Unicode fallback.
const CHARACTER_WIDTHS: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries([
  ...Array.from('ilI.,!\'`|:;', char => [char, 4]),
  ...Array.from('frt()[]{}', char => [char, 5.5]),
  ...Array.from('abcdefghjknopqsuvxyz0123456789-_/\\', char => [char, 7.8]),
  ...Array.from('ABCDEFGHJKLMNOPQRSTUVWXYZ', char => [char, 9.5]),
  ...Array.from('mwMW@%&', char => [char, 12]),
  [' ', 4.5],
  ['…', 13],
]));
const FALLBACK_WIDTH = 14;

export const textWidth = (text: string): number =>
  Array.from(text).reduce((width, char) => width + (CHARACTER_WIDTHS[char] ?? FALLBACK_WIDTH), 0);

const codePoints = (text: string): number => Array.from(text).length;

const cut = (text: string): string => Array.from(text).slice(0, ROW_LENGTH - 1).join('') + '…';

export function wrapLabel(title: string): string[] {
  const words = title.trim().split(/\s+/u);
  const rows: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const short = codePoints(word) > ROW_LENGTH ? cut(word) : word;
    const combined = current ? `${current} ${short}` : short;
    if (codePoints(combined) <= ROW_LENGTH) {
      current = combined;
      continue;
    }
    rows.push(current);
    current = short;
    if (rows.length === 1) {
      const remaining = [word, ...words.slice(i + 1)].join(' ');
      if (codePoints(remaining) <= ROW_LENGTH) {
        current = remaining;
      } else {
        // Keep whole words when possible; truncation always leaves an ellipsis inside the limit.
        const prefix = Array.from(remaining).slice(0, ROW_LENGTH - 1).join('');
        const space = prefix.lastIndexOf(' ');
        current = (space > 0 ? prefix.slice(0, space) : prefix) + '…';
      }
      rows.push(current);
      return rows;
    }
  }
  if (current || !rows.length) rows.push(current);
  return rows.slice(0, 2);
}

/** Right, left, above, below, then the four diagonals. */
export function labelCandidates(point: Point, w: number, h: number, gap: number): Box[] {
  const [x, y] = point;
  const corners: Point[] = [
    [x + gap, y - h / 2],
    [x - gap - w, y - h / 2],
    [x - w / 2, y - gap - h],
    [x - w / 2, y + gap],
    [x + gap, y - gap - h],
    [x + gap, y + gap],
    [x - gap - w, y - gap - h],
    [x - gap - w, y + gap],
  ];
  return corners.map(([left, top]) => ({ x: left, y: top, w, h }));
}

export function overlapArea(a: Box, b: Box): number {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return width * height;
}

/** Area of a convex polygon inside a box (Sutherland-Hodgman clipping, then the shoelace formula). */
function polygonAreaInBox(polygon: Point[], box: Box): number {
  const edges = [[0, box.x, 1], [0, box.x + box.w, -1], [1, box.y, 1], [1, box.y + box.h, -1]] as const;
  let clipped = polygon;
  for (const [axis, bound, sign] of edges) {
    const input = clipped;
    clipped = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const a = input[i]!;
      const b = input[(i + 1) % input.length]!;
      const insideA = (a[axis] - bound) * sign >= 0;
      const insideB = (b[axis] - bound) * sign >= 0;
      if (insideA) clipped.push(a);
      if (insideA !== insideB) {
        const fraction = (bound - a[axis]) / (b[axis] - a[axis]);
        clipped.push([a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]);
      }
    }
  }
  const doubled = clipped.reduce((sum, a, i) => {
    const b = clipped[(i + 1) % clipped.length]!;
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  return Math.abs(doubled) / 2;
}

export function overlapScore(box: Box, obstacles: Obstacle[]): number {
  return obstacles.reduce((sum, obstacle) => sum + ('polygon' in obstacle ? polygonAreaInBox(obstacle.polygon, box) : overlapArea(box, obstacle)), 0);
}

/** First candidate with no overlap, else the least intersected area, ties to the earlier candidate. */
export function chooseLabel(candidates: Box[], obstacles: Obstacle[]): Box {
  let chosen = candidates[0]!;
  let best = Infinity;
  for (const candidate of candidates) {
    const score = overlapScore(candidate, obstacles);
    if (score < best - 1e-8) {
      best = score;
      chosen = candidate;
    }
    if (score < 1e-8) break;
  }
  return chosen;
}

/** A line segment as a rectangle as wide as its stroke. */
export function segmentObstacle(a: Point, b: Point, width: number): PolygonObstacle {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!length) return { polygon: [] };
  const dx = -(b[1] - a[1]) / length * width / 2;
  const dy = (b[0] - a[0]) / length * width / 2;
  return { polygon: [[a[0] + dx, a[1] + dy], [b[0] + dx, b[1] + dy], [b[0] - dx, b[1] - dy], [a[0] - dx, a[1] - dy]] };
}

export function placeLabels(stations: LabelStation[], obstacles: Obstacle[]): Label[] {
  const labels: Label[] = [];
  const taken = [...obstacles];
  const ordered = [...stations].sort((one, two) => two.lines.length - one.lines.length || compareRefs(one.ref, two.ref));
  for (const station of ordered) {
    const rows = wrapLabel(station.title);
    const width = Math.max(...rows.map(textWidth));
    const height = rows.length * ROW_HEIGHT;
    const marker = station.marker.box;
    const gap = Math.max(marker.w, marker.h) / 2 + 10;
    const centre: Point = [marker.x + marker.w / 2, marker.y + marker.h / 2];
    const chosen = chooseLabel(labelCandidates(centre, width, height, gap), taken);
    labels.push({ ref: station.ref, rows, box: chosen });
    taken.push(chosen);
  }
  return labels;
}
