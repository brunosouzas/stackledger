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

/** The nodes, subgraph titles and edges of a Mermaid flowchart written as docs/how-it-works.md writes it. */
export function mermaidGraph(block: string) {
  const nodes = new Map<string, string[]>();
  const subgraphs: string[] = [];
  const edges: Edge[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    const subgraph = /^subgraph \w+\["(.+)"\]$/.exec(line);
    const node = /^(\w+)\["(.+)"\]$/.exec(line);
    if (subgraph) subgraphs.push(subgraph[1]!);
    else if (node) nodes.set(node[1]!, node[2]!.split('<br/>'));
    else {
      const parts = line.split(/\s*(-\.\s*"[^"]*"\s*\.->|-\.->|-->\|[^|]*\||-->)\s*/);
      for (let i = 1; i < parts.length; i += 2) {
        const label = /"([^"]*)"|\|([^|]*)\|/.exec(parts[i]!);
        edges.push({ from: parts[i - 1]!, to: parts[i + 1]!, dotted: parts[i]!.startsWith('-.'), ...(label ? { label: label[1] ?? label[2] } : {}) });
      }
    }
  }
  return { nodes, subgraphs, edges };
}

const plain = (text: string) => text.replace(/`/g, '');
const squash = (text: string) => plain(text).replace(/\s+/g, '');

/** Every way the spec differs from the Mermaid block, as the requirement "How it works diagram content" reads it. */
export function mermaidProblems(block: string, diagram: { pieces: Piece[] }): string[] {
  const { nodes, subgraphs, edges } = mermaidGraph(block);
  const of = (name: string) => diagram.pieces.filter(piece => piece.piece === name);
  const problems: string[] = [];
  const boxes = of('diagramBox').map(box => (box.text as string[]).map(plain));
  for (const [id, lines] of nodes) {
    const at = boxes.findIndex(box => JSON.stringify(box) === JSON.stringify(lines));
    if (at < 0) problems.push(`node ${id}: no box with the lines ${JSON.stringify(lines)}`);
    else boxes.splice(at, 1);
  }
  for (const box of boxes) problems.push(`box ${JSON.stringify(box)}: not a node of the Mermaid block`);
  const tags = of('taggedContainer').map(container => container.tag as string);
  if (JSON.stringify([...tags].sort()) !== JSON.stringify([...subgraphs].sort())) problems.push(`containers ${JSON.stringify(tags)}: the subgraphs are ${JSON.stringify(subgraphs)}`);
  const arrows = of('messageArrow');
  if (arrows.length !== edges.length) problems.push(`arrows: ${arrows.length}, the Mermaid block has ${edges.length} edges`);
  const dashed = arrows.filter(arrow => arrow.dashed === true).length;
  const dotted = edges.filter(edge => edge.dotted).length;
  if (dashed !== dotted) problems.push(`arrows: ${dashed} dashed, the Mermaid block has ${dotted} dotted edges`);
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
  expect([graph.nodes.size, graph.subgraphs.length, graph.edges.length, graph.edges.filter(edge => edge.label).length]).toEqual([9, 3, 8, 4]);
  expect(mermaidProblems(mermaid(), spec())).toEqual([]);
});

test('Lost line or edge', () => {
  const without = (change: (diagram: { pieces: Piece[] }) => void) => { const diagram = spec(); change(diagram); return mermaidProblems(mermaid(), diagram).join('\n'); };
  const box = (diagram: { pieces: Piece[] }, first: string) => diagram.pieces.find(piece => piece.piece === 'diagramBox' && plain(piece.text[0]) === first)!;
  expect(without(diagram => { box(diagram, 'Pull request').text.pop(); })).toContain('node pr:');
  expect(without(diagram => { diagram.pieces.splice(diagram.pieces.findIndex(piece => piece.piece === 'messageArrow'), 1); })).toContain('arrows:');
  expect(without(diagram => { diagram.pieces = diagram.pieces.filter(piece => !(piece.piece === 'edgeLabel' && plain(piece.lines[0]) === 'git push')); })).toContain('edge label "git push"');
  expect(without(diagram => { diagram.pieces.push({ piece: 'diagramBox', x: 0, y: 0, width: 60, text: ['Extra'] }); })).toContain('box ["Extra"]');
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
