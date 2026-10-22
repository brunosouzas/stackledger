/** Finding skill folders, links and one read per item (skill-source spec). Run npm test.
 * Fixtures are fictitious Northwind skills in temporary folders (test/skills-helpers.ts).
 */
import { test, expect } from 'vitest';
import { chmodSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readSkillSet } from '../../src/skills/source.js';
import { agent, link, playbook, skill, skillSet } from '../skills-helpers.js';

const asRoot = process.getuid?.() === 0;
const names = (set: { skills: { name: string }[] }) => set.skills.map(item => item.name);

test('Two folders form one set', async () => {
  const root = skillSet({ 'a/writer/SKILL.md': skill('writer'), 'b/release/SKILL.md': playbook('release', 'writer') });
  const set = await readSkillSet(['a', 'b'], { cwd: root });
  expect(names(set)).toEqual(['writer', 'release']);
  expect(set.skills[1]!.skills).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('Read-only', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/writer/rules.md': '- **DOC-1** Short.\n',
    'agents/reviewer.md': agent('reviewer'), 'skills/editor/SKILL.md': '# no frontmatter\n' });
  function files(path: string, relative = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const name of readdirSync(join(path, relative)).sort()) {
      const file = join(relative, name), absolute = join(path, file), info = statSync(absolute);
      if (info.isDirectory()) Object.assign(result, files(path, file));
      else result[file] = `${createHash('sha256').update(readFileSync(absolute)).digest('hex')} ${info.mtimeMs}`;
    }
    return result;
  }
  const before = files(root);
  await readSkillSet(['.'], { cwd: root });
  expect(files(root)).toEqual(before);
  expect(Object.keys(before)).toHaveLength(4);
});

test('Hidden link to a skill', async () => {
  const root = skillSet({ 'shared/writer/SKILL.md': skill('writer'), 'tool/skills/editor/SKILL.md': skill('editor'),
    'tool/.cache': link('shared/writer'), 'tool/node_modules': link('shared/writer') });
  const set = await readSkillSet(['tool'], { cwd: root });
  expect(names(set)).toEqual(['editor']);
  expect(set.problems).toEqual([]);
});

test('Linked SKILL.md', async () => {
  const root = skillSet({ 'store/writer.md': skill('writer', { description: 'x'.repeat(1025) }), 'set/writer/SKILL.md': link('store/writer.md') });
  const set = await readSkillSet([], { cwd: join(root, 'set') });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems.map(p => p.path)).toEqual(['writer/SKILL.md']);
});

test('Linked given folder', async () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer', { description: 'x'.repeat(1025) }), 'alias': link('repo') });
  const set = await readSkillSet(['alias'], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems.map(p => p.path)).toEqual(['alias/skills/writer/SKILL.md']);
});

test('Grouped skills', async () => {
  const root = skillSet({ 'skills/developer/java/SKILL.md': skill('java'), 'skills/developer/developer/SKILL.md': skill('developer') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['developer', 'java']);
  expect(set.problems).toEqual([]);
});

test('Resources are not skills', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/examples/draft/SKILL.md': skill('draft') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('Depth limit', async () => {
  const root = skillSet({ 'a/b/c/d/e/SKILL.md': skill('e'), 'a/b/c/d/g/f/SKILL.md': skill('f') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['e']);
  expect(set.problems).toEqual([]);
});

test('Hidden and dependency folders', async () => {
  const root = skillSet({ '.git/x/SKILL.md': skill('x'), 'node_modules/x/SKILL.md': skill('x'), 'writer/SKILL.md': skill('writer') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('Given folder is a hidden tool folder', async () => {
  const root = skillSet({ '.claude/skills/writer/SKILL.md': skill('writer') });
  const set = await readSkillSet(['.claude'], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('A single skill', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/agents/helper.md': agent('helper') });
  const set = await readSkillSet(['writer'], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.agents).toEqual([]);
  expect(set.problems).toEqual([]);
});

test('Tool folder made of links', async () => {
  const root = skillSet({ 'repo/writer/SKILL.md': skill('writer', { description: 'x'.repeat(1025) }), '.claude/skills/writer': link('repo/writer') });
  const tool = await readSkillSet(['.claude'], { cwd: root });
  expect(names(tool)).toEqual(['writer']);
  expect(tool.problems.map(p => p.path)).toEqual(['.claude/skills/writer/SKILL.md']);
});

test('Link to a plain folder', async () => {
  const root = skillSet({ 'elsewhere/team/writer/SKILL.md': skill('writer'), 'repo/skills/editor/SKILL.md': skill('editor'), 'repo/skills/shared': link('elsewhere') });
  const set = await readSkillSet(['repo'], { cwd: root });
  expect(names(set)).toEqual(['editor']);
  expect(set.problems).toMatchObject([{ path: 'repo/skills/shared', line: 1, column: 1, severity: 'warning', field: null }]);
});

test('Broken link', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/old': link('missing') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toMatchObject([{ path: 'skills/old', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
});

test('Link to a file elsewhere', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'outside/LICENSE': 'Northwind licence\n', 'skills/LICENSE': link('outside/LICENSE') });
  const set = await readSkillSet(['skills'], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('Link loop', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/a': link('skills/b'), 'skills/b': link('skills/a') });
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems.map(p => [p.path, p.severity])).toEqual([['skills/a', 'warning'], ['skills/b', 'warning']]);
  for (const problem of set.problems) expect(problem.message).toContain('loops');
});

test('Linked copy of a repository skill', async () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer', { description: 'x'.repeat(1025) }), 'tool/skills/writer': link('repo/skills/writer') });
  const set = await readSkillSet(['repo', 'tool'], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.skills[0]!.path).toBe('repo/skills/writer/SKILL.md');
  expect(set.problems.map(p => p.path)).toEqual(['repo/skills/writer/SKILL.md']);
  expect(set.problems.filter(p => p.severity === 'error')).toEqual([]);
});

test.skipIf(asRoot)('Unlistable sub-folder', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/private/hidden/SKILL.md': skill('hidden') });
  chmodSync(join(root, 'skills/private'), 0);
  const set = await readSkillSet([], { cwd: root });
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toMatchObject([{ path: 'skills/private', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
});

test('Listing order does not matter', async () => {
  const root = skillSet({
    'skills/b/SKILL.md': skill('writer'), 'skills/a/SKILL.md': skill('writer'), 'skills/c/SKILL.md': playbook('c', 'writer missing missing'),
    'skills/c/rules.md': '- **DOC-1** One.\n- **DOC-1** Two.\n', 'skills/d/SKILL.md': skill('d'), 'skills/d/rules.md': '- **DOC-1** Three.\n',
    'skills/old': link('nowhere'), 'agents/z.md': agent('reviewer'), 'agents/y.md': agent('reviewer'),
  });
  const reversed = async (path: string) => (await readdir(path)).sort().reverse();
  const forward = await readSkillSet([], { cwd: root });
  const backward = await readSkillSet([], { cwd: root, list: reversed });
  expect(backward).toEqual(forward);
  expect(forward.problems.length).toBeGreaterThan(5);
});
