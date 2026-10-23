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
import { hexNode, messageArrow, nodeBlock, pillNode } from '@brunosouzas/design-system';
import { textWidth } from './labels.js';
import { writePiece } from './pieces.js';
import { checkInk, type Theme } from './themes.js';
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
/** Where nodeBlock starts its text; pills and hexagons start it at half the height. */
const TEXT_INSET = 12;
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

/** The name a box shows, or its station reference when cleaning leaves nothing (Relation box text room). */
const boxName = (item: RelationNode): string => (shownName(item.name).trim() ? shownName(item.name) : item.ref);

/** Where the pieces start the text: 12 in a box, half the height in a pill or a hexagon. */
const insetOf = (kind: NodeKind): number => (kind === 'skill' ? TEXT_INSET : BOX_HEIGHT / 2);

function columnWidth(nodes: RelationNode[]): number {
  const widest = nodes.reduce((most, item) => Math.max(most, textWidth(boxName(item)) * BOLD_FACTOR + insetOf(item.kind) * 2), 0);
  return Math.ceil(Math.max(MIN_BOX_WIDTH, widest));
}
const stackHeight = (count: number) => count * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;

/** Skill a box with a small radius, playbook a pill, agent a hexagon: the design system's node pieces. */
function box(item: RelationNode, x: number, y: number, width: number, theme: Theme, centre: boolean): string {
  const params = {
    x, y, width, height: BOX_HEIGHT, title: boxName(item), subtitle: centre ? item.kind : item.relation ?? item.kind,
    state: centre ? 'focus' as const : 'normal' as const, inkScale: INK_SCALE, surface: theme.surface,
  };
  const drawn = item.kind === 'agent' ? hexNode(params) : item.kind === 'playbook' ? pillNode(params) : nodeBlock({ ...params, radius: SKILL_RADIUS });
  return tag('g', { 'data-ref': item.ref }, tag('title', {}, escapeXml(cleanText(item.name))) + writePiece(drawn));
}

function nothing(x: number, y: number, width: number, theme: Theme): string {
  return writePiece(nodeBlock({ x, y, width, height: BOX_HEIGHT, title: 'Nothing', state: 'placeholder', radius: SKILL_RADIUS, surface: theme.surface }));
}

interface Column { nodes: RelationNode[]; x: number; width: number; top: number }
function column(input: Column, centreTop: number, theme: Theme): string {
  if (!input.nodes.length) return nothing(input.x, centreTop, input.width, theme);
  return input.nodes.map((item, i) => box(item, input.x, input.top + i * (BOX_HEIGHT + ROW_GAP), input.width, theme, false)).join('');
}
/** Arrows pointing right: from a left box to the centre, or from the centre to a right box. */
function edges(input: Column, side: 'left' | 'right', columnX: number, centreX: number, centreY: number, theme: Theme): string {
  return input.nodes.map((_, i) => {
    const y = input.top + i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
    const [from, to]: [[number, number], [number, number]] = side === 'left' ? [[columnX, y], [centreX, centreY]] : [[centreX, centreY], [columnX, y]];
    return writePiece(messageArrow({ from, to, surface: theme.surface }));
  }).join('');
}

export function renderRelations(input: Relations, theme: Theme): string {
  checkInk(theme);
  const rows = Math.max(input.left.length, input.right.length, 1);
  const top = PADDING + HEADING_HEIGHT;
  const height = top + stackHeight(rows) + PADDING;
  const centreTop = top + (stackHeight(rows) - BOX_HEIGHT) / 2;
  const centreY = centreTop + BOX_HEIGHT / 2;
  const centreWidth = columnWidth([input.centre]);
  const leftWidth = columnWidth(input.left), rightWidth = columnWidth(input.right);
  // The centre is centred, so each side reserves the wider side's width: a long name on one side never runs under the centre.
  const side = Math.max(leftWidth, rightWidth);
  const width = Math.max(DIAGRAM_WIDTH, PADDING * 2 + side * 2 + centreWidth + MIN_COLUMN_GAP * 2);
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
    edges(left, 'left', left.x + left.width, centreX, centreY, theme),
    edges(right, 'right', right.x, centreX + centreWidth, centreY, theme),
    column(left, centreTop, theme),
    box(input.centre, centreX, centreTop, centreWidth, theme, true),
    column(right, centreTop, theme),
  ].join('');
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${height}`, width, height, 'font-family': theme.font };
  const head = tag('title', {}, escapeXml(`Relations of ${cleanText(input.centre.name)}`))
    + tag('desc', {}, 'What brings this item in on the left, what it brings in on the right.');
  return tag('svg', attrs, head + body);
}
