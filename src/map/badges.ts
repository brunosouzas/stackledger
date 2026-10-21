/** Terminal badges beyond each line end. Call placeBadges(strokes, obstacles) before labels.
 * Ends at one station in one direction share a row; each row moves outwards along the line
 * until it clears station markers, strokes and earlier badges (least overlap when crowded).
 * With the theme's ink, a badge counts with its outline and shadow, and badges in a row sit far
 * enough apart that one's shadow does not touch the next.
 */
import type { Point } from './model.js';
import { GRID, type Stroke } from './parallel.js';
import { overlapScore, textWidth, type Box, type Obstacle } from './labels.js';
import { inkBox, type Ink } from './themes.js';

/** `line` is the ref of the line the badge ends, written as the badge's data-line. */
export interface Badge { point: Point; box: Box; text: string; color: string; line: string }

const HEIGHT = 20;
const MIN_GAP = 4;
const DISTANCES = Array.from({ length: 16 }, (_, i) => 20 + i * 4);
// When a row cannot clear along the line (another stroke continues that way), it may shift to either side.
const SIDEWAYS = [0, 18, -18];

interface Terminal { stroke: Stroke; station: Point; direction: Point; end: Point }

export const badgeWidth = (text: string): number => Math.max(20, textWidth(text) + 8);

function towards(from: Point, to: Point): Point {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

function terminals(strokes: Stroke[]): Terminal[] {
  const result: Terminal[] = [];
  for (const stroke of strokes) {
    const first = stroke.edges[0];
    const last = stroke.edges.at(-1);
    if (!first || !last) {
      // Defensive: the model collapses repeated stops, but a stroke without edges still gets two badges.
      const station = stroke.points[0]!;
      result.push({ stroke, station, direction: [-1, 0], end: station }, { stroke, station, direction: [1, 0], end: station });
      continue;
    }
    const start: Point = [first.gridA[0] * GRID, first.gridA[1] * GRID];
    const finish: Point = [last.gridB[0] * GRID, last.gridB[1] * GRID];
    result.push(
      { stroke, station: start, direction: towards(first.gridB, first.gridA), end: stroke.points[0]! },
      { stroke, station: finish, direction: towards(last.gridA, last.gridB), end: stroke.points.at(-1)! },
    );
  }
  return result;
}

/** Boxes for one row of badges centred `distance` units beyond the station along its direction, moved `sideways` across it. */
function row(members: Terminal[], distance: number, sideways: number, gap: number): Box[] {
  const { station, direction } = members[0]!;
  const centre: Point = [
    station[0] + direction[0] * distance - direction[1] * sideways,
    station[1] + direction[1] * distance + direction[0] * sideways,
  ];
  const widths = members.map(member => badgeWidth(member.stroke.badge));
  if (Math.abs(direction[1]) < 1e-9) {
    // Lines ending horizontally are stacked, one badge per row, centred on the bundle.
    const total = members.length * HEIGHT + (members.length - 1) * gap;
    return widths.map((width, i) => ({
      x: centre[0] - width / 2 + direction[0] * (width - HEIGHT) / 2,
      y: centre[1] - total / 2 + i * (HEIGHT + gap),
      w: width,
      h: HEIGHT,
    }));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + (members.length - 1) * gap;
  const boxes: Box[] = [];
  let x = centre[0] - total / 2;
  for (const width of widths) {
    boxes.push({ x, y: centre[1] - HEIGHT / 2, w: width, h: HEIGHT });
    x += width + gap;
  }
  return boxes;
}

export function placeBadges(strokes: Stroke[], obstacles: Obstacle[], ink: Ink = { casing: 0, outline: 0, shadow: [0, 0] }): Badge[] {
  const gap = Math.max(MIN_GAP, ink.outline + Math.max(Math.abs(ink.shadow[0]), Math.abs(ink.shadow[1])) + 1);
  const groups = new Map<string, Terminal[]>();
  for (const terminal of terminals(strokes)) {
    const key = `${terminal.station.join(',')}|${terminal.direction.map(value => value.toFixed(6)).join(',')}`;
    groups.set(key, [...(groups.get(key) ?? []), terminal]);
  }
  const badges: Badge[] = [];
  const taken = [...obstacles];
  for (const group of groups.values()) {
    // Badges follow the order of their strokes across the bundle; ties keep line order.
    const across = Math.abs(group[0]!.direction[1]) < 1e-9 ? 1 : 0;
    const members = group
      .map((member, index) => ({ member, index }))
      .sort((one, two) => one.member.end[across] - two.member.end[across] || one.index - two.index)
      .map(entry => entry.member);
    const candidates = SIDEWAYS.flatMap(sideways => DISTANCES.map(distance => row(members, distance, sideways, gap)));
    let chosen = candidates[0]!;
    let best = Infinity;
    for (const boxes of candidates) {
      const score = boxes.reduce((sum, box) => sum + overlapScore(inkBox(box, ink), taken), 0);
      if (score < best - 1e-8) {
        best = score;
        chosen = boxes;
      }
      if (score < 1e-8) break;
    }
    members.forEach((member, i) => {
      const box = chosen[i]!;
      badges.push({ point: [box.x + box.w / 2, box.y + box.h / 2], box, text: member.stroke.badge, color: member.stroke.color, line: member.stroke.ref });
      taken.push(inkBox(box, ink));
    });
  }
  return badges;
}
