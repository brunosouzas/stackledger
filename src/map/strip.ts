/** Strip diagram of one journey: its served stops in order on a straight line in the line's colour,
 * with a badge for every other drawn line at each stop; plus the small badge SVG used in lists.
 *
 * Why: the site's journey pages (catalogue-site, "Journey pages"). Call strip(model, line) for the
 * plain input, then renderStrip(input, themes.light); renderLineBadge(line) draws one badge.
 * Pure functions, no I/O. Stops come from the map model, so they match the map exactly. The line
 * is a pipe and the stops and badges are ink-style stickers (src/map/ink.ts), as on the map.
 *
 * Safety: every element goes through tag() and every catalogue text through escapeXml
 * (src/map/xml.ts); colours must be #RRGGBB or tag() throws. Stops and interchange badges carry
 * data-ref, which the page script turns into links; the page also lists them as text links.
 */
import { badgeWidth } from './badges.js';
import { sticker, type Shape } from './ink.js';
import { textWidth } from './labels.js';
import type { MapLine, MapModel } from './model.js';
import { themes, type Theme } from './themes.js';
import { escapeXml, SVG_NAMESPACE, tag, type Attributes } from './xml.js';

export interface StripBadge { ref: string; badge: string; color: string; title: string }
export interface StripStop { ref: string; title: string; interchanges: StripBadge[] }
export interface Strip { ref: string; title: string; badge: string; color: string; stops: StripStop[] }

const PADDING = 32;
const LINE_Y = 56;
const MIN_SPACING = 150;
const LABEL_WIDTH = 170;
const BADGE_HEIGHT = 20;
// Wide enough that a badge's shadow and rim do not touch the next badge.
const BADGE_GAP = 8;
const STOP_HIT_MIN_WIDTH = 32;

/** Plain input for one drawn line: its stops with the other drawn lines that stop there, in line order. */
export function strip(model: MapModel, line: MapLine): Strip {
  const stations = new Map(model.stations.map(station => [station.ref, station]));
  const byRef = new Map(model.lines.map(other => [other.ref, other]));
  const badge = (other: MapLine): StripBadge => ({ ref: other.ref, badge: other.badge, color: other.color, title: other.title });
  return {
    ref: line.ref,
    title: line.title,
    badge: line.badge,
    color: line.color,
    stops: line.stops.map(ref => {
      const station = stations.get(ref)!;
      const interchanges = station.lines.filter(other => other !== line.ref).map(other => badge(byRef.get(other)!));
      return { ref, title: station.title, interchanges };
    }),
  };
}

/** Cut a label so it fits under its stop, ending with an ellipsis. */
function fit(title: string): string {
  if (textWidth(title) <= LABEL_WIDTH) return title;
  const chars = Array.from(title);
  while (chars.length > 1 && textWidth(chars.join('') + '…') > LABEL_WIDTH) chars.pop();
  return chars.join('') + '…';
}

/** A badge as an ink-style sticker; `flat` leaves out the shadow and rim and keeps the outline inside the box. */
function badgeShape(item: { badge: string; color: string }, x: number, y: number, theme: Theme, flat = false): string {
  const width = badgeWidth(item.badge);
  const inset = flat ? theme.outlineWidth / 2 : 0;
  const shape: Shape = (by, attrs) => tag('rect', { x: x + inset + by[0], y: y + inset + by[1], width: width - inset * 2, height: BADGE_HEIGHT - inset * 2, rx: 4, ...attrs });
  const face = flat ? shape([0, 0], { fill: item.color, stroke: theme.outline, 'stroke-width': theme.outlineWidth }) : sticker(theme, shape, item.color);
  return face
    + tag('text', { x: x + width / 2, y: y + 14.5, fill: theme.badgeText, 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' }, escapeXml(item.badge));
}

/** One row of interchange badges centred under a stop; each badge links to its journey. */
function interchangeRow(stop: StripStop, centre: number, y: number, theme: Theme): string {
  const total = stop.interchanges.reduce((sum, item) => sum + badgeWidth(item.badge), 0) + (stop.interchanges.length - 1) * BADGE_GAP;
  let x = centre - total / 2;
  return stop.interchanges.map(item => {
    const shape = tag('title', {}, escapeXml(item.title)) + badgeShape(item, x, y, theme);
    x += badgeWidth(item.badge) + BADGE_GAP;
    return tag('g', { 'data-ref': item.ref, 'data-line': item.ref }, shape);
  }).join('');
}

function stopGroup(input: Strip, stop: StripStop, x: number, theme: Theme): string {
  const interchange = stop.interchanges.length > 0;
  const disc = (r: number): Shape => (by, attrs) => tag('circle', { cx: x + by[0], cy: LINE_Y + by[1], r, ...attrs });
  // An interchange is a white sticker; a plain stop is a ring in the line's colour inside an ink sticker.
  const marker = interchange
    ? sticker(theme, disc(10), theme.station)
    : sticker(theme, disc(9), theme.outline) + disc(7)([0, 0], { fill: theme.station, stroke: input.color, 'stroke-width': 3 });
  const title = fit(stop.title);
  const label = tag('text', { x, y: LINE_Y + 36, fill: theme.text, 'font-size': 13, 'font-weight': interchange ? 900 : 700, 'text-anchor': 'middle' }, escapeXml(title));
  // An invisible area over the marker and its label, so a click between them still opens the stop.
  const hitWidth = Math.max(STOP_HIT_MIN_WIDTH, textWidth(title) + 16);
  const hit = tag('rect', { x: x - hitWidth / 2, y: LINE_Y - 14, width: hitWidth, height: 56, fill: theme.background, 'fill-opacity': 0 });
  const lines = [input.ref, ...stop.interchanges.map(item => item.ref)].join(' ');
  return tag('g', { 'data-ref': stop.ref, 'data-line': lines }, tag('title', {}, escapeXml(stop.title)) + hit + marker + label);
}

/** The journey's line as a pipe: the ink casing, then the line's colour. */
function pipe(from: number, to: number, color: string, theme: Theme): string {
  const stroke = (paint: string, width: number) => tag('line', { x1: from, y1: LINE_Y, x2: to, y2: LINE_Y, stroke: paint, 'stroke-width': width, 'stroke-linecap': 'round' });
  return (theme.casing.enabled ? stroke(theme.casing.color, theme.lineWidth + theme.casing.extraWidth) : '') + stroke(color, theme.lineWidth);
}

export function renderStrip(input: Strip, theme: Theme): string {
  const widest = input.stops.reduce((most, stop) => Math.max(most, textWidth(fit(stop.title))), 0);
  const spacing = Math.max(MIN_SPACING, widest + 28);
  const first = PADDING + spacing / 2;
  const xs = input.stops.map((_, i) => first + i * spacing);
  const last = xs.at(-1) ?? first;
  const hasInterchanges = input.stops.some(stop => stop.interchanges.length > 0);
  const width = last + spacing / 2 + PADDING;
  const height = LINE_Y + (hasInterchanges ? 92 : 60);
  const terminal = (x: number) => badgeShape(input, x - badgeWidth(input.badge) / 2, LINE_Y - 42, theme);
  const body = [
    tag('rect', { x: 0, y: 0, width, height, fill: theme.background }),
    tag('g', { 'data-line': input.ref },
      pipe(first, last, input.color, theme) + terminal(first) + terminal(last)),
    ...input.stops.map((stop, i) => stopGroup(input, stop, xs[i]!, theme)),
    ...input.stops.map((stop, i) => interchangeRow(stop, xs[i]!, LINE_Y + 50, theme)),
  ].join('');
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${height}`, width, height, 'font-family': theme.font };
  const head = tag('title', {}, escapeXml(`Stops of ${input.title}`))
    + tag('desc', {}, 'Stops in order, with the other journeys that stop at each.');
  return tag('svg', attrs, head + body);
}

/** A badge on its own, for the journeys list and legends: the line's code on its colour. */
export function renderLineBadge(line: { badge: string; color: string; title: string }): string {
  const width = badgeWidth(line.badge);
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${BADGE_HEIGHT}`, width, height: BADGE_HEIGHT, 'font-family': themes.light.font };
  // Badge text is white on the line colour in every theme, so one SVG serves both.
  return tag('svg', attrs, tag('title', {}, escapeXml(line.title)) + badgeShape(line, 0, 0, themes.light, true));
}
