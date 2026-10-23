/** Render plain geometry as a self-contained, safe SVG. Call renderSvg(geometry, themes.light).
 * Text has one escaping path; geometry has no external resources, IDs, links or CSS.
 * Every visual choice comes from Theme data. Invalid colours/nonfinite geometry throw.
 * Ink style: stations, interchanges, lines, terminal and legend badges and rule counts are drawn by
 * the design system's pieces (stationMarker, pipe, lineBadge, countBadge), and licence markers,
 * renewal rings, suggested halos and zones by licenceMark, renewalRing, suggestedHalo and zone, all
 * written through src/map/pieces.ts, so the allow-lists and escaping of
 * src/map/xml.ts apply to them; the legend panel keeps this file's drawing with the same token values.
 * A theme whose ink differs from its surface's tokens is refused (checkInk).
 * Strokes, stations, labels, terminal badges and legend entries carry data-line (and stations
 * and labels data-zone) for the site's map script; those values are escaped like text.
 * renderSvg(geometry, theme, { chrome: false }) leaves out the title band and the legend panel and
 * crops to the map frame: the site's map page shows the title, the line legend and the symbols in
 * HTML (renderSymbol draws one symbol). The default output is what `stackledger map` writes.
 */
import { type MapGeometry, type Marker, type Badge, type RuleCount, type StationGeometry } from './layout.js';
import type { Point } from './model.js';
import { checkInk, type Theme } from './themes.js';
import type { Box } from './labels.js';
import type { ZoneGeometry } from './zones.js';
import type { Stroke } from './parallel.js';
import { badgeWidth } from './badges.js';
import { countBadge, licenceMark, lineBadge, pipe as pipePiece, renewalRing, stationMarker, suggestedHalo, zone as zonePiece } from '@brunosouzas/design-system';
import { sticker } from './ink.js';
import { writePiece } from './pieces.js';
import { tag, escapeXml, number, SVG_NAMESPACE, type Attributes } from './xml.js';

export { escapeXml } from './xml.js';

const HEADER_HEIGHT = 64;
const FRAME_MARGIN = 16;

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

  const boxSticker = (box: Box, rx: number, fill: string): string =>
    sticker(theme, (by, attrs) => rect({ ...box, x: box.x + by[0], y: box.y + by[1] }, { ...attrs, rx }), fill);
  const surface = theme.surface;
  /** Terminal badges: the design system's lineBadge, centred on the badge box. */
  const badge = (item: Omit<Badge, 'line'>): string => writePiece(lineBadge({
    x: item.box.x + item.box.w / 2, y: item.box.y + item.box.h / 2, text: item.text, fill: item.color, width: item.box.w, height: item.box.h, surface,
  }));

  /** A stop or an interchange: the design system's stationMarker (a capsule from one end to the other). */
  const marker = (item: Marker, muted: boolean): string => {
    const [a, b] = item.ends;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return writePiece(stationMarker({ cx: a[0], cy: a[1], ...(length < 1e-9 ? {} : { to: b }), r: item.radius, state: muted ? 'deprecated' : 'normal', surface }));
  };

  const licence = (centre: Point, hollow: boolean): string => writePiece(licenceMark({ cx: centre[0], cy: centre[1], state: hollow ? 'toBuy' : 'owned', surface }));

  /** A rule count: a circle for one digit, a pill for more, in the panel colour, with the number. */
  const ruleCount = (item: RuleCount): string => {
    const { box } = item;
    return writePiece(countBadge({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, text: item.text, width: box.w, height: box.h, surface }));
  };

  /** A line sample for the legend, drawn as a pipe like the lines on the map. */
  const pipe = (a: Point, b: Point, colour: string): string =>
    writePiece(pipePiece({ d: `M${number(a[0])},${number(a[1])} L${number(b[0])},${number(b[1])}`, fill: colour, width: theme.lineWidth, casing: theme.casing.extraWidth }));

  /** The legend's interchange: a short vertical capsule, as interchanges on a horizontal edge. */
  const interchangeSymbol = (centre: Point): string =>
    writePiece(stationMarker({ cx: centre[0], cy: centre[1] - 1.5, to: [centre[0], centre[1] + 1.5], r: 6, surface }));

  return { text, title, rect, line, circle, boxSticker, badge, marker, licence, ruleCount, pipe, interchangeSymbol };
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

function zonesLayer(zones: ZoneGeometry[], theme: Theme): string {
  return zones.map(zone => {
    // The piece refuses a blank label; a whitespace-only title (which the catalogue accepts) draws the area alone.
    const title = zone.title.trim() === '' ? {} : { title: zone.title, titleAt: [zone.titleBox.x, zone.titleBox.y] as Point };
    return writePiece(zonePiece({ points: zone.hull, fill: zone.color, ...title, surface: theme.surface }));
  }).join('');
}

function lineGroup(stroke: Stroke, theme: Theme, paint: Painter): string {
  const d = stroke.points.map((point, i) => `${i ? 'L' : 'M'}${number(point[0])},${number(point[1])}`).join(' ');
  const body = writePiece(pipePiece({ d, fill: stroke.color, width: theme.lineWidth, casing: theme.casing.enabled ? theme.casing.extraWidth : 0 }));
  return tag('g', { 'data-ref': stroke.ref, 'data-line': stroke.ref }, paint.title(stroke.title) + body);
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
    ? writePiece(suggestedHalo({ cx: centre[0], cy: centre[1], r: halo + 3, surface: theme.surface }))
    : '';
  const ring = station.renewal ? writePiece(renewalRing({ cx: centre[0], cy: centre[1], r: halo, surface: theme.surface })) : '';
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
  if (symbol === 'interchange') return paint.interchangeSymbol(centre);
  if (symbol === 'licence' || symbol === 'licence to buy') return paint.licence(centre, symbol === 'licence to buy');
  // A little smaller than on the map, so the dark theme's rim and shadow stay inside the 24 x 24 symbol.
  if (symbol === 'number of rules') return paint.ruleCount({ text: '3', box: { x: centre[0] - 7.5, y: centre[1] - 7.5, w: 15, h: 15 } });
  if (symbol === 'suggested position') {
    return writePiece(suggestedHalo({ cx: centre[0], cy: centre[1], r: 9, surface: theme.surface }));
  }
  return writePiece(renewalRing({ cx: centre[0], cy: centre[1], r: 6.5, surface: theme.surface }));
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
  checkInk(theme);
  const size = 24;
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${size} ${size}`, width: size, height: size };
  // Up and left of the centre, so the shadow down and to the right stays inside the square.
  return tag('svg', attrs, legendSymbol(symbol, [size / 2 - 1.5, size / 2 - 1.5], theme, painter(theme)));
}

export function renderSvg(geometry: MapGeometry, theme: Theme, options: RenderOptions = {}): string {
  checkInk(theme);
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
    zonesLayer(geometry.zones, theme),
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
