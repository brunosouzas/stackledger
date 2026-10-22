/** Order of checks, checks across items, secrets, files that cannot be read and folders with nothing
 * found (skill-source spec). Run npm test. Fictitious Northwind fixtures; the card number is the
 * standard test number 4111111111111111 and the key text is not a real key.
 */
import { test, expect } from 'vitest';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { readSkillSet } from '../../src/skills/source.js';
import { formatJson, formatText } from '../../src/skills/command.js';
import { MAX_FILE_BYTES } from '../../src/source.js';
import { link, playbook, rules, skill, skillSet } from '../skills-helpers.js';

const asRoot = process.getuid?.() === 0;
const CARD = '4111111111111111';
const KEY_BODY = 'MIIBOgIBAAJBAKnorthwindfictitiouskeymaterial';
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----\n${KEY_BODY}\n-----END RSA PRIVATE KEY-----\n`;
const read = (root: string, folders: string[] = []) => readSkillSet(folders, { cwd: root });
/** Both outputs of a set, to check that a value never reaches them. */
const outputs = (set: Awaited<ReturnType<typeof readSkillSet>>) => formatText(set) + formatJson(set);

test('Secret and no frontmatter', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': `# Writer\n\n${PRIVATE_KEY}` }));
  expect(set.problems).toEqual([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'Private key material is not allowed' }]);
  expect(set.skills).toEqual([]);
});

test('Escaped card number', async () => {
  const text = skill('release', { metadata: { 'stackledger-kind': 'playbook', 'stackledger-skills': '"411111111111111\\u0031"' } });
  expect(text).not.toContain(CARD);
  const set = await read(skillSet({ 'release/SKILL.md': text }));
  expect(set.problems).toEqual([{ path: 'release/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'Payment-card number is not allowed' }]);
  for (const line of outputs(set).split('\n')) expect(line).not.toContain(CARD);
});

test('Escaped card number inside a YAML set or ordered map (regression)', async () => {
  for (const extra of ['metadata: !!set {"411111111111111\\u0031": null}\n', 'labels: !!omap [{"411111111111111\\u0031": x}]\n', 'code: 0xe9b08a568f1c7\n']) {
    const text = skill('release', { extra });
    expect(text).not.toContain(CARD);
    const set = await read(skillSet({ 'release/SKILL.md': text }));
    expect(set.problems).toEqual([{ path: 'release/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'Payment-card number is not allowed' }]);
    expect(set.skills).toEqual([]);
    for (const line of outputs(set).split('\n')) expect(line).not.toContain(CARD);
  }
});

test('Several field problems', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer', { description: 'd'.repeat(1025), metadata: { 'stackledger-kind': 'process' } }) }));
  expect(set.problems.map(p => [p.field, p.severity])).toEqual([['description', 'warning'], ['metadata.stackledger-kind', 'error']]);
  expect(set.skills).toEqual([]);
});

test('Name and description both missing', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': '---\n{}\n---\n' }));
  expect(set.problems).toMatchObject([{ field: 'description', line: 1, column: 1, severity: 'error' }, { field: 'name', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(2);
});

test('Target excluded by an error', async () => {
  const set = await read(skillSet({ 'editor/SKILL.md': '# Editor\n', 'release/SKILL.md': playbook('release', 'editor') }));
  expect(set.problems).toMatchObject([{ path: 'editor/SKILL.md', severity: 'error' }, { path: 'release/SKILL.md', field: 'metadata.stackledger-skills', severity: 'error' }]);
  expect(set.problems).toHaveLength(2);
  expect(set.problems[1]!.message).toContain('editor');
});

test('Cascading relations', async () => {
  const set = await read(skillSet({ 'a/SKILL.md': playbook('a', 'b'), 'b/SKILL.md': skill('b', { metadata: { 'stackledger-skills': 'missing' } }) }));
  expect(set.problems).toMatchObject([{ path: 'b/SKILL.md', severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.summary).toMatchObject({ skills: 1, playbooks: 1, errors: 1 });
});

test('Private key in a skill', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer', { body: `# Writer\n\n\`\`\`\n${PRIVATE_KEY}\`\`\`\n` }) }));
  expect(set.problems).toMatchObject([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(outputs(set)).not.toContain(KEY_BODY);
  expect(outputs(set)).not.toContain('BEGIN RSA');
});

test('Card number as a skill name', async () => {
  const named = await read(skillSet({ 'writer/SKILL.md': skill(`"${CARD}"`), 'release/SKILL.md': playbook('release', CARD) }));
  expect(named.problems).toEqual([
    { path: 'release/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'Payment-card number is not allowed' },
    { path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'Payment-card number is not allowed' },
  ]);
  for (const line of outputs(named).split('\n')) expect(line).not.toContain(CARD);
});

test('Ordinary numbers', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/rules.md': rules('- **DOC-1** Quote ticket 1234567890123 in the note.') }));
  expect(set.problems).toEqual([]);
  expect(set.summary.rules).toBe(1);
});

test('Oversized rules file', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/rules.md': rules('- **DOC-1** One.').padEnd(MAX_FILE_BYTES + 1, ' ') }));
  expect(set.problems).toMatchObject([{ path: 'writer/rules.md', line: 1, column: 1, severity: 'error' }]);
  expect(set.problems).toHaveLength(1);
  expect(set.skills).toMatchObject([{ name: 'writer', rules: [] }]);
});

test.skipIf(asRoot)('Unreadable SKILL.md', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor') });
  chmodSync(join(root, 'writer/SKILL.md'), 0);
  const set = await read(root);
  expect(set.problems).toEqual([{ path: 'writer/SKILL.md', line: 1, column: 1, severity: 'error', field: null, message: 'File cannot be read' }]);
  expect(set.skills.map(item => item.name)).toEqual(['editor']);
});

test('Wrong folder', async () => {
  const root = skillSet({ 'docs/README.md': '# Northwind\n' });
  const set = await read(root, ['docs']);
  expect(set.problems).toEqual([expect.objectContaining({ path: 'docs', line: 1, column: 1, severity: 'error' })]);
  expect((await read(join(root, 'docs'))).problems).toMatchObject([{ path: '.', severity: 'error' }]);
});

test('Everything already read', async () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/skills/editor/SKILL.md': skill('editor'),
    'tool/skills/writer': link('repo/skills/writer'), 'tool/skills/editor': link('repo/skills/editor') });
  const set = await read(root, ['repo', 'tool']);
  expect(set.problems).toEqual([]);
  expect(set.summary.skills).toBe(2);
});

test('Everything ignored', async () => {
  const root = skillSet({ 'repo/.stackledgerignore': '*\n', 'repo/skills/writer/SKILL.md': skill('writer') });
  const set = await read(root, ['repo']);
  expect(set.problems).toEqual([{ path: 'repo', line: 1, column: 1, severity: 'error', field: null,
    message: 'No skill folder or agent file found in this folder; 1 entry was skipped by .stackledgerignore' }]);
  expect(set.summary.ignored).toBe(1);
});
