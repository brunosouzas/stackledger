/** The diagram of docs/how-it-works.md is the design system's drawing of scripts/how-it-works.json, and that spec
 * draws the page's Mermaid block (catalogue-pipeline: How it works diagram, How it works diagram content,
 * How it works generation). The file is written by scripts/site-art.mjs. Run npm test. */
import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XMLSerializer } from '@xmldom/xmldom';
import { coverTree, toSvg, validateCoverSpec } from '@brunosouzas/design-system';
import { activeParts, parseSvg } from './svg-helpers.js';

const repo = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');
const spec = () => JSON.parse(read('scripts/how-it-works.json'));
const shapes = (svg: string) => Array.from(parseSvg(svg).getElementsByTagName('*'))
  .map(element => [element.tagName, Object.fromEntries(Array.from(element.attributes).map(attr => [attr.name, attr.value])), (element as any).childElementCount ? '' : element.textContent]);

type Piece = { piece: string; [key: string]: any };
type Edge = { from: string; to: string; label?: string; dotted: boolean };

/** The nodes (with their subgraph), subgraph titles and edges of a Mermaid flowchart written as docs/how-it-works.md
 * writes it, and every line it does not understand, so a node or edge in another syntax is never dropped silently. */
export function mermaidGraph(block: string) {
  const nodes = new Map<string, { lines: string[]; subgraph?: string }>();
  const subgraphs: string[] = [];
  const edges: Edge[] = [];
  const unknown: string[] = [];
  let open: string | undefined;
  block.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const subgraph = /^subgraph \w+\["(.+)"\]$/.exec(line);
    const node = /^(\w+)\["(.+)"\]$/.exec(line);
    const parts = line.split(/\s*(-\.\s*"[^"]*"\s*\.->|-->\|[^|]*\||-->)\s*/);
    if (line === '' || /^flowchart (?:TB|TD)$/.test(line)) return;
    if (line === 'end' && open !== undefined) open = undefined;
    else if (subgraph && open === undefined) subgraphs.push(open = subgraph[1]!);
    else if (node) nodes.set(node[1]!, { lines: node[2]!.split('<br/>'), ...(open === undefined ? {} : { subgraph: open }) });
    else if (parts.length > 1 && parts.every((part, i) => i % 2 === 1 || /^\w+$/.test(part))) {
      for (let i = 1; i < parts.length; i += 2) {
        const label = /"([^"]*)"|\|([^|]*)\|/.exec(parts[i]!);
        edges.push({ from: parts[i - 1]!, to: parts[i + 1]!, dotted: parts[i]!.startsWith('-.'), ...(label ? { label: label[1] ?? label[2] } : {}) });
      }
    } else unknown.push(`line ${index + 1}: ${line}`);
  });
  return { nodes, subgraphs, edges, unknown };
}

const plain = (text: string) => text.replace(/`/g, '');
const squash = (text: string) => plain(text).replace(/\s+/g, '');
const DRAWN = ['taggedContainer', 'diagramBox', 'messageArrow', 'edgeLabel'];
type Rect = { x: number; y: number; width: number; height: number };
const rectOf = (piece: Piece): Rect => ({ x: piece.x, y: piece.y, width: piece.width, height: piece.height ?? 46 });
const gap = ([x, y]: [number, number], r: Rect) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.width), Math.max(r.y - y, 0, y - r.y - r.height));
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;

/** Every way the spec differs from the Mermaid block, as the requirement "How it works diagram content" reads it. */
export function mermaidProblems(block: string, diagram: { pieces: Piece[] }): string[] {
  const { nodes, subgraphs, edges, unknown } = mermaidGraph(block);
  const of = (name: string) => diagram.pieces.filter(piece => piece.piece === name);
  const problems = unknown.map(line => `Mermaid ${line}: not understood`);
  for (const piece of diagram.pieces) if (!DRAWN.includes(piece.piece)) problems.push(`piece ${piece.piece}: not part of the Mermaid block`);
  // Nodes and their boxes.
  const free = of('diagramBox');
  const boxOf = new Map<string, Rect>();
  for (const [id, node] of nodes) {
    const at = free.findIndex(box => JSON.stringify((box.text as string[]).map(plain)) === JSON.stringify(node.lines));
    if (at < 0) problems.push(`node ${id}: no box with the lines ${JSON.stringify(node.lines)}`);
    else boxOf.set(id, rectOf(free.splice(at, 1)[0]!));
  }
  for (const box of free) problems.push(`box ${JSON.stringify((box.text as string[]).map(plain))}: not a node of the Mermaid block`);
  // Subgraphs: one container each, holding exactly its nodes' boxes.
  const containers = of('taggedContainer');
  const tags = containers.map(container => container.tag as string);
  if (JSON.stringify([...tags].sort()) !== JSON.stringify([...subgraphs].sort())) problems.push(`containers ${JSON.stringify(tags)}: the subgraphs are ${JSON.stringify(subgraphs)}`);
  for (const [id, box] of boxOf) {
    const holders = containers.filter(container => inside(box, rectOf(container))).map(container => container.tag as string);
    const wanted = nodes.get(id)!.subgraph;
    if (JSON.stringify(holders) !== JSON.stringify(wanted === undefined ? [] : [wanted])) problems.push(`node ${id}: inside ${JSON.stringify(holders)}, its subgraph is ${JSON.stringify(wanted ?? null)}`);
  }
  // Edges: each arrow from its source box to its target box, head at the target, dashed only when dotted.
  const near = (point: [number, number]) => [...boxOf].filter(([, box]) => gap(point, box) <= 8).map(([id]) => id);
  const drawn = of('messageArrow').map(arrow => {
    const [from, to] = [near(arrow.from), near(arrow.to)];
    const head = arrow.head !== false && (arrow.heads ?? 'end') === 'end';
    return from.length === 1 && to.length === 1 && head ? `${from[0]} -> ${to[0]}${arrow.dashed === true ? ' dashed' : ''}` : `arrow from ${JSON.stringify(arrow.from)} to ${JSON.stringify(arrow.to)}`;
  });
  for (const edge of edges) {
    const name = `${edge.from} -> ${edge.to}${edge.dotted ? ' dashed' : ''}`;
    const at = drawn.indexOf(name);
    if (at < 0) problems.push(`edge ${name}: no arrow`);
    else drawn.splice(at, 1);
  }
  for (const arrow of drawn) problems.push(`${arrow.startsWith('arrow') ? arrow : `arrow ${arrow}`}: not an edge of the Mermaid block`);
  // Edge labels, by their words.
  const labels = of('edgeLabel').map(label => squash((label.lines as string[]).join('')));
  for (const edge of edges.filter(edge => edge.label !== undefined)) {
    const at = labels.indexOf(squash(edge.label!));
    if (at < 0) problems.push(`edge label "${edge.label}" (${edge.from} -> ${edge.to}): no edgeLabel`);
    else labels.splice(at, 1);
  }
  for (const label of labels) problems.push(`edgeLabel "${label}": not an edge label of the Mermaid block`);
  return problems;
}

const mermaid = () => /```mermaid\n([\s\S]*?)```/.exec(read('docs/how-it-works.md'))![1]!;

test("Diagram file is the design system's drawing", () => {
  const diagram = spec();
  expect(validateCoverSpec(diagram)).toEqual([]);
  expect(diagram.format).toBe('diagram');
  expect(shapes(read('docs/images/how-it-works.svg'))).toEqual(shapes(toSvg(coverTree(diagram))));
});

test('Stale diagram file', () => {
  const drawn = toSvg(coverTree(spec()));
  const doc = parseSvg(drawn);
  const rect = doc.getElementsByTagName('rect')[1]!;
  rect.setAttribute('x', String(Number(rect.getAttribute('x')) + 1));
  expect(shapes(new XMLSerializer().serializeToString(doc))).not.toEqual(shapes(drawn));
});

test('Colour literal refused', () => {
  const diagram = spec();
  const at = diagram.pieces.findIndex((piece: Piece) => piece.piece === 'diagramBox');
  diagram.pieces[at].fill = 'rgb(10, 16, 51)';
  expect(validateCoverSpec(diagram)).toEqual(expect.arrayContaining([expect.objectContaining({ path: `pieces[${at}].fill` })]));
});

test('Diagram is inert', () => {
  expect(activeParts(read('docs/images/how-it-works.svg'))).toEqual([]);
});

test('Mermaid content kept', () => {
  const graph = mermaidGraph(mermaid());
  expect(graph.unknown).toEqual([]);
  expect([graph.nodes.size, graph.subgraphs.length, graph.edges.length, graph.edges.filter(edge => edge.label).length]).toEqual([9, 3, 8, 4]);
  expect(mermaidProblems(mermaid(), spec())).toEqual([]);
});

type Diagram = { pieces: Piece[] };
const changed = (change: (diagram: Diagram) => void, block = mermaid()) => { const diagram = spec(); change(diagram); return mermaidProblems(block, diagram).join('\n'); };
const box = (diagram: Diagram, first: string) => diagram.pieces.find(piece => piece.piece === 'diagramBox' && plain(piece.text[0]) === first)!;
const arrowAt = (diagram: Diagram, index: number) => diagram.pieces.filter(piece => piece.piece === 'messageArrow')[index]!;

test('Lost line or edge', () => {
  expect(changed(diagram => { box(diagram, 'Pull request').text.pop(); })).toContain('node pr:');
  expect(changed(diagram => { diagram.pieces.splice(diagram.pieces.indexOf(arrowAt(diagram, 2)), 1); })).toContain('edge repo -> pr: no arrow');
  expect(changed(diagram => { diagram.pieces = diagram.pieces.filter(piece => !(piece.piece === 'edgeLabel' && plain(piece.lines[0]) === 'git push')); })).toContain('edge label "git push"');
  expect(changed(diagram => { diagram.pieces.push({ piece: 'diagramBox', x: 0, y: 0, width: 60, text: ['Extra'] }); })).toContain('box ["Extra"]');
});

test('Rewired edge', () => {
  // Arrow 2 is repo -> pr; arrow 0 is the dashed discover -> edit.
  expect(changed(diagram => { const arrow = arrowAt(diagram, 2); [arrow.from, arrow.to] = [arrow.to, arrow.from]; })).toContain('edge repo -> pr: no arrow');
  expect(changed(diagram => { arrowAt(diagram, 2).heads = 'both'; })).toContain('edge repo -> pr: no arrow');
  expect(changed(diagram => { arrowAt(diagram, 2).head = false; })).toContain('edge repo -> pr: no arrow');
  expect(changed(diagram => { arrowAt(diagram, 2).to = [430, 412]; })).toContain('arrow repo -> pages: not an edge');
  expect(changed(diagram => { delete arrowAt(diagram, 0).dashed; arrowAt(diagram, 2).dashed = true; })).toContain('edge discover -> edit dashed: no arrow');
  expect(changed(diagram => { box(diagram, 'Catalogue repository').y = 130; })).toContain('node repo: inside []');
  expect(changed(diagram => { diagram.pieces.push({ piece: 'stateStart', cx: 10, cy: 10 }); })).toContain('piece stateStart');
});

test('Unknown Mermaid line', () => {
  for (const extra of ['  extra[Extra node]', '  pages ==> reader', '  click pages "https://example.org"']) {
    expect(changed(() => {}, `${mermaid()}${extra}\n`), extra).toContain(`not understood`);
  }
});

test('No hand-drawn generator', () => {
  expect(existsSync(join(repo, 'scripts/how-it-works-diagram.py'))).toBe(false);
  const page = read('docs/how-it-works.md');
  expect(page).toContain('node scripts/site-art.mjs');
  expect(page).not.toMatch(/python/i);
});

test('Diagram sources not published', () => {
  const files: string[] = JSON.parse(read('package.json')).files;
  for (const entry of files) expect(entry, entry).not.toMatch(/^(?:\.\/)?(?:scripts|docs)(?:\/|$)/);
});
