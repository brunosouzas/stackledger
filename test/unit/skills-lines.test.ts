/** The skills map file (skill-source spec: Skills map file, One read per map file, Skills map file
 * problems, Skills map documents, Skill references, Playbook zones, Several skills map files).
 * Run npm test. Fixtures are fictitious Northwind skills in temporary folders.
 */
import { test, expect } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readSkillSet } from '../../src/skills/source.js';
import { zoneMembers } from '../../src/skills/lines.js';
import { agent, link, playbook, skill, skillSet } from '../skills-helpers.js';

const read = (root: string, folders: string[] = []) => readSkillSet(folders, { cwd: root });
const MAP = 'stackledger-skills.yaml';
let colour = 0;
const line = (name: string, stops: string[], extra = '') =>
  `apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: ${name}\n${extra}spec:\n  color: "#E4002${colour++ % 10}"\n  stops: [${stops.map(s => JSON.stringify(s)).join(', ')}]\n`;
const layout = (stations: Record<string, [number, number]>, zones = '') =>
  `apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: skills\nspec:\n  stations:\n${Object.entries(stations).map(([k, [x, y]]) => `    ${JSON.stringify(k)}: [${x}, ${y}]\n`).join('')}${zones}`;
const docs = (...documents: string[]) => documents.join('---\n');
const team = { 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor') };
const errorsOf = (set: Awaited<ReturnType<typeof read>>) => set.problems.filter(p => p.severity === 'error');

test('Map file at the top', async () => {
  const set = await read(skillSet({ ...team, [MAP]: docs(layout({ 'skill:writer': [0, 0], 'skill:editor': [2, 0] }), line('publish', ['skill:writer', 'skill:editor'])) }));
  expect(set.problems).toEqual([]); expect(set.map.lines.map(l => l.metadata.name)).toEqual(['publish']);
});
test('Map file below the top', async () => {
  const set = await read(skillSet({ ...team, [`skills/${MAP}`]: 'a: [' }), ['.']);
  expect(set.problems).toEqual([]); expect(set.map.lines).toEqual([]);
});
test('Map file in a single skill', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), [`writer/${MAP}`]: 'a: [' }), ['writer']);
  expect(set.problems).toEqual([]); expect(set.map.lines).toEqual([]);
});
test('Other extension', async () => {
  const set = await read(skillSet({ ...team, 'stackledger-skills.yml': line('publish', ['skill:writer', 'skill:editor']) }));
  expect(set.problems).toEqual([]); expect(set.map.lines).toEqual([]);
});
test('Ignore file cannot hide it', async () => {
  const set = await read(skillSet({ ...team, '.stackledgerignore': `${MAP}\n`, [MAP]: line('publish', ['skill:writer', 'skill:editor']) }));
  expect(set.map.lines).toHaveLength(1); expect(set.summary.ignored).toBe(0);
});
test('Map file alone', async () => {
  const set = await read(skillSet({ [`repo/${MAP}`]: line('publish', ['skill:writer', 'skill:editor']) }), ['repo']);
  expect(errorsOf(set).map(p => p.message)).toContain('No skill folder or agent file found in this folder');
});
test('Linked map file', async () => {
  const root = skillSet({ 'repo/writer/SKILL.md': skill('writer'), 'repo/editor/SKILL.md': skill('editor'), 'tool/a/SKILL.md': skill('a'),
    [`repo/${MAP}`]: docs(layout({ 'skill:writer': [0, 0], 'skill:editor': [2, 0] }), line('publish', ['skill:writer', 'skill:editor'])),
    [`tool/${MAP}`]: link(`repo/${MAP}`) });
  const set = await read(root, ['repo', 'tool']);
  expect(set.problems).toEqual([]); expect(set.map.lines).toHaveLength(1); expect(set.map.layout?.metadata.name).toBe('skills');
});
test('Malformed map file', async () => {
  const set = await read(skillSet({ ...team, [MAP]: 'kind: [' }));
  expect(errorsOf(set)).toHaveLength(1); expect(errorsOf(set)[0]!.path).toBe(MAP);
  expect(set.skills.map(s => s.name)).toEqual(['editor', 'writer']); expect(set.map.lines).toEqual([]);
});
test('Map file that is a folder', async () => {
  const root = skillSet(team); mkdirSync(join(root, MAP));
  const set = await read(root);
  expect(errorsOf(set)).toEqual([expect.objectContaining({ path: MAP, message: 'File cannot be read' })]);
});
test('Secret in the map file', async () => {
  // The secret is in a title and in a stop; another line of the same file is valid: the file gives nothing.
  const set = await read(skillSet({ ...team, [MAP]: docs(line('publish', ['skill:writer', 'skill:editor'], '  title: "4111111111111111"\n'),
    line('review', ['skill:editor', 'agent:4111111111111111']), line('valid', ['skill:editor', 'skill:writer'])) }));
  expect(errorsOf(set).map(problem => problem.message)).toEqual(['Payment-card number is not allowed', 'Payment-card number is not allowed']);
  expect(JSON.stringify(set.problems)).not.toContain('4111111111111111'); expect(set.map.lines).toEqual([]);
});
test('Relation error keeps the item', async () => {
  const set = await read(skillSet({ ...team, [MAP]: line('publish', ['skill:writer', 'skill:editr']) }));
  expect(errorsOf(set)).toHaveLength(1); expect(set.skills.map(s => s.name)).toEqual(['editor', 'writer']);
});
test('Component in the map file', async () => {
  const set = await read(skillSet({ ...team, [MAP]: 'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: editor\n' }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'kind' })]);
});
test('Line with one stop', async () => {
  const set = await read(skillSet({ ...team, [MAP]: line('publish', ['skill:writer']) }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'spec.stops' })]);
});
test('Stop without a position', async () => {
  const set = await read(skillSet({ ...team, 'linter/SKILL.md': skill('linter'),
    [MAP]: docs(layout({ 'skill:editor': [0, 0], 'skill:linter': [2, 0] }), line('publish', ['skill:writer', 'skill:editor']), line('review', ['skill:linter', 'skill:writer'])) }));
  expect(errorsOf(set)).toEqual([]);
  expect(set.problems).toEqual([expect.objectContaining({ severity: 'warning', field: 'spec.stops[0]', line: 16, message: 'No position; the map will place this item' })]);
});
test('Missing stop', async () => {
  const set = await read(skillSet({ ...team, [MAP]: line('publish', ['skill:writer', 'skill:editr']) }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'spec.stops[1]', message: 'No skill named editr in the set' })]);
});
test('Wrong kind', async () => {
  const set = await read(skillSet({ ...team, 'release/SKILL.md': playbook('release'), [MAP]: line('publish', ['skill:writer', 'skill:release']) }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'spec.stops[1]', message: 'No skill named release; release is a playbook' })]);
});
test('Kind in another case', async () => {
  const set = await read(skillSet({ ...team, [MAP]: line('publish', ['Skill:writer', 'skill:editor']) }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'spec.stops[0]', severity: 'error' })]);
});
test('Software reference', async () => {
  const set = await read(skillSet({ ...team, [MAP]: line('publish', ['skill:writer', 'component:editor']) }));
  expect(errorsOf(set)).toEqual([expect.objectContaining({ field: 'spec.stops[1]', severity: 'error' })]);
});
test('Agent station', async () => {
  const set = await read(skillSet({ ...team, 'agents/reviewer.md': agent('reviewer'),
    [MAP]: docs(layout({ 'agent:reviewer': [2, 0], 'skill:writer': [0, 0] }), line('review', ['skill:writer', 'agent:reviewer'])) }));
  expect(set.problems).toEqual([]);
});
test('Stop excluded by an error', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': '# no frontmatter\n', [MAP]: line('publish', ['skill:writer', 'skill:editor']) }));
  expect(errorsOf(set).map(p => p.path).sort()).toEqual(['editor/SKILL.md', MAP]);
});
const zones = (...names: string[]) => `  zones:\n${names.map(n => `    - { name: ${n}, title: ${n} playbook, color: "#F5A623" }\n`).join('')}`;
test('Playbook as a zone', async () => {
  const set = await read(skillSet({ ...team, 'agents/reviewer.md': agent('reviewer'), 'release/SKILL.md': playbook('release', 'writer editor', 'reviewer'),
    [MAP]: docs(layout({ 'playbook:release': [0, 0], 'skill:writer': [2, 0] }, zones('release')), line('publish', ['playbook:release', 'skill:writer'])) }));
  expect(set.problems).toEqual([]);
  expect(zoneMembers(set, 'release')).toEqual(['playbook:release', 'skill:writer', 'skill:editor', 'agent:reviewer']);
});
test('Zone that is not a playbook', async () => {
  const set = await read(skillSet({ ...team, [MAP]: docs(layout({ 'skill:writer': [0, 0], 'skill:editor': [2, 0] }, zones('writer')), line('publish', ['skill:writer', 'skill:editor'])) }));
  expect(set.problems).toEqual([expect.objectContaining({ field: 'spec.zones[0].name', message: 'Zone must name a playbook of the set; writer is not one' })]);
  expect(set.map.layout?.spec.stations).toEqual({ 'skill:writer': [0, 0], 'skill:editor': [2, 0] }); expect(zoneMembers(set, 'writer')).toEqual([]);
});
test('Only direct members', async () => {
  const set = await read(skillSet({ ...team, 'release/SKILL.md': playbook('release', 'writer'), 'ship/SKILL.md': playbook('ship', 'release') }));
  expect(zoneMembers(set, 'ship')).toEqual(['playbook:ship', 'playbook:release']);
});
test('One skill in two zones', async () => {
  const set = await read(skillSet({ ...team, 'release/SKILL.md': playbook('release', 'writer'), 'review/SKILL.md': playbook('review', 'writer'),
    [MAP]: docs(layout({ 'playbook:release': [0, 0], 'skill:writer': [2, 0], 'playbook:review': [4, 0] }, zones('release', 'review')),
      line('publish', ['playbook:release', 'skill:writer', 'playbook:review'])) }));
  expect(set.problems).toEqual([]);
  expect(zoneMembers(set, 'release')).toContain('skill:writer'); expect(zoneMembers(set, 'review')).toContain('skill:writer');
});
test('Second layout', async () => {
  const root = skillSet({ 'repo/writer/SKILL.md': skill('writer'), 'repo/editor/SKILL.md': skill('editor'), 'tool/a/SKILL.md': skill('a'),
    [`repo/${MAP}`]: docs(layout({ 'skill:writer': [0, 0], 'skill:editor': [2, 0] }), line('publish', ['skill:writer', 'skill:editor'])),
    [`tool/${MAP}`]: layout({ 'skill:writer': [5, 5] }).replace('name: skills', 'name: tools') });
  const set = await read(root, ['repo', 'tool']);
  expect(errorsOf(set)).toEqual([expect.objectContaining({ path: `tool/${MAP}`, message: `Only one MapLayout is allowed; earlier document is in repo/${MAP}` })]);
  expect(set.map.layout?.spec.stations['skill:writer']).toEqual([0, 0]);
});
test('One line name in two files', async () => {
  const root = skillSet({ 'repo/writer/SKILL.md': skill('writer'), 'repo/editor/SKILL.md': skill('editor'), 'tool/a/SKILL.md': skill('a'),
    [`repo/${MAP}`]: line('publish', ['skill:writer', 'skill:editor']), [`tool/${MAP}`]: line('publish', ['skill:a', 'skill:editor']) });
  const set = await read(root, ['repo', 'tool']);
  expect(errorsOf(set)).toEqual([expect.objectContaining({ path: `tool/${MAP}`, field: 'metadata.name' })]); expect(set.map.lines).toHaveLength(1);
});
