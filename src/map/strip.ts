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
import { lineBadge, pipe as pipePiece, stationMarker } from '@brunosouzas/design-system';
import { textWidth } from './labels.js';
import type { MapLine, MapModel } from './model.js';
import { writePiece } from './pieces.js';
import { checkInk, themes, type Theme } from './themes.js';
import { escapeXml, number, SVG_NAMESPACE, tag, type Attributes } from './xml.js';

/** Half the length of an interchange capsule on the strip (its ends are the interchange radius away). */
const INTERCHANGE_HALF = 4;

export interface StripBadge { ref: string; badge: string; color: string; title: string }
export interface StripStop { ref: string; title: string; interchanges: StripBadge[] }
export interface Strip { ref: string; title: string; badge: string; color: string; stops: StripStop[] }

const PADDING = 32;
const LINE_Y = 56;
const MIN_SPACING = 150;
const LABEL_WIDTH = 170;
const BADGE_HEIGHT = 20;
// Wide enough that a badge's shadow and rim do not touch the next badge.
const BADGE_GAP = 11;
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
  return writePiece(lineBadge({ x: x + width / 2, y: y + BADGE_HEIGHT / 2, text: item.badge, fill: item.color, width, height: BADGE_HEIGHT, flat, surface: theme.surface }));
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
  // Every stop is a white circle on the pipe, as on the map; an interchange a short vertical capsule.
  const marker = writePiece(interchange
    ? stationMarker({ cx: x, cy: LINE_Y - INTERCHANGE_HALF, to: [x, LINE_Y + INTERCHANGE_HALF], surface: theme.surface })
    : stationMarker({ cx: x, cy: LINE_Y, r: stopRadius(theme), surface: theme.surface }));
  const title = fit(stop.title);
  const label = tag('text', { x, y: LINE_Y + 36, fill: theme.text, 'font-size': 13, 'font-weight': interchange ? 900 : 700, 'text-anchor': 'middle' }, escapeXml(title));
  // An invisible area over the marker and its label, so a click between them still opens the stop.
  const hitWidth = Math.max(STOP_HIT_MIN_WIDTH, textWidth(title) + 16);
  const hit = tag('rect', { x: x - hitWidth / 2, y: LINE_Y - 18, width: hitWidth, height: 60, fill: theme.background, 'fill-opacity': 0 });
  const lines = [input.ref, ...stop.interchanges.map(item => item.ref)].join(' ');
  return tag('g', { 'data-ref': stop.ref, 'data-line': lines }, tag('title', {}, escapeXml(stop.title)) + hit + marker + label);
}

/** A stop circle a little wider than the pipe, as on the map. */
const stopRadius = (theme: Theme): number => (theme.lineWidth + (theme.casing.enabled ? theme.casing.extraWidth : 0)) / 2 + 3;

/** The journey's line as a pipe: the ink casing, then the line's colour. */
function pipe(from: number, to: number, color: string, theme: Theme): string {
  return writePiece(pipePiece({ d: `M${number(from)},${LINE_Y} L${number(to)},${LINE_Y}`, fill: color, width: theme.lineWidth, casing: theme.casing.enabled ? theme.casing.extraWidth : 0 }));
}

export function renderStrip(input: Strip, theme: Theme): string {
  checkInk(theme);
  const widest = input.stops.reduce((most, stop) => Math.max(most, textWidth(fit(stop.title))), 0);
  const spacing = Math.max(MIN_SPACING, widest + 28);
  const first = PADDING + spacing / 2;
  const xs = input.stops.map((_, i) => first + i * spacing);
  const last = xs.at(-1) ?? first;
  const hasInterchanges = input.stops.some(stop => stop.interchanges.length > 0);
  const width = last + spacing / 2 + PADDING;
  const height = LINE_Y + (hasInterchanges ? 92 : 60);
  // High enough that the badge's shadow clears the rim of an interchange at the end of the line.
  const terminal = (x: number) => badgeShape(input, x - badgeWidth(input.badge) / 2, LINE_Y - 48, theme);
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
