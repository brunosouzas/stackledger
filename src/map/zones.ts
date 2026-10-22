/** Convex zone hulls, in declaration order. Call zoneGeometry(model, station points).
 * Widening is a 32-unit round stroke around the convex hull, including one/two-point hulls.
 * Zone title boxes are layout obstacles; zones without drawn members are omitted.
 * Software zones are matched by their lower-cased name and never share a station; skills zones are
 * playbook page file names and may share stations, so their corner titles are moved up until clear
 * (layout.ts later moves the title of a zone whose playbook is drawn next to that station).
 */
import type { MapModel, Point, MapZone } from './model.js';
import { overlapArea, textWidth, type Box } from './labels.js';

export interface ZoneGeometry extends MapZone { hull: Point[]; padding: number; titleBox: Box }

const PADDING = 32;

const cross = (origin: Point, one: Point, two: Point): number =>
  (one[0] - origin[0]) * (two[1] - origin[1]) - (one[1] - origin[1]) * (two[0] - origin[0]);

/** One half of Andrew's monotone chain, without its last point. */
function halfHull(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop();
    result.push(point);
  }
  return result.slice(0, -1);
}

export function convexHull(points: Point[]): Point[] {
  const unique = [...new Map(points.map(point => [point.join(','), point])).values()];
  const sorted = unique.sort((one, two) => one[0] - two[0] || one[1] - two[1]);
  if (sorted.length < 3) return sorted;
  return [...halfHull(sorted), ...halfHull([...sorted].reverse())];
}

export function zoneGeometry(model: MapModel, points: Map<string, Point>): ZoneGeometry[] {
  const zones = model.zones.flatMap(zone => {
    const members = model.stations
      .filter(station => station.zones.includes(zone.name.toLowerCase()))
      .map(station => points.get(station.ref)!);
    if (!members.length) return [];
    const left = members.reduce((least, point) => Math.min(least, point[0]), Infinity) - 24;
    const top = members.reduce((least, point) => Math.min(least, point[1]), Infinity) - 56;
    const titleBox: Box = { x: left, y: top, w: textWidth(zone.title), h: 17 };
    return [{ ...zone, hull: convexHull(members), padding: PADDING, titleBox }];
  });
  if (model.kind !== 'skills') return zones;
  // Overlapping zones can share a top-left member: each corner title moves up until it is clear.
  const placed: Box[] = [];
  for (const zone of zones) {
    while (placed.some(box => overlapArea(box, zone.titleBox) > 0)) zone.titleBox = { ...zone.titleBox, y: zone.titleBox.y - zone.titleBox.h - 4 };
    placed.push(zone.titleBox);
  }
  return zones;
}
