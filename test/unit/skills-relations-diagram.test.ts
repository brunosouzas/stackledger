/** The relation diagram of an item page (skills-site spec: Relation diagram, Relation diagram safety,
 * Relation diagram budget, Diagram links). Run npm test. Sets are fictitious Northwind skills in memory.
 */
import { test, expect } from 'vitest';
import { buildGraph } from '../../src/skills/graph.js';
import { relations, renderRelations } from '../../src/map/relations.js';
import { themes } from '../../src/map/themes.js';
import { safe } from './svg-helpers.js';

type Kind = 'skill' | 'playbook';
const setOf = (skills: [string, Kind, string[]?, string[]?][], agents: [string, string[]?][] = []) => ({
  skills: skills.map(([name, kind, loads, uses]) => ({ name, kind, skills: loads ?? [], agents: uses ?? [], path: '', description: '', given: '', files: [], rules: [] })),
  agents: agents.map(([name, preloads]) => ({ name, path: '', description: '', given: '', files: [], preloads: preloads ?? [] })),
});
function diagram(set: ReturnType<typeof setOf>, kind: 'skill' | 'playbook' | 'agent', name: string) {
  const graph = buildGraph(set);
  return relations(graph, graph.nodes.find(node => node.kind === kind && node.name === name)!);
}
const svgOf = (input: NonNullable<ReturnType<typeof diagram>>) => renderRelations(input, themes.light);
const boxes = (svg: string) => [...svg.matchAll(/<g data-ref="([^"]+)">/g)].map(match => match[1]);

test('Diagram of a skill', () => {
  const input = diagram(setOf([['release', 'playbook', ['writer']], ['writer', 'skill']]), 'skill', 'writer')!;
  expect(input.left).toEqual([{ ref: 'playbook:release', name: 'release', kind: 'playbook', relation: 'loads' }]);
  const svg = svgOf(input);
  const release = svg.indexOf('data-ref="playbook:release"'), writer = svg.indexOf('data-ref="skill:writer"');
  expect(release).toBeGreaterThan(-1); expect(writer).toBeGreaterThan(release);
  expect(svg.slice(release, writer)).toContain('>loads</text>');
});
test('Two playbooks that load each other', () => {
  const input = diagram(setOf([['a', 'playbook', ['b']], ['b', 'playbook', ['a']]]), 'playbook', 'a')!;
  expect(input.left.map(item => item.name)).toEqual(['b']); expect(input.right.map(item => item.name)).toEqual(['b']);
  expect(boxes(svgOf(input)).filter(ref => ref === 'playbook:b')).toHaveLength(2);
});
test('Shapes', () => {
  const input = diagram(setOf([['release', 'playbook', ['writer'], ['reviewer']], ['writer', 'skill']], [['reviewer']]), 'playbook', 'release')!;
  const doc = safe(svgOf(input));
  const groups = Array.from(doc.getElementsByTagName('g'));
  const face = (ref: string) => { const g = groups.find(item => item.getAttribute('data-ref') === ref)!; return Array.from(g.children).filter(e => e.tagName !== 'title' && e.tagName !== 'text').at(-1)!; };
  const playbook = face('playbook:release'), skill = face('skill:writer'), agent = face('agent:reviewer');
  expect(playbook.tagName).toBe('rect'); expect(Number(playbook.getAttribute('rx'))).toBe(Number(playbook.getAttribute('height')) / 2);
  expect(agent.tagName).toBe('polygon'); expect(agent.getAttribute('points')!.trim().split(' ')).toHaveLength(6);
  expect(skill.tagName).toBe('rect'); expect(Number(skill.getAttribute('rx'))).toBeLessThan(Number(playbook.getAttribute('rx')));
});
test('Hostile name', () => {
  const name = '<script>alert(1)</script>';
  const svg = svgOf(diagram(setOf([['release', 'playbook', [name]], [name, 'skill']]), 'playbook', 'release')!);
  const doc = safe(svg);
  expect(doc.getElementsByTagName('script')).toHaveLength(0); expect(doc.documentElement!.textContent).toContain(name);
});
test('Long name on one side', () => {
  // A long neighbour on the left only: its box must end before the centre box starts.
  const long = 'W'.repeat(64);
  const doc = safe(svgOf(diagram(setOf([[long, 'playbook', ['writer']], ['writer', 'skill']]), 'skill', 'writer')!));
  const face = (prefix: string) => { const g = Array.from(doc.getElementsByTagName('g')).find(item => item.getAttribute('data-ref')?.startsWith(prefix))!; return Array.from(g.children).filter(e => e.tagName === 'rect').at(-1)!; };
  const left = face('playbook:'), centre = face('skill:writer');
  expect(Number(left.getAttribute('x')) + Number(left.getAttribute('width'))).toBeLessThan(Number(centre.getAttribute('x')));
});
test('Long name', () => {
  const name = 'n'.repeat(70);
  const svg = svgOf(diagram(setOf([['release', 'playbook', [name]], [name, 'skill']]), 'playbook', 'release')!);
  const doc = safe(svg);
  const g = Array.from(doc.getElementsByTagName('g')).find(item => item.getAttribute('data-ref')?.startsWith('skill:'))!;
  expect(g.getElementsByTagName('title')[0]!.textContent).toBe(name);
  expect(g.getElementsByTagName('text')[0]!.textContent).toBe('n'.repeat(64) + '…');
});
const many = (count: number) => Array.from({ length: count }, (_, i) => `s${String(i).padStart(3, '0')}`);
test('At the budget', () => {
  const names = many(100);
  const input = diagram(setOf([['release', 'playbook', names], ...names.map(name => [name, 'skill'] as [string, Kind])]), 'playbook', 'release')!;
  expect(input.right).toHaveLength(100); expect(boxes(svgOf(input)).filter(ref => ref.startsWith('skill:'))).toHaveLength(100);
});
test('Over the budget', () => {
  const names = many(101);
  expect(diagram(setOf([['release', 'playbook', names], ...names.map(name => [name, 'skill'] as [string, Kind])]), 'playbook', 'release')).toBeUndefined();
});
