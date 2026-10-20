/** Assemble plain map geometry from a model: suggestions, routes, slots, markers and labels.
 * Call layoutMap(buildMapModel(view,date)); no I/O or mutation. Unrouted hops are retained
 * for the CLI to report. Theme-independent points keep stored stations stable.
 */
import type { MapModel, MapStation, MapLine, Point } from './model.js';
import { suggestPositions, type Suggestion } from './suggest.js';
import { routeMap, type RoutedHop } from './route.js';
import { parallelLines, GRID, type Stroke } from './parallel.js';
import { placeLabels, segmentObstacle, textWidth, type Box, type Label, type Obstacle } from './labels.js';
import { zoneGeometry, type ZoneGeometry } from './zones.js';
import { placeBadges, type Badge } from './badges.js';

export type { Badge } from './badges.js';
export interface Marker { kind: 'tick' | 'interchange'; box: Box; contacts: Point[]; normal: Point; a: Point; b: Point }
export interface StationGeometry extends MapStation { point: Point; suggested: boolean; marker: Marker; licencePoint: Point | undefined }
export interface MapGeometry {
  view: MapModel['view'];
  stations: StationGeometry[];
  lines: Stroke[];
  badges: Badge[];
  labels: Label[];
  zones: ZoneGeometry[];
  suggestions: Suggestion[];
  unrouted: RoutedHop[];
  legend: { lines: MapLine[]; symbols: string[]; box: Box };
  frame: Box;
  viewBox: Box;
}

const TICK_LENGTH = 11;
const LICENCE_RADIUS = 6;

function bounding(points: Point[], padding: number): Box {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding;
  return { x, y, w: Math.max(...xs) - x + padding, h: Math.max(...ys) - y + padding };
}

const atGridPoint = (grid: Point, point: Point): boolean => grid[0] * GRID === point[0] && grid[1] * GRID === point[1];

function stationGeometry(station: MapStation, point: Point, lines: Stroke[], suggested: boolean, lineWidth: number): StationGeometry {
  const contacts: Point[] = [];
  const normals: Point[] = [];
  for (const line of lines.filter(item => station.lines.includes(item.ref))) {
    for (const edge of line.edges) {
      if (atGridPoint(edge.gridA, point)) {
        contacts.push(edge.a);
        normals.push(edge.normal);
      }
      if (atGridPoint(edge.gridB, point)) {
        contacts.push(edge.b);
        normals.push(edge.normal);
      }
    }
  }
  if (!contacts.length) contacts.push(point);
  const normal = normals[0] ?? [0, -1];
  const kind = station.lines.length > 1 ? 'interchange' : 'tick';
  const a = contacts[0]!;
  const b: Point = [a[0] + normal[0] * TICK_LENGTH, a[1] + normal[1] * TICK_LENGTH];
  const box = kind === 'tick' ? bounding([a, b], lineWidth / 2) : bounding(contacts, 7);
  const licencePoint: Point | undefined = station.licence === 'none' ? undefined : [box.x + box.w + 7, box.y - 2];
  return { ...station, point, suggested, marker: { kind, box, contacts, normal, a, b }, licencePoint };
}

export function layoutMap(model: MapModel, lineWidth = 7): MapGeometry {
  const { positions, suggestions } = suggestPositions(model);
  const routes = routeMap(model, positions);
  const lines = parallelLines(model, routes, lineWidth);
  const pointMap = new Map([...positions].map(([ref, cell]) => [ref, [cell[0] * GRID, cell[1] * GRID] as Point]));
  const stations = model.stations.map(station =>
    stationGeometry(station, pointMap.get(station.ref)!, lines, suggestions.some(item => item.ref === station.ref), lineWidth));

  const segments: Obstacle[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.points.length; i++) segments.push(segmentObstacle(line.points[i - 1]!, line.points[i]!, lineWidth));
  }
  const licenceBoxes: Box[] = stations.flatMap(station => {
    const centre = station.licencePoint;
    if (!centre) return [];
    return [{ x: centre[0] - LICENCE_RADIUS, y: centre[1] - LICENCE_RADIUS, w: LICENCE_RADIUS * 2, h: LICENCE_RADIUS * 2 }];
  });
  const markers: Box[] = [...stations.map(station => station.marker.box), ...licenceBoxes];
  const badges = placeBadges(lines, [...markers, ...segments]);
  const zones = zoneGeometry(model, pointMap);
  const obstacles: Obstacle[] = [...markers, ...badges.map(badge => badge.box), ...zones.map(zone => zone.titleBox), ...segments];
  const labels = placeLabels(stations, obstacles);

  const extent: Point[] = [[0, 0], [320, 256], ...lines.flatMap(line => line.points)];
  const addBox = (box: Box): void => {
    extent.push([box.x, box.y], [box.x + box.w, box.y + box.h]);
  };
  for (const box of [...labels.map(label => label.box), ...badges.map(badge => badge.box), ...stations.map(station => station.marker.box)]) addBox(box);
  for (const zone of zones) {
    addBox(zone.titleBox);
    addBox(bounding(zone.hull, zone.padding));
  }
  const frame = bounding(extent, 48);

  const symbols = ['interchange', 'licence', 'licence to buy', 'suggested position', ...(model.view === 'full' ? ['renewal within 30 days'] : [])];
  const legendWidth = Math.max(310, ...model.lines.map(line => textWidth(line.title) + 116));
  const legendBox: Box = { x: frame.x + frame.w + 28, y: frame.y + 12, w: legendWidth, h: 110 + model.lines.length * 30 + symbols.length * 32 };
  const viewBox: Box = {
    x: frame.x - 16,
    y: frame.y - 88,
    w: frame.w + legendBox.w + 60,
    h: Math.max(frame.h, legendBox.h + 24) + 104,
  };
  return {
    view: model.view,
    stations,
    lines,
    badges,
    labels,
    zones,
    suggestions,
    unrouted: routes.hops.filter(hop => hop.unrouted),
    legend: { lines: model.lines, symbols, box: legendBox },
    frame,
    viewBox,
  };
}
