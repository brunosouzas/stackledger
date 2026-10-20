/** Render plain geometry as a self-contained, safe SVG. Call renderSvg(geometry, themes.light).
 * Text has one escaping path; geometry has no external resources, IDs, links or CSS.
 * Every visual choice comes from Theme data. Invalid colours/nonfinite geometry throw.
 * Strokes, stations, labels, terminal badges and legend entries carry data-line (and stations
 * and labels data-zone) for the site's map script; those values are escaped like text.
 */
import type { MapGeometry, Marker, Badge, StationGeometry } from './layout.js';
import type { Point } from './model.js';
import type { Theme } from './themes.js';
import type { Box } from './labels.js';
import type { ZoneGeometry } from './zones.js';
import type { Stroke } from './parallel.js';
import { badgeWidth } from './badges.js';
import { tag, escapeXml, number, color, tint, SVG_NAMESPACE, type Attributes } from './xml.js';

export { escapeXml } from './xml.js';

const HEADER_HEIGHT = 64;

/** Element builders bound to one theme. Catalogue text only ever passes through `text` or `title`. */
function painter(theme: Theme) {
  const text = (value: string, x: number, y: number, attrs: Attributes = {}): string =>
    tag('text', { x, y, fill: theme.text, 'font-size': 13, ...attrs }, escapeXml(value));
  const title = (value: string): string => tag('title', {}, escapeXml(value));
  const rect = (box: Box, attrs: Attributes = {}): string =>
    tag('rect', { x: box.x, y: box.y, width: box.w, height: box.h, ...attrs });
  const line = (a: Point, b: Point, attrs: Attributes): string =>
    tag('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...attrs });
  const circle = (centre: Point, r: number, attrs: Attributes): string =>
    tag('circle', { cx: centre[0], cy: centre[1], r, ...attrs });
  const shiftBox = (box: Box): Box => ({ ...box, x: box.x + theme.shadow.dx, y: box.y + theme.shadow.dy });
  const shift = (point: Point): Point => [point[0] + theme.shadow.dx, point[1] + theme.shadow.dy];

  const badge = (item: Omit<Badge, 'line'>): string => [
    theme.shadow.enabled ? rect(shiftBox(item.box), { fill: theme.shadow.color, rx: 3 }) : '',
    rect(item.box, { fill: item.color, rx: 3 }),
    text(item.text, item.point[0], item.point[1] + 4.5, { fill: theme.badgeText, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' }),
  ].join('');

  const marker = (item: Marker, muted: boolean, strokeColor: string, shadow = false): string => {
    if (item.kind === 'interchange') {
      const fill = shadow ? theme.shadow.color : muted ? theme.muted : theme.station;
      const outline = shadow ? theme.shadow.color : muted ? theme.muted : theme.outline;
      return rect(shadow ? shiftBox(item.box) : item.box, { fill, stroke: outline, 'stroke-width': 3, rx: 7 });
    }
    const stroke = shadow ? theme.shadow.color : muted ? theme.muted : strokeColor;
    return line(shadow ? shift(item.a) : item.a, shadow ? shift(item.b) : item.b, { stroke, 'stroke-width': theme.lineWidth - 1, 'stroke-linecap': 'butt' });
  };

  const licence = (centre: Point, hollow: boolean): string =>
    circle(centre, 4, { fill: hollow ? 'none' : theme.licence, stroke: theme.licence, 'stroke-width': 1.8 });

  return { text, title, rect, line, circle, shiftBox, badge, marker, licence };
}

type Painter = ReturnType<typeof painter>;

function gridLayer(frame: Box, theme: Theme, paint: Painter): string {
  const parts = [paint.rect(frame, { fill: 'none', stroke: theme.grid, 'stroke-width': 1 })];
  for (let i = 1; i < 6; i++) {
    const x = frame.x + frame.w * i / 6;
    parts.push(paint.line([x, frame.y], [x, frame.y + frame.h], { stroke: theme.grid, 'stroke-width': 1 }));
  }
  for (let i = 1; i < 4; i++) {
    const y = frame.y + frame.h * i / 4;
    parts.push(paint.line([frame.x, y], [frame.x + frame.w, y], { stroke: theme.grid, 'stroke-width': 1 }));
  }
  return parts.join('');
}

function zoneShape(zone: ZoneGeometry, paint: Painter): string {
  color(zone.color);
  if (zone.hull.length === 1) return paint.circle(zone.hull[0]!, zone.padding, { fill: zone.color });
  if (zone.hull.length === 2) {
    return paint.line(zone.hull[0]!, zone.hull[1]!, { stroke: zone.color, 'stroke-width': zone.padding * 2, 'stroke-linecap': 'round' });
  }
  const points = zone.hull.map(point => point.map(number).join(',')).join(' ');
  return tag('polygon', { points, fill: zone.color, stroke: zone.color, 'stroke-width': zone.padding * 2, 'stroke-linejoin': 'round' });
}

function zonesLayer(zones: ZoneGeometry[], theme: Theme, paint: Painter): string {
  return zones.map(zone => {
    const titleColor = tint(zone.color, theme.zoneTitleTint);
    const title = paint.text(zone.title, zone.titleBox.x, zone.titleBox.y + 13, { fill: titleColor, 'font-weight': 700 });
    return tag('g', { opacity: theme.zoneOpacity }, zoneShape(zone, paint)) + title;
  }).join('');
}

function lineGroup(stroke: Stroke, theme: Theme, paint: Painter): string {
  const d = stroke.points.map((point, i) => `${i ? 'L' : 'M'}${number(point[0])},${number(point[1])}`).join(' ');
  const path = (paintColor: string, width: number): string =>
    tag('path', { d, fill: 'none', stroke: paintColor, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const casing = theme.casing.enabled ? path(theme.casing.color, theme.lineWidth + theme.casing.extraWidth) : '';
  return tag('g', { 'data-ref': stroke.ref, 'data-line': stroke.ref }, paint.title(stroke.title) + casing + path(stroke.color, theme.lineWidth));
}

/** data-line (the station's lines, in line order) and data-zone (only for a drawn zone), shared by a station and its label. */
function stationData(station: StationGeometry, drawnZones: ReadonlySet<string>): Attributes {
  const attrs: Attributes = { 'data-line': station.lines.join(' ') };
  if (station.zone !== undefined && drawnZones.has(station.zone)) attrs['data-zone'] = station.zone;
  return attrs;
}

function stationGroup(station: StationGeometry, lines: Stroke[], data: Attributes, theme: Theme, paint: Painter): string {
  const lineColor = lines.find(line => line.ref === station.lines[0])!.color;
  const shadow = theme.shadow.enabled ? paint.marker(station.marker, station.deprecated, lineColor, true) : '';
  const mark = shadow + paint.marker(station.marker, station.deprecated, lineColor);
  const suggested = station.suggested
    ? paint.circle(station.point, 18, { fill: 'none', stroke: theme.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })
    : '';
  const ring = station.renewal ? paint.circle(station.point, 15, { fill: 'none', stroke: theme.renewal, 'stroke-width': 3 }) : '';
  const licence = station.licencePoint ? paint.licence(station.licencePoint, station.licence === 'hollow') : '';
  return tag('g', { 'data-ref': station.ref, ...data }, paint.title(station.title) + suggested + ring + mark + licence);
}

function labelsLayer(geometry: MapGeometry, drawnZones: ReadonlySet<string>, theme: Theme, paint: Painter): string {
  return geometry.labels.map(label => {
    const station = geometry.stations.find(item => item.ref === label.ref)!;
    const attrs = { fill: station.deprecated ? theme.muted : theme.text, 'font-weight': station.lines.length > 1 ? 700 : 500, ...stationData(station, drawnZones) };
    return label.rows.map((row, i) => paint.text(row, label.box.x, label.box.y + 13 + i * 17, attrs)).join('');
  }).join('');
}

function headerLayer(geometry: MapGeometry, theme: Theme, paint: Painter): string {
  const { viewBox } = geometry;
  return paint.rect({ x: viewBox.x, y: viewBox.y, w: viewBox.w, h: HEADER_HEIGHT }, { fill: theme.header })
    + paint.text('Software map', viewBox.x + 32, viewBox.y + 42, { fill: theme.headerText, 'font-size': 29, 'font-weight': 700 })
    + paint.text(`stackledger · ${geometry.view} view`, viewBox.x + 320, viewBox.y + 40, { fill: theme.headerText });
}

function legendSymbol(symbol: string, centre: Point, theme: Theme, paint: Painter): string {
  if (symbol === 'interchange') return paint.circle(centre, 7, { fill: theme.station, stroke: theme.outline, 'stroke-width': 3 });
  if (symbol === 'licence' || symbol === 'licence to buy') return paint.licence(centre, symbol === 'licence to buy');
  if (symbol === 'suggested position') {
    return paint.circle(centre, 10, { fill: 'none', stroke: theme.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
  }
  return paint.circle(centre, 10, { fill: 'none', stroke: theme.renewal, 'stroke-width': 3 });
}

function legendLayer(geometry: MapGeometry, theme: Theme, paint: Painter): string {
  const panel = geometry.legend.box;
  const parts: string[] = [];
  let y = panel.y + 28;
  if (theme.shadow.enabled) parts.push(paint.rect(paint.shiftBox(panel), { fill: theme.shadow.color, rx: 8 }));
  parts.push(paint.rect(panel, { fill: theme.panel, rx: 8 }));
  parts.push(paint.text('Lines (journeys)', panel.x + 18, y, { 'font-size': 16, 'font-weight': 700 }));
  y += 30;
  for (const item of geometry.legend.lines) {
    // The same badge width as on the map; the sample and title move right of wider badges.
    const box: Box = { x: panel.x + 18, y: y - 15, w: badgeWidth(item.badge), h: 20 };
    const right = box.x + box.w;
    const entry = paint.badge({ point: [box.x + box.w / 2, y - 5], box, text: item.badge, color: item.color })
      + paint.line([right + 18, y - 5], [right + 47, y - 5], { stroke: item.color, 'stroke-width': theme.lineWidth })
      + paint.text(item.title, right + 60, y);
    parts.push(tag('g', { 'data-line': item.ref }, entry));
    y += 30;
  }
  y += 18;
  parts.push(paint.text('Symbols', panel.x + 18, y, { 'font-size': 16, 'font-weight': 700 }));
  y += 30;
  for (const symbol of geometry.legend.symbols) {
    parts.push(legendSymbol(symbol, [panel.x + 28, y - 4], theme, paint));
    parts.push(paint.text(symbol[0]!.toUpperCase() + symbol.slice(1), panel.x + 52, y));
    y += 32;
  }
  return parts.join('');
}

export function renderSvg(geometry: MapGeometry, theme: Theme): string {
  const paint = painter(theme);
  const background = paint.rect(geometry.viewBox, { fill: theme.background });
  const drawnZones = new Set(geometry.zones.map(zone => zone.name.toLowerCase()));
  const badges = geometry.badges.map(badge => tag('g', { 'data-line': badge.line }, paint.badge(badge))).join('');
  const lines = geometry.lines.map(stroke => lineGroup(stroke, theme, paint)).join('') + badges;
  const stations = geometry.stations
    .map(station => stationGroup(station, geometry.lines, stationData(station, drawnZones), theme, paint))
    .join('');
  const empty = geometry.lines.length ? '' : paint.text('No journeys yet', geometry.frame.x + 32, geometry.frame.y + 64, { 'font-size': 22 });
  const layers = [
    background,
    gridLayer(geometry.frame, theme, paint),
    zonesLayer(geometry.zones, theme, paint),
    lines,
    stations,
    labelsLayer(geometry, drawnZones, theme, paint) + empty,
    headerLayer(geometry, theme, paint),
    legendLayer(geometry, theme, paint),
  ].map(content => tag('g', {}, content)).join('\n');
  const { viewBox } = geometry;
  const attrs: Attributes = {
    xmlns: SVG_NAMESPACE,
    role: 'img',
    viewBox: [viewBox.x, viewBox.y, viewBox.w, viewBox.h].map(number).join(' '),
    width: viewBox.w,
    height: viewBox.h,
    'font-family': theme.font,
  };
  const head = tag('title', {}, 'Software map') + tag('desc', {}, 'Software journeys, stations, licences and zones.');
  return tag('svg', attrs, head + '\n' + layers);
}
