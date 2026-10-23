/** Render plain geometry as a self-contained, safe SVG. Call renderSvg(geometry, themes.light).
 * Text has one escaping path; geometry has no external resources, IDs, links or CSS.
 * Every visual choice comes from Theme data. Invalid colours/nonfinite geometry throw.
 * Ink style (theme casing, outline, shadow, rim): lines are pipes, an ink casing under the line
 * colour; interchanges, badges, licence markers, renewal rings and the legend panel get an ink
 * outline, and their hard shadow is a copy moved by the theme offset, drawn first in the same group.
 * Strokes, stations, labels, terminal badges and legend entries carry data-line (and stations
 * and labels data-zone) for the site's map script; those values are escaped like text.
 * renderSvg(geometry, theme, { chrome: false }) leaves out the title band and the legend panel and
 * crops to the map frame: the site's map page shows the title, the line legend and the symbols in
 * HTML (renderSymbol draws one symbol). The default output is what `stackledger map` writes.
 */
import { RULE_COUNT_FONT_SIZE, type MapGeometry, type Marker, type Badge, type RuleCount, type StationGeometry } from './layout.js';
import type { Point } from './model.js';
import type { Theme } from './themes.js';
import type { Box } from './labels.js';
import type { ZoneGeometry } from './zones.js';
import type { Stroke } from './parallel.js';
import { badgeWidth } from './badges.js';
import { sticker } from './ink.js';
import { tag, escapeXml, number, color, tint, SVG_NAMESPACE, type Attributes } from './xml.js';

export { escapeXml } from './xml.js';

const HEADER_HEIGHT = 64;
const FRAME_MARGIN = 16;

/** A capsule (stadium) path: every point within r of the segment a-b, with half circles at both ends. */
function capsulePath(a: Point, b: Point, r: number): string {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n: Point = [-(b[1] - a[1]) / length * r, (b[0] - a[0]) / length * r];
  const p = (point: Point, sign: number) => `${number(point[0] + n[0] * sign)},${number(point[1] + n[1] * sign)}`;
  const radius = number(r);
  return `M${p(a, 1)} L${p(b, 1)} A${radius},${radius} 0 0 0 ${p(b, -1)} L${p(a, -1)} A${radius},${radius} 0 0 0 ${p(a, 1)} Z`;
}

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
  const add = (point: Point, by: Point, scale = 1): Point => [point[0] + by[0] * scale, point[1] + by[1] * scale];
  const rimmed = (width: number): number => width + (theme.rim.enabled ? theme.rim.width * 2 : 0);

  const boxSticker = (box: Box, rx: number, fill: string): string =>
    sticker(theme, (by, attrs) => rect({ ...box, x: box.x + by[0], y: box.y + by[1] }, { ...attrs, rx }), fill);
  const discSticker = (centre: Point, r: number, fill: string): string =>
    sticker(theme, (by, attrs) => circle(add(centre, by), r, attrs), fill);

  /** A ring (renewal) drawn like a pipe bent round: rim and ink bands, then its colour. No shadow:
   * around an interchange and its licence marker a second shadow only darkens the station. */
  const ring = (centre: Point, r: number, colour: string, width: number): string => {
    const ink = width + theme.outlineWidth;
    const band = (stroke: string, strokeWidth: number) => circle(centre, r, { fill: 'none', stroke, 'stroke-width': strokeWidth });
    return [
      theme.rim.enabled ? band(theme.rim.color, rimmed(ink)) : '',
      band(theme.outline, ink),
      band(colour, width),
    ].join('');
  };

  /** Terminal badges are pill stickers, like the banner's labels. */
  const badge = (item: Omit<Badge, 'line'>): string => boxSticker(item.box, item.box.h / 2, item.color)
    + text(item.text, item.point[0], item.point[1] + 4.5, { fill: theme.badgeText, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' });

  /** A stop is a circle sticker on its pipe; an interchange a capsule over all its lines. */
  const marker = (item: Marker, muted: boolean): string => {
    const fill = muted ? theme.muted : theme.station;
    const [a, b] = item.ends;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-9) return discSticker(a, item.radius, fill);
    return sticker(theme, (by, attrs) => tag('path', { d: capsulePath(add(a, by), add(b, by), item.radius), ...attrs }), fill);
  };

  const licence = (centre: Point, hollow: boolean): string => discSticker(centre, 5, hollow ? theme.station : theme.licence);

  /** A rule count: a circle for one digit, a pill for more, in the panel colour, with the number. */
  const ruleCount = (item: RuleCount): string => {
    const { box } = item;
    const shape = box.w === box.h ? discSticker([box.x + box.w / 2, box.y + box.h / 2], box.h / 2, theme.panel) : boxSticker(box, box.h / 2, theme.panel);
    return shape + text(item.text, box.x + box.w / 2, box.y + box.h / 2 + 4, { 'font-size': RULE_COUNT_FONT_SIZE, 'font-weight': 700, 'text-anchor': 'middle' });
  };

  /** A line sample for the legend, drawn as a pipe like the lines on the map. */
  const pipe = (a: Point, b: Point, colour: string): string =>
    (theme.casing.enabled ? line(a, b, { stroke: theme.casing.color, 'stroke-width': theme.lineWidth + theme.casing.extraWidth, 'stroke-linecap': 'round' }) : '')
    + line(a, b, { stroke: colour, 'stroke-width': theme.lineWidth, 'stroke-linecap': 'round' });

  return { text, title, rect, line, circle, boxSticker, discSticker, ring, badge, marker, licence, ruleCount, pipe };
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
  const zones = station.zones.filter(zone => drawnZones.has(zone));
  if (zones.length) attrs['data-zone'] = zones.join(' ');
  return attrs;
}

function stationGroup(station: StationGeometry, data: Attributes, theme: Theme, paint: Painter): string {
  const { box, halo } = station.marker;
  const centre: Point = [box.x + box.w / 2, box.y + box.h / 2];
  const mark = paint.marker(station.marker, station.deprecated);
  const suggested = station.suggested
    ? paint.circle(centre, halo + 3, { fill: 'none', stroke: theme.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })
    : '';
  const ring = station.renewal ? paint.ring(centre, halo, theme.renewal, 3) : '';
  const licence = station.licencePoint ? paint.licence(station.licencePoint, station.licence === 'hollow') : '';
  const rules = station.ruleCount ? paint.ruleCount(station.ruleCount) : '';
  return tag('g', { 'data-ref': station.ref, ...data }, paint.title(station.title) + suggested + ring + mark + licence + rules);
}

function labelsLayer(geometry: MapGeometry, drawnZones: ReadonlySet<string>, theme: Theme, paint: Painter): string {
  return geometry.labels.map(label => {
    const station = geometry.stations.find(item => item.ref === label.ref)!;
    const attrs = { fill: station.deprecated ? theme.muted : theme.text, 'font-weight': station.lines.length > 1 ? 900 : 700, ...stationData(station, drawnZones) };
    return label.rows.map((row, i) => paint.text(row, label.box.x, label.box.y + 13 + i * 17, attrs)).join('');
  }).join('');
}

/** The fixed texts of each kind of map; a skills map depends on no view (metro-map, Skills map drawing). */
function texts(geometry: MapGeometry): { title: string; subtitle: string; empty: string; description: string } {
  return geometry.kind === 'skills'
    ? { title: 'Skills map', subtitle: 'stackledger · skill set', empty: 'No skill lines yet', description: 'Skill lines, stations and playbook zones.' }
    : { title: 'Software map', subtitle: `stackledger · ${geometry.view} view`, empty: 'No journeys yet', description: 'Software journeys, stations, licences and zones.' };
}

function headerLayer(geometry: MapGeometry, theme: Theme, paint: Painter): string {
  const { viewBox } = geometry;
  return paint.rect({ x: viewBox.x, y: viewBox.y, w: viewBox.w, h: HEADER_HEIGHT }, { fill: theme.header })
    + paint.text(texts(geometry).title, viewBox.x + 32, viewBox.y + 42, { fill: theme.headerText, 'font-size': 29, 'font-weight': 700 })
    + paint.text(texts(geometry).subtitle, viewBox.x + 320, viewBox.y + 40, { fill: theme.headerText });
}

function legendSymbol(symbol: string, centre: Point, theme: Theme, paint: Painter): string {
  if (symbol === 'interchange') return paint.discSticker(centre, 6, theme.station);
  if (symbol === 'licence' || symbol === 'licence to buy') return paint.licence(centre, symbol === 'licence to buy');
  // A little smaller than on the map, so the dark theme's rim and shadow stay inside the 24 x 24 symbol.
  if (symbol === 'number of rules') return paint.ruleCount({ text: '3', box: { x: centre[0] - 7.5, y: centre[1] - 7.5, w: 15, h: 15 } });
  if (symbol === 'suggested position') {
    return paint.circle(centre, 9, { fill: 'none', stroke: theme.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
  }
  return paint.ring(centre, 6.5, theme.renewal, 3);
}

function legendLayer(geometry: MapGeometry, theme: Theme, paint: Painter): string {
  const panel = geometry.legend.box;
  const parts: string[] = [];
  let y = panel.y + 28;
  parts.push(paint.boxSticker(panel, 12, theme.panel));
  parts.push(paint.text('Lines (journeys)', panel.x + 18, y, { 'font-size': 16, 'font-weight': 700 }));
  y += 30;
  for (const item of geometry.legend.lines) {
    // The same badge width as on the map; the sample and title move right of wider badges.
    const box: Box = { x: panel.x + 18, y: y - 15, w: badgeWidth(item.badge), h: 20 };
    const right = box.x + box.w;
    const entry = paint.badge({ point: [box.x + box.w / 2, y - 5], box, text: item.badge, color: item.color })
      + paint.pipe([right + 21, y - 5], [right + 44, y - 5], item.color)
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

/** chrome (default true): draw the title band and the legend panel around the map. */
export interface RenderOptions { chrome?: boolean }

/** The frame with a small margin: the viewBox of a map drawn without title band and legend. */
function frameView(geometry: MapGeometry): Box {
  const { frame } = geometry;
  return { x: frame.x - FRAME_MARGIN, y: frame.y - FRAME_MARGIN, w: frame.w + FRAME_MARGIN * 2, h: frame.h + FRAME_MARGIN * 2 };
}

/** One legend symbol on its own (24 x 24), for the HTML legend under the site's map. */
export function renderSymbol(symbol: string, theme: Theme): string {
  const size = 24;
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${size} ${size}`, width: size, height: size };
  // Up and left of the centre, so the shadow down and to the right stays inside the square.
  return tag('svg', attrs, legendSymbol(symbol, [size / 2 - 1.5, size / 2 - 1.5], theme, painter(theme)));
}

export function renderSvg(geometry: MapGeometry, theme: Theme, options: RenderOptions = {}): string {
  const chrome = options.chrome ?? true;
  const viewBox = chrome ? geometry.viewBox : frameView(geometry);
  const paint = painter(theme);
  const background = paint.rect(viewBox, { fill: theme.background });
  const drawnZones = new Set(geometry.zones.map(zone => zone.name.toLowerCase()));
  const badges = geometry.badges.map(badge => tag('g', { 'data-line': badge.line }, paint.badge(badge))).join('');
  const lines = geometry.lines.map(stroke => lineGroup(stroke, theme, paint)).join('') + badges;
  const stations = geometry.stations
    .map(station => stationGroup(station, stationData(station, drawnZones), theme, paint))
    .join('');
  const empty = geometry.lines.length ? '' : paint.text(texts(geometry).empty, geometry.frame.x + 32, geometry.frame.y + 64, { 'font-size': 22 });
  const layers = [
    background,
    gridLayer(geometry.frame, theme, paint),
    zonesLayer(geometry.zones, theme, paint),
    lines,
    stations,
    labelsLayer(geometry, drawnZones, theme, paint) + empty,
    ...(chrome ? [headerLayer(geometry, theme, paint), legendLayer(geometry, theme, paint)] : []),
  ].map(content => tag('g', {}, content)).join('\n');
  const attrs: Attributes = {
    xmlns: SVG_NAMESPACE,
    role: 'img',
    viewBox: [viewBox.x, viewBox.y, viewBox.w, viewBox.h].map(number).join(' '),
    width: viewBox.w,
    height: viewBox.h,
    'font-family': theme.font,
  };
  const head = tag('title', {}, texts(geometry).title) + tag('desc', {}, texts(geometry).description);
  return tag('svg', attrs, head + '\n' + layers);
}
