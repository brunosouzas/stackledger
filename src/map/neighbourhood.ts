/** Neighbourhood diagram of one component: its direct dependencies on the left, the component in
 * the centre and its direct dependants on the right, as a safe SVG in the map's style.
 *
 * Why: the site's component pages show what an item needs and what needs it (catalogue-site,
 * "Neighbourhood diagram"). Call neighbourhood(graph, item) for the plain input, then
 * renderNeighbourhood(input, themes.light). Pure functions, no I/O.
 *
 * Layout: each column is as wide as its longest title (within bounds), the columns sit at the left
 * edge, the middle and the right edge of a 1200-unit drawing that the page scales to its width, and
 * the item, short columns and the "Nothing" placeholders are centred vertically. Linked boxes are
 * ink-style stickers (outline and hard shadow, src/map/ink.ts); the centre item uses the accent fill.
 *
 * Safety: every element goes through tag() and every catalogue text through escapeXml (src/map/xml.ts);
 * only boxes with a page carry data-ref, which the page script turns into a link. A text list on the
 * page holds the same items, so the diagram is never the only way to reach them.
 */
import { compareRefs } from '../identity.js';
import { dependantsOf, type Graph, type Item } from '../graph.js';
import { messageArrow, nodeBlock } from '@brunosouzas/design-system';
import { textWidth } from './labels.js';
import { writePiece } from './pieces.js';
import { checkInk, type Theme } from './themes.js';
import { escapeXml, SVG_NAMESPACE, tag, type Attributes } from './xml.js';

export interface DiagramNode { ref: string; title: string; kind: 'component' | 'licence' | 'resource'; linked: boolean }
export interface Neighbourhood { centre: DiagramNode; dependencies: DiagramNode[]; dependants: DiagramNode[] }

/** Width of the drawing in viewBox units; the page scales it to its column, so it fills the width. */
const DIAGRAM_WIDTH = 1200;
const BOX_HEIGHT = 46;
const ROW_GAP = 14;
const MIN_COLUMN_GAP = 96;
const PADDING = 24;
const HEADING_HEIGHT = 34;
const TEXT_INSET = 12;
/** Boxes are sized to their longest title (bold text is about a tenth wider), within these bounds. */
const MIN_BOX_WIDTH = 160;
const MAX_BOX_WIDTH = 300;
const BOLD_FACTOR = 1.1;
const BOX_RADIUS = 10;
/** The diagram is drawn at about twice the map's scale, so its outline and shadow are larger. */
const INK_SCALE = 1.6;

/** The diagram node of an item: components and licences have pages, other resources do not. */
export function diagramNode(item: Item): DiagramNode {
  const kind = item.kind === 'line' ? 'resource' : item.kind;
  const given = item.kind === 'component' || item.kind === 'licence' ? item.entity.metadata.title ?? item.name : item.name;
  // A title of spaces is valid in the catalogue but empty to the pieces: show the reference (Diagram box titles).
  const title = given.trim() ? given : item.ref;
  return { ref: item.ref, title, kind, linked: kind !== 'resource' };
}

/** Plain input for one component (or licence): resolved direct dependencies and direct dependants, by reference. */
export function neighbourhood(graph: Graph, item: Item): Neighbourhood {
  const nodes = (refs: string[]) => refs
    .map(ref => graph.items.get(ref.toLowerCase())!)
    .sort((one, two) => compareRefs(one.ref, two.ref))
    .map(diagramNode);
  return {
    centre: diagramNode(item),
    dependencies: nodes(graph.dependsOn.get(item.key) ?? []),
    dependants: nodes(dependantsOf(graph, item)),
  };
}

/** Cut a title so it fits a box of `width`, ending with an ellipsis. */
function fit(title: string, width: number): string {
  const room = width - TEXT_INSET * 2;
  const measure = (text: string) => textWidth(text) * BOLD_FACTOR;
  if (measure(title) <= room) return title;
  const chars = Array.from(title);
  while (chars.length > 1 && measure(chars.join('') + '…') > room) chars.pop();
  return chars.join('') + '…';
}

/** One width for a column: its longest title, within the bounds. */
function columnWidth(nodes: DiagramNode[]): number {
  const widest = nodes.reduce((most, node) => Math.max(most, textWidth(node.title) * BOLD_FACTOR + TEXT_INSET * 2), 0);
  return Math.ceil(Math.min(MAX_BOX_WIDTH, Math.max(MIN_BOX_WIDTH, widest)));
}

const stackHeight = (count: number) => count * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;

function box(node: DiagramNode, x: number, y: number, width: number, theme: Theme, centre: boolean): string {
  const common = { x, y, width, height: BOX_HEIGHT, title: fit(node.title, width), surface: theme.surface };
  // A resource without a page is a placeholder (dashed, muted, no shadow), so it does not look clickable.
  const face = node.linked
    ? nodeBlock({ ...common, subtitle: node.kind, state: centre ? 'focus' : 'normal', radius: BOX_RADIUS, inkScale: INK_SCALE })
    : nodeBlock({ ...common, subtitle: node.kind, state: 'placeholder', radius: BOX_RADIUS });
  const content = tag('title', {}, escapeXml(`${node.title} (${node.ref})`)) + writePiece(face);
  return tag('g', node.linked ? { 'data-ref': node.ref } : {}, content);
}

/** An empty column: a dashed placeholder level with the centre box, so the diagram stays balanced. */
function nothing(x: number, y: number, width: number, theme: Theme): string {
  return writePiece(nodeBlock({ x, y, width, height: BOX_HEIGHT, title: 'Nothing', state: 'placeholder', radius: BOX_RADIUS, surface: theme.surface }));
}

interface Column { nodes: DiagramNode[]; x: number; width: number; top: number }

/** Boxes of one column, stacked and centred on the centre box. */
function column(input: Column, centreTop: number, theme: Theme): string {
  if (!input.nodes.length) return nothing(input.x, centreTop, input.width, theme);
  return input.nodes.map((node, i) => box(node, input.x, input.top + i * (BOX_HEIGHT + ROW_GAP), input.width, theme, false)).join('');
}

/** Curved arrows between the inner side of each box of a column and the centre box, pointing right:
 * from a left box to the centre, or from the centre to a right box. */
function edges(input: Column, side: 'left' | 'right', columnX: number, centreX: number, centreY: number, theme: Theme): string {
  return input.nodes.map((_, i) => {
    const y = input.top + i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
    const [from, to]: [[number, number], [number, number]] = side === 'left' ? [[columnX, y], [centreX, centreY]] : [[centreX, centreY], [columnX, y]];
    return writePiece(messageArrow({ from, to, surface: theme.surface }));
  }).join('');
}

export function renderNeighbourhood(input: Neighbourhood, theme: Theme): string {
  checkInk(theme);
  const rows = Math.max(input.dependencies.length, input.dependants.length, 1);
  const top = PADDING + HEADING_HEIGHT;
  const height = top + stackHeight(rows) + PADDING;
  const centreTop = top + (stackHeight(rows) - BOX_HEIGHT) / 2;
  const centreY = centreTop + BOX_HEIGHT / 2;
  const centreWidth = columnWidth([input.centre]);
  const leftWidth = columnWidth(input.dependencies);
  const rightWidth = columnWidth(input.dependants);
  // Spread the columns over the whole drawing: left edge, middle, right edge.
  const width = Math.max(DIAGRAM_WIDTH, PADDING * 2 + leftWidth + centreWidth + rightWidth + MIN_COLUMN_GAP * 2);
  const centreX = Math.round((width - centreWidth) / 2);
  const stackTop = (count: number) => top + (stackHeight(rows) - stackHeight(Math.max(count, 1))) / 2;
  const left: Column = { nodes: input.dependencies, x: PADDING, width: leftWidth, top: stackTop(input.dependencies.length) };
  const right: Column = { nodes: input.dependants, x: width - PADDING - rightWidth, width: rightWidth, top: stackTop(input.dependants.length) };
  const heading = (text: string, x: number) => tag('text', { x, y: PADDING + 14, fill: theme.text, 'font-size': 13, 'font-weight': 700 }, text);
  const body = [
    tag('rect', { x: 0, y: 0, width, height, fill: theme.background }),
    heading('Depends on', left.x),
    heading('This item', centreX),
    heading('Used by', right.x),
    edges(left, 'left', left.x + left.width, centreX, centreY, theme),
    edges(right, 'right', right.x, centreX + centreWidth, centreY, theme),
    column(left, centreTop, theme),
    box(input.centre, centreX, centreTop, centreWidth, theme, true),
    column(right, centreTop, theme),
  ].join('');
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${height}`, width, height, 'font-family': theme.font };
  const head = tag('title', {}, escapeXml(`Neighbourhood of ${input.centre.title}`))
    + tag('desc', {}, 'Direct dependencies on the left, direct dependants on the right.');
  return tag('svg', attrs, head + body);
}
