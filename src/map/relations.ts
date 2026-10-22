/** Relation diagram of one skill, playbook or agent: what brings it in on the left, the item in the
 * centre, what it brings in on the right, as a safe SVG in the neighbourhood diagram's style
 * (skills-site spec: Relation diagram, Relation diagram safety, Relation diagram budget, Diagram links).
 *
 * Why: the site's item pages show the declared relations `stackledger skills map` draws in Markdown,
 * as a picture the page can link from. Call relations(graph, node) for the plain input (undefined when
 * a side is over the budget), then renderRelations(input, theme). Pure functions, no I/O.
 *
 * Layout: as src/map/neighbourhood.ts (three columns in a 1,200-unit drawing that the page scales), but
 * each box is as wide as its name, cut at 64 code points, so the shown name is never cut further. Box
 * shapes follow the Markdown map: skill a box with a small radius, playbook a pill, agent a hexagon.
 * Each side box names its relation kind (loads, uses, preloads) on a second line; the centre its kind.
 *
 * Safety: every element goes through tag() and every text through escapeXml (src/map/xml.ts); names
 * lose control and format characters. Each box carries data-ref with the item's station reference
 * (src/skills/metro.ts), which the page script turns into a link; the page lists the same items.
 */
import { incoming, outgoing, type MapNode, type NodeKind, type RelationKind, type SkillGraph } from '../skills/graph.js';
import { cleanText, stationRef } from '../skills/metro.js';
import { sticker, type Shape } from './ink.js';
import { textWidth } from './labels.js';
import type { Theme } from './themes.js';
import { escapeXml, number, SVG_NAMESPACE, tag, type Attributes } from './xml.js';

export interface RelationNode { ref: string; name: string; kind: NodeKind; relation?: RelationKind }
export interface Relations { centre: RelationNode; left: RelationNode[]; right: RelationNode[] }

/** Most boxes on one side; over it the page gives the number of relations instead of a diagram. */
export const MAX_SIDE_ITEMS = 100;
/** Most code points of a name a box shows before `…`. */
export const MAX_NAME_CODE_POINTS = 64;
const DIAGRAM_WIDTH = 1200;
const BOX_HEIGHT = 46;
const ROW_GAP = 14;
const MIN_COLUMN_GAP = 96;
const PADDING = 24;
const HEADING_HEIGHT = 34;
const TEXT_INSET = 16;
const MIN_BOX_WIDTH = 160;
const BOLD_FACTOR = 1.1;
const SKILL_RADIUS = 6;
const INK_SCALE = 1.6;

const node = (item: MapNode, relation?: RelationKind): RelationNode =>
  ({ ref: stationRef(item.kind, item.name), name: item.name, kind: item.kind, ...(relation ? { relation } : {}) });

/** Plain input for one item: what brings it in and what it brings in, in list order; undefined over the budget. */
export function relations(graph: SkillGraph, item: MapNode): Relations | undefined {
  const left = incoming(graph, item).map(edge => node(edge.from, edge.kind));
  const right = outgoing(graph, item).map(edge => node(edge.to, edge.kind));
  if (left.length > MAX_SIDE_ITEMS || right.length > MAX_SIDE_ITEMS) return undefined;
  return { centre: node(item), left, right };
}

/** The name a box shows: cleaned, at most 64 code points, then `…`. */
export function shownName(name: string): string {
  const points = Array.from(cleanText(name));
  return points.length > MAX_NAME_CODE_POINTS ? points.slice(0, MAX_NAME_CODE_POINTS).join('') + '…' : points.join('');
}

function columnWidth(nodes: RelationNode[]): number {
  const widest = nodes.reduce((most, item) => Math.max(most, textWidth(shownName(item.name)) * BOLD_FACTOR + TEXT_INSET * 2), 0);
  return Math.ceil(Math.max(MIN_BOX_WIDTH, widest));
}
const stackHeight = (count: number) => count * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;

/** The outline of a box of `kind` at (x, y), moved by `by`. */
function shapeOf(kind: NodeKind, x: number, y: number, width: number): Shape {
  if (kind === 'agent') {
    const cut = BOX_HEIGHT / 2;
    return (by, attrs) => {
      const [left, top] = [x + by[0], y + by[1]];
      const points: [number, number][] = [[left + cut, top], [left + width - cut, top], [left + width, top + cut], [left + width - cut, top + BOX_HEIGHT], [left + cut, top + BOX_HEIGHT], [left, top + cut]];
      return tag('polygon', { points: points.map(point => point.map(number).join(',')).join(' '), ...attrs });
    };
  }
  const rx = kind === 'playbook' ? BOX_HEIGHT / 2 : SKILL_RADIUS;
  return (by, attrs) => tag('rect', { x: x + by[0], y: y + by[1], width, height: BOX_HEIGHT, rx, ...attrs });
}

function box(item: RelationNode, x: number, y: number, width: number, theme: Theme, centre: boolean): string {
  const ink = centre ? theme.outline : theme.text;
  const name = cleanText(item.name);
  const content = tag('title', {}, escapeXml(name))
    + sticker(theme, shapeOf(item.kind, x, y, width), centre ? theme.accent : theme.panel, INK_SCALE)
    + tag('text', { x: x + TEXT_INSET, y: y + 20, fill: ink, 'font-size': 13, 'font-weight': 700 }, escapeXml(shownName(item.name)))
    + tag('text', { x: x + TEXT_INSET, y: y + 37, fill: centre ? theme.outline : theme.muted, 'font-size': 11 }, centre ? item.kind : item.relation ?? item.kind);
  return tag('g', { 'data-ref': item.ref }, content);
}

function nothing(x: number, y: number, width: number, theme: Theme): string {
  return tag('rect', { x, y, width, height: BOX_HEIGHT, rx: 6, fill: 'none', stroke: theme.muted, 'stroke-width': 1, 'stroke-dasharray': '5 4' })
    + tag('text', { x: x + width / 2, y: y + 28, fill: theme.muted, 'font-size': 13, 'text-anchor': 'middle' }, 'Nothing');
}

interface Column { nodes: RelationNode[]; x: number; width: number; top: number }
function column(input: Column, centreTop: number, theme: Theme): string {
  if (!input.nodes.length) return nothing(input.x, centreTop, input.width, theme);
  return input.nodes.map((item, i) => box(item, input.x, input.top + i * (BOX_HEIGHT + ROW_GAP), input.width, theme, false)).join('');
}
function edges(input: Column, fromX: number, toX: number, centreY: number, theme: Theme): string {
  const middle = (fromX + toX) / 2;
  return input.nodes.map((_, i) => {
    const y = input.top + i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
    return tag('path', { d: `M${number(fromX)},${number(y)} C${number(middle)},${number(y)} ${number(middle)},${number(centreY)} ${number(toX)},${number(centreY)}`, fill: 'none', stroke: theme.text, 'stroke-width': 2.5 });
  }).join('');
}

export function renderRelations(input: Relations, theme: Theme): string {
  const rows = Math.max(input.left.length, input.right.length, 1);
  const top = PADDING + HEADING_HEIGHT;
  const height = top + stackHeight(rows) + PADDING;
  const centreTop = top + (stackHeight(rows) - BOX_HEIGHT) / 2;
  const centreY = centreTop + BOX_HEIGHT / 2;
  const centreWidth = columnWidth([input.centre]);
  const leftWidth = columnWidth(input.left), rightWidth = columnWidth(input.right);
  const width = Math.max(DIAGRAM_WIDTH, PADDING * 2 + leftWidth + centreWidth + rightWidth + MIN_COLUMN_GAP * 2);
  const centreX = Math.round((width - centreWidth) / 2);
  const stackTop = (count: number) => top + (stackHeight(rows) - stackHeight(Math.max(count, 1))) / 2;
  const left: Column = { nodes: input.left, x: PADDING, width: leftWidth, top: stackTop(input.left.length) };
  const right: Column = { nodes: input.right, x: width - PADDING - rightWidth, width: rightWidth, top: stackTop(input.right.length) };
  const heading = (text: string, x: number) => tag('text', { x, y: PADDING + 14, fill: theme.text, 'font-size': 13, 'font-weight': 700 }, text);
  const body = [
    tag('rect', { x: 0, y: 0, width, height, fill: theme.background }),
    heading('Brought in by', left.x),
    heading('This item', centreX),
    heading('Brings in', right.x),
    edges(left, left.x + left.width, centreX, centreY, theme),
    edges(right, right.x, centreX + centreWidth, centreY, theme),
    column(left, centreTop, theme),
    box(input.centre, centreX, centreTop, centreWidth, theme, true),
    column(right, centreTop, theme),
  ].join('');
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${height}`, width, height, 'font-family': theme.font };
  const head = tag('title', {}, escapeXml(`Relations of ${cleanText(input.centre.name)}`))
    + tag('desc', {}, 'What brings this item in on the left, what it brings in on the right.');
  return tag('svg', attrs, head + body);
}
