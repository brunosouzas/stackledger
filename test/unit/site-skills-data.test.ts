/** Skills page data (skills-site spec: Skill and playbook pages, Agent pages, Declared relations on the
 * site, Skills list). Run npm test. Sets are fictitious Northwind skills in temporary folders.
 */
import { test, expect } from 'vitest';
import { buildSkillsData } from '../../src/site/skills-data.js';
import { buildGraph, incoming, outgoing, reachedThrough } from '../../src/skills/graph.js';
import { readSkillSet } from '../../src/skills/source.js';
import { agent, playbook, rules, skill, skillSet } from '../skills-helpers.js';

const dataOf = async (files: Parameters<typeof skillSet>[0]) => buildSkillsData(await readSkillSet([], { cwd: skillSet(files) })).data;
const page = (data: Awaited<ReturnType<typeof dataOf>>, kind: string, name: string) => data.items.find(item => item.kind === kind && item.name === name)!;
const LINE = (name: string, stops: string[]) => `apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: ${name}\nspec:\n  color: "#E4002${name.length % 10}"\n  stops: [${stops.map(s => JSON.stringify(s)).join(', ')}]\n`;

test('Playbook page', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'), 'agents/reviewer.md': agent('reviewer'),
    'release/SKILL.md': playbook('release', 'writer editor', 'reviewer') });
  expect(page(data, 'playbook', 'release').bringsIn.map(item => [item.name, item.relation, item.href]))
    .toEqual([['editor', 'loads', 'skills/editor/'], ['reviewer', 'uses', 'agents/reviewer/'], ['writer', 'loads', 'skills/writer/']]);
});
test('Rules on a skill page', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'),
    'writer/rules.md': '# Rules\n\n## Writing (WR)\n\n- **WR-1** Short sentences.\n  Why: readers skim.\n  Check: no sentence over 30 words.\n' });
  expect(page(data, 'skill', 'writer').rules).toEqual([{ id: 'WR-1', group: 'Writing (WR)', text: 'Short sentences.', why: 'readers skim.', check: 'no sentence over 30 words.' }]);
});
test('Reached through a playbook', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'), 'release/SKILL.md': playbook('release', 'writer'), 'ship/SKILL.md': playbook('ship', 'release') });
  const writer = page(data, 'skill', 'writer');
  expect(writer.reachedThrough.map(item => item.name)).toEqual(['ship']); expect(writer.broughtInBy.map(item => item.name)).toEqual(['release']);
});
test('Lines at an item', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'), 'linter/SKILL.md': skill('linter'),
    'stackledger-skills.yaml': LINE('publish', ['skill:writer', 'skill:editor']) + '---\n' + LINE('review', ['skill:linter', 'skill:writer']) });
  expect(page(data, 'skill', 'writer').lines.map(line => line.slug).sort()).toEqual(['publish', 'review']);
});
test('Item with no relation', async () => {
  const data = await dataOf({ 'notes/SKILL.md': skill('notes') });
  const notes = page(data, 'skill', 'notes');
  expect(notes.broughtInBy).toEqual([]); expect(notes.bringsIn).toEqual([]);
  expect([...notes.diagram!.light.matchAll(/data-ref="([^"]+)"/g)].map(match => match[1])).toEqual(['skill:notes']);
});
test('Agent page', async () => {
  const data = await dataOf({ 'code-review/SKILL.md': skill('code-review'), 'agents/reviewer.md': agent('reviewer', 'skills:\n  - code-review\n'),
    'release/SKILL.md': playbook('release', undefined, 'reviewer') });
  const reviewer = page(data, 'agent', 'reviewer');
  expect(reviewer.broughtInBy.map(item => [item.name, item.relation])).toEqual([['release', 'uses']]);
  expect(reviewer.bringsIn.map(item => [item.name, item.relation])).toEqual([['code-review', 'preloads']]);
});
test('Same as the Markdown map', async () => {
  const set = await readSkillSet(['examples/northwind-skills']);
  const data = buildSkillsData(set).data, graph = buildGraph(set);
  for (const node of graph.nodes) {
    const item = page(data, node.kind, node.name);
    expect(item.broughtInBy.map(other => [other.name, other.kind, other.relation])).toEqual(incoming(graph, node).map(edge => [edge.from.name, edge.from.kind, edge.kind]));
    expect(item.bringsIn.map(other => [other.name, other.kind, other.relation])).toEqual(outgoing(graph, node).map(edge => [edge.to.name, edge.to.kind, edge.kind]));
    expect(item.reachedThrough.map(other => other.name)).toEqual(reachedThrough(graph, node).map(other => other.name));
  }
});
test('Missing relation target', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'), 'release/SKILL.md': playbook('release', 'writer ghost') });
  expect(JSON.stringify(data)).not.toContain('ghost');
});
test('Every item rejected', async () => {
  const data = await dataOf({ 'writer/SKILL.md': '# no frontmatter\n', 'agents/reviewer.md': '---\nname: reviewer\n---\n' });
  expect(data.rows).toEqual([]); expect(data.rules).toEqual([]); expect(data.map.empty).toBe(true);
});
test('Relation error keeps the page', async () => {
  const data = await dataOf({ 'writer/SKILL.md': skill('writer'), 'release/SKILL.md': playbook('release', 'ghost') });
  expect(data.rows.map(row => row.name)).toContain('release'); expect(page(data, 'playbook', 'release').href).toBe('playbooks/release/');
});
test('Over the budget', async () => {
  const names = Array.from({ length: 101 }, (_, i) => `s${String(i).padStart(3, '0')}`);
  const data = await dataOf({ 'release/SKILL.md': playbook('release', names.join(' ')), ...Object.fromEntries(names.map(name => [`${name}/SKILL.md`, skill(name)])) });
  const release = page(data, 'playbook', 'release');
  expect(release.diagram).toBeUndefined(); expect(release.relationCount).toBe(101); expect(release.bringsIn).toHaveLength(101);
});
test('Rules rows', async () => {
  const data = await dataOf({ 'documentation/SKILL.md': skill('documentation'), 'documentation/rules.md': rules('- **DOC-1** Docs.'),
    'developer/SKILL.md': skill('developer'), 'developer/rules.md': rules('- **DOC-1** Code docs.') });
  expect(data.rules.map(rule => [rule.id, rule.owner.name])).toEqual([['DOC-1', 'developer'], ['DOC-1', 'documentation']]);
});
