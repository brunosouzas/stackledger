/** Frontmatter, name and description, and the Agent Skills specification checks (skill-source spec).
 * Run npm test. Fixtures are fictitious Northwind skills in temporary folders.
 */
import { test, expect } from 'vitest';
import { readSkillSet } from '../../src/skills/source.js';
import { skill, skillSet } from '../skills-helpers.js';

/** Read one SKILL.md placed in `folder/` of a fresh set. */
async function one(text: string, folder = 'writer') {
  return readSkillSet([], { cwd: skillSet({ [`${folder}/SKILL.md`]: text }) });
}

test('No frontmatter', async () => {
  const set = await one('# Writer\n\nNorthwind notes.\n');
  expect(set.problems).toMatchObject([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error', field: null }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills).toEqual([]);
});

test('Invalid YAML', async () => {
  const set = await one('---\nname: writer\nname: writer\ndescription: [unclosed\n---\n');
  expect(set.problems).toMatchObject([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills).toEqual([]);
});

test('Frontmatter never closed', async () => {
  const set = await one('---\nname: writer\ndescription: Northwind writer.\n\n# Writer\n');
  expect(set.problems).toMatchObject([{ line: 1, column: 1, severity: 'error', message: 'Frontmatter is not closed by a --- line' }]);
  expect(set.problems).toHaveLength(1);
});

test('CRLF and byte-order mark', async () => {
  const set = await one('\uFEFF' + skill('writer', { metadata: { 'stackledger-kind': 'skill' } }).replace(/\n/g, '\r\n'));
  expect(set.problems).toEqual([]);
  expect(set.skills).toMatchObject([{ name: 'writer', kind: 'skill' }]);
});

test('Missing description', async () => {
  const set = await one('---\nname: writer\n---\n');
  expect(set.problems).toMatchObject([{ field: 'description', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills).toEqual([]);
});

test('Name not a string', async () => {
  const set = await one('---\nname: 42\ndescription: Northwind writer.\n---\n');
  expect(set.problems).toMatchObject([{ field: 'name', line: 2, column: 7, severity: 'error' }]);
  expect(set.skills).toEqual([]);
});

test('Upper-case name', async () => {
  const set = await one(skill('Writer'), 'Writer');
  expect(set.problems).toMatchObject([{ field: 'name', severity: 'warning', line: 2, column: 7 }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills.map(item => item.name)).toEqual(['Writer']);
});

test('Name differs from the folder', async () => {
  const set = await one(skill('writer'), 'writing');
  expect(set.problems).toMatchObject([{ field: 'name', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.problems[0]!.message).toContain('writing');
  expect(set.skills.map(item => item.name)).toEqual(['writer']);
});

test('Ligatures in a description', async () => {
  const description = '\uFB03'.repeat(342);
  expect(Array.from(description.normalize('NFKC'))).toHaveLength(1026);
  const set = await one(skill('writer', { description }));
  expect(set.problems).toEqual([]);
});

test('Description at the limit', async () => {
  // 1023 letters and one emoji (two UTF-16 units, one code point).
  const atLimit = await one(skill('writer', { description: 'a'.repeat(1023) + '\u{1F4DD}' }));
  expect(atLimit.problems).toEqual([]);
  const over = await one(skill('writer', { description: 'a'.repeat(1024) + '\u{1F4DD}' }));
  expect(over.problems).toMatchObject([{ field: 'description', severity: 'warning', line: 3, column: 14 }]);
  expect(over.problems).toHaveLength(1);
});

test('Tool-specific fields', async () => {
  const set = await one(skill('writer', { extra: 'version: 1.0.0\nauthor: Northwind\naliases: [w]\n' }));
  expect(set.problems).toEqual([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'warning', field: null,
    message: 'Fields outside the Agent Skills specification: aliases, author, version' }]);
});

test('Number as a metadata key', async () => {
  const set = await one(skill('writer', { metadata: { 42: 'note' } }));
  expect(set.problems).toMatchObject([{ field: 'metadata.42', line: 5, column: 3, severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
});

test('Ordered map as metadata is not a mapping (regression)', async () => {
  const set = await one(skill('writer', { extra: 'metadata: !!omap [{stackledger-skills: missing}]\n' }));
  expect(set.problems).toMatchObject([{ field: 'metadata', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills.map(s => s.kind)).toEqual(['skill']);
});

test('Nested metadata', async () => {
  const set = await one(skill('writer', { extra: 'metadata:\n  hermes:\n    tags: [writing]\n' }));
  expect(set.problems).toMatchObject([{ field: 'metadata.hermes', line: 6, severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
});
