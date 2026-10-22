/** Relation keys, declared relations, agents and unique names (skill-source spec). Run npm test.
 * Fixtures are fictitious Northwind skills and agents in temporary folders.
 */
import { test, expect } from 'vitest';
import { readSkillSet } from '../../src/skills/source.js';
import { agent, link, playbook, skill, skillSet } from '../skills-helpers.js';

const read = (root: string, folders: string[] = []) => readSkillSet(folders, { cwd: root });

test('Playbook', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': playbook('release') }));
  expect(set.problems).toEqual([]);
  expect(set.skills).toMatchObject([{ name: 'release', kind: 'playbook' }]);
  expect(set.summary).toMatchObject({ skills: 0, playbooks: 1 });
});

test('Typo in a key', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': skill('release', { metadata: { 'stackledger-kind': 'playbook', 'stackledger-skill': 'writer' } }) }));
  expect(set.problems).toEqual([expect.objectContaining({ field: 'metadata.stackledger-skill', line: 6, column: 3, severity: 'error' })]);
});

test('Unknown key with a list value', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': skill('release', { extra: 'metadata:\n  Stackledger-Uses:\n    - writer\n    - 42\n' }) }));
  expect(set.problems).toEqual([expect.objectContaining({ field: 'metadata.Stackledger-Uses', line: 5, column: 3, severity: 'error' })]);
});

test('Unknown kind', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': skill('release', { metadata: { 'stackledger-kind': 'process' } }) }));
  expect(set.problems).toMatchObject([{ field: 'metadata.stackledger-kind', severity: 'error', line: 5, column: 21 }]);
  expect(set.problems).toHaveLength(1);
});

test('List instead of a string', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'),
    'release/SKILL.md': skill('release', { extra: 'metadata:\n  stackledger-skills: [writer]\n' }) }));
  expect(set.problems).toMatchObject([{ field: 'metadata.stackledger-skills', severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.problems[0]!.message).toContain('names separated by spaces');
});

test('Missing skill', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'release/SKILL.md': playbook('release', 'writer editr') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: 'release/SKILL.md', field: 'metadata.stackledger-skills', severity: 'error' })]);
  expect(set.problems[0]!.message).toContain('editr');
  expect(set.problems[0]!.message).not.toContain('writer');
});

test('Missing agent', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': playbook('release', undefined, 'reviewer') }));
  expect(set.problems).toEqual([expect.objectContaining({ field: 'metadata.stackledger-agents', severity: 'error' })]);
  expect(set.problems[0]!.message).toContain('reviewer');
});

test('Names on several lines', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'),
    'release/SKILL.md': skill('release', { extra: 'metadata:\n  stackledger-kind: playbook\n  stackledger-skills: |\n    writer\n    editor\n' }) }));
  expect(set.problems).toEqual([]);
  expect(set.skills.find(item => item.name === 'release')!.skills).toEqual(['writer', 'editor']);
});

test('Repeated name', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'release/SKILL.md': playbook('release', 'writer  writer') }));
  expect(set.problems).toMatchObject([{ field: 'metadata.stackledger-skills', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
});

test('Missing name repeated', async () => {
  const set = await read(skillSet({ 'release/SKILL.md': playbook('release', 'editr editr') }));
  expect(set.problems.map(p => p.severity)).toEqual(['error', 'warning']);
});

test('Claude Code subagent', async () => {
  const set = await read(skillSet({ 'agents/reviewer.md': agent('reviewer') }));
  expect(set.problems).toEqual([]);
  expect(set.agents).toEqual([{ name: 'reviewer', path: 'agents/reviewer.md', preloads: [] }]);
});

test('Linked agent file', async () => {
  const root = skillSet({ 'store/reviewer.md': agent('reviewer'), 'tool/agents/reviewer.md': link('store/reviewer.md') });
  const set = await read(root, ['tool']);
  expect(set.problems).toEqual([]);
  expect(set.agents).toMatchObject([{ name: 'reviewer', path: 'tool/agents/reviewer.md' }]);
});

test('Agent without a name', async () => {
  const set = await read(skillSet({ 'agents/helper.md': '---\ndescription: Northwind helper.\n---\n', 'writer/SKILL.md': skill('writer') }));
  expect(set.problems).toMatchObject([{ path: 'agents/helper.md', field: 'name', severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.agents).toEqual([]);
});

test('Notes in the agents folder', async () => {
  const set = await read(skillSet({ 'agents/README.md': '# Northwind agents\n', 'agents/reviewer.md': agent('reviewer') }));
  expect(set.problems).toMatchObject([{ path: 'agents/README.md', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.agents.map(item => item.name)).toEqual(['reviewer']);
});

test('Nested agents folder', async () => {
  const set = await read(skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/writer/agents/helper.md': agent('helper') }));
  expect(set.agents).toEqual([]);
  expect(set.problems).toEqual([]);
});

test('Unknown preloaded skill', async () => {
  const set = await read(skillSet({ 'code-review/SKILL.md': skill('code-review'), 'agents/reviewer.md': agent('reviewer', 'skills: [code-review, linting]\n') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: 'agents/reviewer.md', field: 'skills[1]', severity: 'warning' })]);
  expect(set.summary.errors).toBe(0);
});

test('Skills as a string', async () => {
  const set = await read(skillSet({ 'code-review/SKILL.md': skill('code-review'), 'agents/reviewer.md': agent('reviewer', 'skills: code-review\n') }));
  expect(set.problems).toEqual([expect.objectContaining({ field: 'skills', severity: 'warning' })]);
  expect(set.agents).toMatchObject([{ name: 'reviewer', preloads: [] }]);
});

test('Same skill name in two folders', async () => {
  const root = skillSet({ 'a/writer/SKILL.md': skill('writer', { description: 'Northwind writer A.' }), 'b/writer/SKILL.md': skill('writer'),
    'b/release/SKILL.md': playbook('release', 'writer') });
  const set = await read(root, ['a', 'b']);
  expect(set.problems).toMatchObject([{ path: 'b/writer/SKILL.md', field: 'name', severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.problems[0]!.message).toContain('a/writer/SKILL.md');
  expect(set.skills.filter(item => item.name === 'writer').map(item => item.path)).toEqual(['a/writer/SKILL.md']);
});

test('Two agents with one name', async () => {
  const set = await read(skillSet({ 'agents/review.md': agent('reviewer'), 'agents/reviewer.md': agent('reviewer') }));
  expect(set.problems).toMatchObject([{ path: 'agents/reviewer.md', field: 'name', severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.agents.map(item => item.path)).toEqual(['agents/review.md']);
});
