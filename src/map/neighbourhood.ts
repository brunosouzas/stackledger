/** Neighbourhood diagram of one component: its direct dependencies on the left, the component in
 * the centre and its direct dependants on the right, as a safe SVG in the map's style.
 *
 * Why: the site's component pages show what an item needs and what needs it (catalogue-site,
 * "Neighbourhood diagram"). Call neighbourhood(graph, item) for the plain input, then
 * renderNeighbourhood(input, themes.light). Pure functions, no I/O.
 *
 * Safety: every element goes through tag() and every catalogue text through escapeXml (src/map/xml.ts);
 * only boxes with a page carry data-ref, which the page script turns into a link. A text list on the
 * page holds the same items, so the diagram is never the only way to reach them.
 */
import { compareRefs } from '../identity.js';
import { dependantsOf, type Graph, type Item } from '../graph.js';
import { textWidth } from './labels.js';
import type { Theme } from './themes.js';
import { escapeXml, SVG_NAMESPACE, tag, type Attributes } from './xml.js';

export interface DiagramNode { ref: string; title: string; kind: 'component' | 'licence' | 'resource'; linked: boolean }
export interface Neighbourhood { centre: DiagramNode; dependencies: DiagramNode[]; dependants: DiagramNode[] }

const BOX_WIDTH = 220;
const BOX_HEIGHT = 46;
const ROW_GAP = 14;
const COLUMN_GAP = 96;
const PADDING = 24;
const HEADING_HEIGHT = 34;
const TITLE_WIDTH = BOX_WIDTH - 24;

/** The diagram node of an item: components and licences have pages, other resources do not. */
export function diagramNode(item: Item): DiagramNode {
  const kind = item.kind === 'line' ? 'resource' : item.kind;
  const title = item.kind === 'component' || item.kind === 'licence' ? item.entity.metadata.title ?? item.name : item.name;
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

/** Cut a title so it fits the box at 13 units, ending with an ellipsis. */
function fit(title: string, width = TITLE_WIDTH): string {
  if (textWidth(title) <= width) return title;
  const chars = Array.from(title);
  while (chars.length > 1 && textWidth(chars.join('') + '…') > width) chars.pop();
  return chars.join('') + '…';
}

function box(node: DiagramNode, x: number, y: number, theme: Theme, centre: boolean): string {
  const fill = centre ? theme.header : theme.panel;
  const ink = centre ? theme.headerText : theme.text;
  const rectAttrs: Attributes = { x, y, width: BOX_WIDTH, height: BOX_HEIGHT, rx: 6, fill, stroke: centre ? theme.header : theme.outline, 'stroke-width': 1.5 };
  // A resource without a page is drawn dashed and muted, so it does not look clickable.
  if (!node.linked) Object.assign(rectAttrs, { stroke: theme.muted, 'stroke-dasharray': '5 4' });
  const content = tag('title', {}, escapeXml(`${node.title} (${node.ref})`))
    + tag('rect', rectAttrs)
    + tag('text', { x: x + 12, y: y + 20, fill: node.linked ? ink : theme.muted, 'font-size': 13, 'font-weight': 700 }, escapeXml(fit(node.title)))
    + tag('text', { x: x + 12, y: y + 37, fill: centre ? theme.headerText : theme.muted, 'font-size': 11 }, escapeXml(node.kind));
  return tag('g', node.linked ? { 'data-ref': node.ref } : {}, content);
}

function column(nodes: DiagramNode[], x: number, top: number, theme: Theme): string {
  if (!nodes.length) return tag('text', { x: x + 12, y: top + 28, fill: theme.muted, 'font-size': 13 }, 'Nothing');
  return nodes.map((node, i) => box(node, x, top + i * (BOX_HEIGHT + ROW_GAP), theme, false)).join('');
}

/** Curved edges from each box of one column to the centre box. */
function edges(count: number, fromX: number, toX: number, top: number, centreY: number, theme: Theme): string {
  const middle = (fromX + toX) / 2;
  return Array.from({ length: count }, (_, i) => {
    const y = top + i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
    const d = `M${fromX},${y} C${middle},${y} ${middle},${centreY} ${toX},${centreY}`;
    return tag('path', { d, fill: 'none', stroke: theme.muted, 'stroke-width': 2 });
  }).join('');
}

export function renderNeighbourhood(input: Neighbourhood, theme: Theme): string {
  const rows = Math.max(input.dependencies.length, input.dependants.length, 1);
  const columnHeight = rows * (BOX_HEIGHT + ROW_GAP) - ROW_GAP;
  const top = PADDING + HEADING_HEIGHT;
  const width = PADDING * 2 + BOX_WIDTH * 3 + COLUMN_GAP * 2;
  const height = top + columnHeight + PADDING;
  const [left, centre, right] = [0, 1, 2].map(i => PADDING + i * (BOX_WIDTH + COLUMN_GAP)) as [number, number, number];
  const centreTop = top + (columnHeight - BOX_HEIGHT) / 2;
  const centreY = centreTop + BOX_HEIGHT / 2;
  const heading = (text: string, x: number) => tag('text', { x, y: PADDING + 14, fill: theme.text, 'font-size': 13, 'font-weight': 700 }, text);
  const body = [
    tag('rect', { x: 0, y: 0, width, height, fill: theme.background }),
    heading('Depends on', left),
    heading('This item', centre),
    heading('Used by', right),
    edges(input.dependencies.length, left + BOX_WIDTH, centre, top, centreY, theme),
    edges(input.dependants.length, right, centre + BOX_WIDTH, top, centreY, theme),
    column(input.dependencies, left, top, theme),
    box(input.centre, centre, centreTop, theme, true),
    column(input.dependants, right, top, theme),
  ].join('');
  const attrs: Attributes = { xmlns: SVG_NAMESPACE, role: 'img', viewBox: `0 0 ${width} ${height}`, width, height, 'font-family': theme.font };
  const head = tag('title', {}, escapeXml(`Neighbourhood of ${input.centre.title}`))
    + tag('desc', {}, 'Direct dependencies on the left, direct dependants on the right.');
  return tag('svg', attrs, head + body);
}
