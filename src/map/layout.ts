/** Assemble plain map geometry from a model: suggestions, routes, slots, markers and labels.
 * Call layoutMap(buildMapModel(view,date), theme.lineWidth, inkOf(theme)); no I/O or mutation.
 * Unrouted hops are retained for the CLI to report. Theme-independent points keep stored stations
 * stable; the theme's ink (casing, outline, shadow) only grows the obstacles of labels and badges.
 */
import type { MapModel, MapStation, MapLine, Point } from './model.js';
import { suggestPositions, type Suggestion } from './suggest.js';
import { routeMap, type RoutedHop } from './route.js';
import { parallelLines, GRID, type PathPart, type Stroke } from './parallel.js';
import { chooseLabel, labelCandidates, placeLabels, segmentObstacle, textWidth, type Box, type Label, type Obstacle } from './labels.js';
import { stackCornerTitles, zoneGeometry, type ZoneGeometry } from './zones.js';
import { badgeWidth, placeBadges, type Badge } from './badges.js';
import { inkBox, inkOf, themes, type Ink } from './themes.js';

export { inkBox } from './themes.js';

export type { Badge } from './badges.js';
/** A stop is a circle on its line; an interchange a capsule: every point within `radius` of the
 * segment `ends`, which runs along its contacts, so it contains them whatever the lines' angle.
 * `box` bounds the shape; `halo` is the radius of renewal rings. */
export interface Marker { kind: 'stop' | 'interchange'; box: Box; contacts: Point[]; ends: [Point, Point]; radius: number; halo: number }
/** A rule count (skills map): its text and its sticker's box, a circle for one digit, a pill for more. */
export interface RuleCount { text: string; box: Box }
export interface StationGeometry extends MapStation { point: Point; suggested: boolean; marker: Marker; licencePoint: Point | undefined; ruleCount: RuleCount | undefined }
export interface MapGeometry {
  kind?: MapModel['kind'];
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
const RULE_COUNT_HEIGHT = 16;
/** The rule count's text size; textWidth measures 13-unit text. */
export const RULE_COUNT_FONT_SIZE = 11;

/** The rule count of a station with rules, centred where a licence marker would be (metro-map, Rule count on skills stations). */
function ruleCount(rules: number | undefined, box: Box): RuleCount | undefined {
  if (!rules || rules < 1) return undefined;
  const text = rules > 99 ? '99+' : String(rules);
  const h = RULE_COUNT_HEIGHT;
  const w = text.length === 1 ? h : Math.max(h, textWidth(text) * RULE_COUNT_FONT_SIZE / 13 + 8);
  const centre: Point = [box.x + box.w + 3, box.y - 3];
  return { text, box: { x: centre[0] - h / 2, y: centre[1] - h / 2, w, h } };
}
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
  const [ends, spread] = kind === 'stop' ? [[contacts[0]!, contacts[0]!] as [Point, Point], 0] : capsuleAxis(contacts);
  const markerRadius = kind === 'stop' ? radius : radius + INTERCHANGE_EXTRA + spread;
  const box = bounding(ends, markerRadius);
  const halo = Math.hypot(ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]) / 2 + markerRadius + 6;
  // The licence marker sits on the circle's upper right, just outside its outline.
  const licencePoint: Point | undefined = station.licence === 'none' ? undefined : [box.x + box.w + 3, box.y - 3];
  return { ...station, point, suggested, marker: { kind, box, contacts, ends, radius: markerRadius, halo }, licencePoint, ruleCount: ruleCount(station.rules, box) };
}

/** The capsule's axis in linear time (a station can have very many contacts): the direction from the
 * first contact to the one farthest from it; the ends are the extreme projections on that direction,
 * so every contact projects inside the segment and lies at most `spread` off it. */
function capsuleAxis(contacts: Point[]): [[Point, Point], number] {
  const origin = contacts[0]!;
  let far = origin;
  let longest = 0;
  for (const point of contacts) {
    const length = Math.hypot(point[0] - origin[0], point[1] - origin[1]);
    if (length > longest) {
      longest = length;
      far = point;
    }
  }
  if (longest < 1e-9) return [[origin, origin], 0];
  const u: Point = [(far[0] - origin[0]) / longest, (far[1] - origin[1]) / longest];
  let low = Infinity;
  let high = -Infinity;
  let spread = 0;
  for (const point of contacts) {
    const along = (point[0] - origin[0]) * u[0] + (point[1] - origin[1]) * u[1];
    const across = Math.abs(-(point[0] - origin[0]) * u[1] + (point[1] - origin[1]) * u[0]);
    if (along < low) low = along;
    if (along > high) high = along;
    if (across > spread) spread = across;
  }
  const at = (t: number): Point => [origin[0] + u[0] * t, origin[1] + u[1] * t];
  return [[at(low), at(high)], spread];
}

/** Skills maps (metro-map, Playbook zone titles): a zone whose playbook is drawn gets its title next to
 * that station, as a second label, so overlapping zones never show a title over the wrong area. The
 * candidates are the station labels' own; `taken` holds every obstacle a label avoids plus the station
 * labels, and grows with each title. A zone whose playbook is not drawn keeps its corner title. */
function placeZoneTitles(zones: ZoneGeometry[], stations: StationGeometry[], taken: Obstacle[]): void {
  const corner = new Set<ZoneGeometry>();
  for (const zone of zones) {
    const station = stations.find(item => item.ref === `playbook:${zone.name}`);
    if (!station) { corner.add(zone); continue; }
    const marker = station.marker.box;
    const gap = Math.max(marker.w, marker.h) / 2 + 10;
    const centre: Point = [marker.x + marker.w / 2, marker.y + marker.h / 2];
    // The corner title was an obstacle for the station labels; it no longer exists.
    const others = taken.filter(obstacle => obstacle !== zone.titleBox);
    zone.titleBox = chooseLabel(labelCandidates(centre, zone.titleBox.w, zone.titleBox.h, gap), others);
    taken.push(zone.titleBox);
  }
  stackCornerTitles(zones, corner);
}

/** Obstacles of a drawn path (metro-map: Label placement, Arc obstacles): each straight part a
 * rectangle as wide as the casing; each arc as chords of at most 15 degrees, each widened by twice
 * its sagitta and lengthened by half the casing width at both ends, so the painted curve, its outer
 * edge and its joints stay inside. */
export function pathObstacles(path: PathPart[], width: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!.to;
    const { to, arc } = path[i]!;
    if (!arc) { obstacles.push(segmentObstacle(from, to, width)); continue; }
    const [cx, cy] = arc.centre;
    const start = Math.atan2(from[1] - cy, from[0] - cx);
    let sweep = Math.atan2(to[1] - cy, to[0] - cx) - start;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 12) - 1e-9));
    const step = sweep / steps;
    const sagitta = arc.radius * (1 - Math.cos(step / 2));
    const at = (k: number): Point => [cx + arc.radius * Math.cos(start + step * k), cy + arc.radius * Math.sin(start + step * k)];
    for (let k = 0; k < steps; k++) {
      const a = at(k), b = at(k + 1);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const along: Point = [(b[0] - a[0]) / length * width / 2, (b[1] - a[1]) / length * width / 2];
      obstacles.push(segmentObstacle([a[0] - along[0], a[1] - along[1]], [b[0] + along[0], b[1] + along[1]], width + 2 * sagitta));
    }
  }
  return obstacles;
}

export function layoutMap(model: MapModel, lineWidth = themes.light.lineWidth, ink: Ink = inkOf(themes.light), bendRadius = themes.light.bendRadius): MapGeometry {
  const { positions, suggestions } = suggestPositions(model);
  const routes = routeMap(model, positions);
  // Bundled pipes sit so that each casing just meets its neighbour's colour: no overlap, ink between.
  const lines = parallelLines(model, routes, lineWidth + ink.casing / 2, { radius: bendRadius, outer: lineWidth + ink.casing, stations: [...positions.values()] });
  const pointMap = new Map([...positions].map(([ref, cell]) => [ref, [cell[0] * GRID, cell[1] * GRID] as Point]));
  const radius = stopRadius(lineWidth, ink);
  const stations = model.stations.map(station =>
    stationGeometry(station, pointMap.get(station.ref)!, lines, suggestions.some(item => item.ref === station.ref), radius));

  const segments: Obstacle[] = [];
  for (const line of lines) segments.push(...pathObstacles(line.path, lineWidth + ink.casing));
  const licenceBoxes: Box[] = stations.flatMap(station => {
    const centre = station.licencePoint;
    if (!centre) return [];
    return [{ x: centre[0] - LICENCE_RADIUS, y: centre[1] - LICENCE_RADIUS, w: LICENCE_RADIUS * 2, h: LICENCE_RADIUS * 2 }];
  });
  // A rule count is a station marker for placement: labels, badges and zone titles avoid it, and the frame holds it.
  const ruleBoxes: Box[] = stations.flatMap(station => station.ruleCount ? [station.ruleCount.box] : []);
  const markers: Box[] = [...stations.map(station => station.marker.box), ...licenceBoxes, ...ruleBoxes].map(box => inkBox(box, ink));
  const badges = placeBadges(lines, [...markers, ...segments], ink);
  const zones = zoneGeometry(model, pointMap);
  // Labels keep a little air from stickers, so text never touches an outline or shadow.
  const clear = (box: Box): Box => ({ x: box.x - LABEL_CLEARANCE, y: box.y - LABEL_CLEARANCE, w: box.w + LABEL_CLEARANCE * 2, h: box.h + LABEL_CLEARANCE * 2 });
  const obstacles: Obstacle[] = [...markers.map(clear), ...badges.map(badge => clear(inkBox(badge.box, ink))), ...zones.map(zone => zone.titleBox), ...segments];
  const labels = placeLabels(stations, obstacles);
  if (model.kind === 'skills') placeZoneTitles(zones, stations, [...obstacles, ...labels.map(label => label.box)]);

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

  const symbols = model.kind === 'skills' ? ['interchange', 'number of rules', 'suggested position']
    : ['interchange', 'licence', 'licence to buy', 'suggested position', ...(model.view === 'full' ? ['renewal within 30 days'] : [])];
  const legendWidth = model.lines.reduce((width, line) => Math.max(width, textWidth(line.title) + badgeWidth(line.badge) + 96), 310);
  const legendBox: Box = { x: frame.x + frame.w + 28, y: frame.y + 12, w: legendWidth, h: 110 + model.lines.length * 30 + symbols.length * 32 };
  const viewBox: Box = {
    x: frame.x - 16,
    y: frame.y - 88,
    w: frame.w + legendBox.w + 60,
    h: Math.max(frame.h, legendBox.h + 24) + 104,
  };
  return {
    ...(model.kind ? { kind: model.kind } : {}),
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
