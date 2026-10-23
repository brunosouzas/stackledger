/** Deterministic multi-row labels using fixed character metrics and eight ordered candidates.
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

/** Characters a long word may break after, as CSS breaks after a hyphen. */
const BREAKS: ReadonlySet<string> = new Set(['-', '_', '.', '/']);

/** A word longer than a row, in pieces of at most ROW_LENGTH code points: each piece ends after the
 * last break character that keeps it within the row, or after ROW_LENGTH code points when it has none. */
function splitWord(word: string): string[] {
  const chars = Array.from(word);
  const pieces: string[] = [];
  while (chars.length > ROW_LENGTH) {
    let end = ROW_LENGTH;
    for (let i = ROW_LENGTH - 1; i >= 0; i--) {
      if (BREAKS.has(chars[i]!)) {
        end = i + 1;
        break;
      }
    }
    pieces.push(chars.splice(0, end).join(''));
  }
  pieces.push(chars.join(''));
  return pieces;
}

/** Rows of at most ROW_LENGTH code points, filled greedily at spaces; nothing is cut (metro-map, Label
 * text and Label word breaks). A long word starts a new row; its last piece continues as a word. A
 * label that fits in two rows gets the rows 0.2.0 gave it, so maps without a cut label do not move. */
export function wrapLabel(title: string): string[] {
  const words = title.trim().split(/\s+/u);
  const rows: string[] = [];
  let current = '';
  for (const word of words) {
    if (codePoints(word) > ROW_LENGTH) {
      if (current) rows.push(current);
      const pieces = splitWord(word);
      rows.push(...pieces.slice(0, -1));
      current = pieces[pieces.length - 1]!;
      continue;
    }
    const combined = current ? `${current} ${word}` : word;
    if (codePoints(combined) <= ROW_LENGTH) {
      current = combined;
    } else {
      rows.push(current);
      current = word;
    }
  }
  if (current || !rows.length) rows.push(current);
  return rows;
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
  // Most obstacles are far away: reject on the bounding box before clipping.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of polygon) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  if (maxX <= box.x || minX >= box.x + box.w || maxY <= box.y || minY >= box.y + box.h) return 0;
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
