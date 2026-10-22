/** Assemble plain map geometry from a model: suggestions, routes, slots, markers and labels.
 * Call layoutMap(buildMapModel(view,date), theme.lineWidth, inkOf(theme)); no I/O or mutation.
 * Unrouted hops are retained for the CLI to report. Theme-independent points keep stored stations
 * stable; the theme's ink (casing, outline, shadow) only grows the obstacles of labels and badges.
 */
import type { MapModel, MapStation, MapLine, Point } from './model.js';
import { suggestPositions, type Suggestion } from './suggest.js';
import { routeMap, type RoutedHop } from './route.js';
import { parallelLines, GRID, type Stroke } from './parallel.js';
import { placeLabels, segmentObstacle, textWidth, type Box, type Label, type Obstacle } from './labels.js';
import { zoneGeometry, type ZoneGeometry } from './zones.js';
import { badgeWidth, placeBadges, type Badge } from './badges.js';
import { inkBox, inkOf, themes, type Ink } from './themes.js';

export { inkBox } from './themes.js';

export type { Badge } from './badges.js';
/** A stop is a circle on its line (box = the circle's square); an interchange is a capsule round all
 * its contacts (box with corner radius half its short side). `halo` is the radius of renewal rings. */
export interface Marker { kind: 'stop' | 'interchange'; box: Box; contacts: Point[]; halo: number }
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

const LICENCE_RADIUS = 5;
/** A stop circle is a little wider than the pipe it sits on (as the banner's circles); interchanges are larger. */
const stopRadius = (lineWidth: number, ink: Ink): number => (lineWidth + ink.casing) / 2 + 3;
const INTERCHANGE_EXTRA = 2;
const LABEL_CLEARANCE = 3;

/** Bounding box of any number of points, computed without spreading them into Math.min/Math.max. */
function bounding(points: Point[], padding: number): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const x = minX - padding;
  const y = minY - padding;
  return { x, y, w: maxX - x + padding, h: maxY - y + padding };
}

const atGridPoint = (grid: Point, point: Point): boolean => grid[0] * GRID === point[0] && grid[1] * GRID === point[1];

function stationGeometry(station: MapStation, point: Point, lines: Stroke[], suggested: boolean, radius: number): StationGeometry {
  const contacts: Point[] = [];
  for (const line of lines.filter(item => station.lines.includes(item.ref))) {
    for (const edge of line.edges) {
      if (atGridPoint(edge.gridA, point)) contacts.push(edge.a);
      if (atGridPoint(edge.gridB, point)) contacts.push(edge.b);
    }
  }
  if (!contacts.length) contacts.push(point);
  const kind = station.lines.length > 1 ? 'interchange' : 'stop';
  const box = kind === 'stop' ? bounding([contacts[0]!], radius) : bounding(contacts, radius + INTERCHANGE_EXTRA);
  const halo = Math.max(box.w, box.h) / 2 + 6;
  // The licence marker sits on the circle's upper right, just outside its outline.
  const licencePoint: Point | undefined = station.licence === 'none' ? undefined : [box.x + box.w + 3, box.y - 3];
  return { ...station, point, suggested, marker: { kind, box, contacts, halo }, licencePoint };
}

export function layoutMap(model: MapModel, lineWidth = themes.light.lineWidth, ink: Ink = inkOf(themes.light)): MapGeometry {
  const { positions, suggestions } = suggestPositions(model);
  const routes = routeMap(model, positions);
  // Bundled pipes sit so that each casing just meets its neighbour's colour: no overlap, ink between.
  const lines = parallelLines(model, routes, lineWidth + ink.casing / 2);
  const pointMap = new Map([...positions].map(([ref, cell]) => [ref, [cell[0] * GRID, cell[1] * GRID] as Point]));
  const radius = stopRadius(lineWidth, ink);
  const stations = model.stations.map(station =>
    stationGeometry(station, pointMap.get(station.ref)!, lines, suggestions.some(item => item.ref === station.ref), radius));

  const segments: Obstacle[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.points.length; i++) segments.push(segmentObstacle(line.points[i - 1]!, line.points[i]!, lineWidth + ink.casing));
  }
  const licenceBoxes: Box[] = stations.flatMap(station => {
    const centre = station.licencePoint;
    if (!centre) return [];
    return [{ x: centre[0] - LICENCE_RADIUS, y: centre[1] - LICENCE_RADIUS, w: LICENCE_RADIUS * 2, h: LICENCE_RADIUS * 2 }];
  });
  const markers: Box[] = [...stations.map(station => station.marker.box), ...licenceBoxes].map(box => inkBox(box, ink));
  const badges = placeBadges(lines, [...markers, ...segments], ink);
  const zones = zoneGeometry(model, pointMap);
  // Labels keep a little air from stickers, so text never touches an outline or shadow.
  const clear = (box: Box): Box => ({ x: box.x - LABEL_CLEARANCE, y: box.y - LABEL_CLEARANCE, w: box.w + LABEL_CLEARANCE * 2, h: box.h + LABEL_CLEARANCE * 2 });
  const obstacles: Obstacle[] = [...markers.map(clear), ...badges.map(badge => clear(inkBox(badge.box, ink))), ...zones.map(zone => zone.titleBox), ...segments];
  const labels = placeLabels(stations, obstacles);

  const extent: Point[] = [[0, 0], [320, 256], ...lines.flatMap(line => line.points)];
  const addBox = (box: Box): void => {
    extent.push([box.x, box.y], [box.x + box.w, box.y + box.h]);
  };
  for (const box of [...labels.map(label => label.box), ...badges.map(badge => inkBox(badge.box, ink)), ...markers]) addBox(box);
  for (const station of stations) {
    // Suggestion discs and renewal rings are drawn around the station point.
    const { halo } = station.marker;
    const radius = station.suggested ? halo + 5 : station.renewal ? halo + 3 : 0;
    if (radius) addBox(inkBox({ x: station.point[0] - radius, y: station.point[1] - radius, w: radius * 2, h: radius * 2 }, ink));
  }
  for (const zone of zones) {
    addBox(zone.titleBox);
    addBox(bounding(zone.hull, zone.padding));
  }
  const frame = bounding(extent, 48);

  const symbols = ['interchange', 'licence', 'licence to buy', 'suggested position', ...(model.view === 'full' ? ['renewal within 30 days'] : [])];
  const legendWidth = model.lines.reduce((width, line) => Math.max(width, textWidth(line.title) + badgeWidth(line.badge) + 96), 310);
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
