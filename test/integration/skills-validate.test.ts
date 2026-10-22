/** `stackledger skills validate` on the built CLI (skills-validate-command spec, and skill-source's
 * Write-protected run). Run npm run build && npm test. Fictitious Northwind skill sets only.
 */
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './helpers.js';
import { agent, playbook, rules, skill, skillSet } from '../skills-helpers.js';

const USAGE_LINE = 'stackledger skills validate [folder...] [--json]';
/** A repository with one skill whose description is too long: one warning at 3:14. */
const longDescription = () => skillSet({ 'repo/skills/writer/SKILL.md': skill('writer', { description: 'd'.repeat(1025) }) });

// Node 22.12 only knows --experimental-permission; Node 26 only --permission; 22.13 to 24 accept both.
const nodeHelp = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout;
const permissionFlag = /\s--permission\b/.test(nodeHelp) ? '--permission' : '--experimental-permission';

test('Write-protected run', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer', { description: 'd'.repeat(1025) }), 'repo/skills/release/SKILL.md': playbook('release', 'writer editr'),
    'repo/agents/reviewer.md': agent('reviewer', 'skills: [writer, linting]\n'), 'repo/skills/writer/rules.md': rules('- **DOC-1** One.') });
  const flags = ['--no-warnings', permissionFlag, '--allow-fs-read=*'];
  for (const args of [['skills', 'validate', 'repo'], ['skills', 'validate', 'repo', '--json'], ['skills', 'validate', 'repo', 'missing']]) {
    const unrestricted = run(args, root), restricted = run(args, root, flags);
    expect(restricted).toEqual(unrestricted);
  }
  expect(run(['skills', 'validate', 'repo'], root).status).toBe(1);
  // The same flags really deny a write: not a no-op under a permissive flag.
  const target = join(root, 'repo', 'written');
  const probe = spawnSync(process.execPath, [...flags, '-e', 'require("node:fs").writeFileSync(process.argv[1], "x")', target], { encoding: 'utf8' });
  expect(probe.status).not.toBe(0);
  expect(probe.stderr).toContain('ERR_ACCESS_DENIED');
  expect(existsSync(target)).toBe(false);
}, 120_000);

test('Default folder', () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'agents/reviewer.md': agent('reviewer') });
  const result = run(['skills', 'validate'], root);
  expect(result).toEqual({ status: 0, stderr: '', stdout: 'skills: 1, playbooks: 0, agents: 1, rules: 0, ignored: 0, errors: 0, warnings: 0\n' });
});

test('Several folders', () => {
  const root = skillSet({ 'team/writer/SKILL.md': skill('writer'), 'vendor/writer/SKILL.md': skill('writer'), 'vendor/release/SKILL.md': playbook('release', 'writer') });
  const result = run(['skills', 'validate', 'team', 'vendor'], root);
  // `team` is read first, so the duplicate is the copy under `vendor`, and the playbook finds `writer`.
  expect(result.stdout).toBe('vendor/writer/SKILL.md:2:7 error name Name writer is already used by team/writer/SKILL.md\n'
    + 'skills: 1, playbooks: 1, agents: 0, rules: 0, ignored: 0, errors: 1, warnings: 0\n');
  expect(result.status).toBe(1);
});

test('Folder given twice', () => {
  const root = skillSet({ 'team/writer/SKILL.md': skill('writer'), 'team/agents/reviewer.md': agent('reviewer') });
  const result = run(['skills', 'validate', 'team', './team/'], root);
  expect(result).toEqual({ status: 0, stderr: '', stdout: 'skills: 1, playbooks: 0, agents: 1, rules: 0, ignored: 0, errors: 0, warnings: 0\n' });
});

test('Help wins', () => {
  const result = run(['skills', 'validate', '--help', '--fast']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(USAGE_LINE);
  expect(result.stderr).toBe('');
  expect(run(['--help']).stdout).toContain(USAGE_LINE);
});

test('No subcommand', () => {
  const result = run(['skills']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('A skills subcommand is required');
  expect(result.stderr).toContain(USAGE_LINE);
});

test('Unknown subcommand', () => {
  const result = run(['skills', 'check']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain("'check'");
});

test('Unknown option', () => {
  const result = run(['skills', 'validate', '--strict']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('--strict');
  expect(result.stderr).toContain('Usage:');
});

test('Warnings only', () => {
  const result = run(['skills', 'validate', 'repo'], longDescription());
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('errors: 0, warnings: 1');
  expect(result.stderr).toBe('');
});

test('One error', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': '# Writer\n' });
  const result = run(['skills', 'validate', 'repo'], root);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('errors: 1, warnings: 0');
  expect(result.stderr).toBe('');
});

test('Missing second folder', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer') });
  const result = run(['skills', 'validate', 'repo', 'missing', '--json'], root);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('missing');
});

test('Relative argument', () => {
  const result = run(['skills', 'validate', 'repo'], longDescription());
  expect(result.stdout.split('\n')[0]).toMatch(/^repo\/skills\/writer\/SKILL\.md:/);
});

test('No argument', () => {
  const root = longDescription();
  const result = run(['skills', 'validate'], join(root, 'repo'));
  expect(result.stdout.split('\n')[0]).toMatch(/^skills\/writer\/SKILL\.md:/);
});

test('Trailing separator', () => {
  const result = run(['skills', 'validate', 'repo/'], longDescription());
  expect(result.stdout.split('\n')[0]).toMatch(/^repo\/skills\/writer\/SKILL\.md:/);
});

test('Position of a relation', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/skills/release/SKILL.md': skill('release', { metadata: { 'stackledger-skills': 'writer editr' } }) });
  const result = run(['skills', 'validate', 'repo'], root);
  expect(result.stdout.split('\n')[0]).toMatch(/^repo\/skills\/release\/SKILL\.md:5:23 error metadata\.stackledger-skills .*editr/);
});

test('Position of an unknown key', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer'),
    'repo/skills/release/SKILL.md': skill('release', { metadata: { 'stackledger-kind': 'playbook', 'stackledger-skill': 'writer' } }) });
  const result = run(['skills', 'validate', 'repo'], root);
  expect(result.stdout.split('\n')[0]).toMatch(/^repo\/skills\/release\/SKILL\.md:6:3 error metadata\.stackledger-skill /);
});

test('Problem line', () => {
  const result = run(['skills', 'validate', 'repo'], longDescription());
  expect(result.stdout.startsWith('repo/skills/writer/SKILL.md:3:14 warning description ')).toBe(true);
  expect(result.stdout.split('\n')[0]!.length).toBeGreaterThan('repo/skills/writer/SKILL.md:3:14 warning description '.length);
});

test('Control characters in a file name', () => {
  // The folder name differs from the skill name, so its path is printed with a warning.
  const name = 'nw\u001b[2J\u009b2J';
  const root = skillSet({ [`repo/${name}/SKILL.md`]: skill('writer') });
  const text = run(['skills', 'validate', 'repo'], root), json = run(['skills', 'validate', 'repo', '--json'], root);
  expect(text.status).toBe(0);
  expect(text.stdout).toMatch(/^repo\/nw\[2J2J\/SKILL\.md:2:7 warning name /);
  for (const line of text.stdout.split('\n')) expect(line).not.toMatch(/[\u001b\u009b]/);
  expect(json.stdout).toContain('\\u009b');
  expect(json.stdout).not.toMatch(/[\u001b\u009b]/);
  expect(JSON.parse(json.stdout).problems[0].path).toBe(`repo/${name}/SKILL.md`);
});

test('Clean set', () => {
  const root = skillSet({
    'skills/writer/SKILL.md': skill('writer'),
    'skills/writer/rules.md': rules('- **WRI-1** One.', '- **WRI-2** Two.', '- **WRI-3** Three.', '- **WRI-4** Four.', '- **WRI-5** Five.'),
    'skills/editor/SKILL.md': skill('editor'),
    'skills/editor/rules.md': rules('- **EDI-1** One.', '- **EDI-2** Two.', '- **EDI-3** Three.', '- **EDI-4** Four.', '- **EDI-5** Five.'),
    'skills/translator/SKILL.md': skill('translator'),
    'skills/release/SKILL.md': playbook('release', 'writer editor translator', 'reviewer executor'),
    'agents/reviewer.md': agent('reviewer', 'skills:\n  - editor\n'),
    'agents/executor.md': agent('executor'),
  });
  const result = run(['skills', 'validate'], root);
  expect(result.stdout).toBe('skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 0, warnings: 0\n');
  expect(result.status).toBe(0);
});

test('JSON with one error', () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/skills/release/SKILL.md': playbook('release', 'writer editr') });
  const result = run(['skills', 'validate', 'repo', '--json'], root);
  expect(result.stdout.endsWith('}\n')).toBe(true);
  const output = JSON.parse(result.stdout);
  expect(output.problems).toEqual([{ path: 'repo/skills/release/SKILL.md', line: 6, column: 23, severity: 'error', field: 'metadata.stackledger-skills', message: 'Skill editr is not in the set' }]);
  expect(Object.keys(output)).toEqual(['problems', 'ignored', 'summary']);
  expect(output.ignored).toEqual([]);
  expect(output.summary).toEqual({ skills: 1, playbooks: 1, agents: 0, rules: 0, ignored: 0, errors: 1, warnings: 0 });
  expect(result.status).toBe(1);
});

test('JSON ignored list', () => {
  const root = skillSet({ 'repo/.stackledgerignore': 'fixtures/\ntemplates/\n', 'repo/skills/writer/SKILL.md': skill('writer'),
    'repo/fixtures/broken/SKILL.md': '# Broken on purpose\n', 'repo/templates/skill/SKILL.md': skill('{{name}}') });
  const result = run(['skills', 'validate', 'repo', '--json'], root);
  const output = JSON.parse(result.stdout);
  expect(output.ignored).toEqual(['repo/fixtures', 'repo/templates']);
  expect(output.summary.ignored).toBe(2);
  expect(Object.keys(output.summary)).toEqual(['skills', 'playbooks', 'agents', 'rules', 'ignored', 'errors', 'warnings']);
  expect(output.problems).toEqual([]);
  expect(result.status).toBe(0);
  const text = run(['skills', 'validate', 'repo'], root);
  expect(text.stdout).toBe('skills: 1, playbooks: 0, agents: 0, rules: 0, ignored: 2, errors: 0, warnings: 0\n');
});

// skills-site: the skills map file in `skills validate` (skills-validate-command delta).
const LINE = 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["skill:writer", "skill:editor"]\n';
test('Broken map file fails a pipeline', () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'), 'stackledger-skills.yaml': 'kind: [\n' });
  const result = run(['skills', 'validate'], root);
  expect(result.status).toBe(1);
  expect(result.stdout).toMatch(/^stackledger-skills\.yaml:\d+:\d+ error /m);
});
test('Counts line unchanged', () => {
  const files = { 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor') };
  const without = run(['skills', 'validate', '--json'], skillSet(files));
  const withMap = run(['skills', 'validate', '--json'], skillSet({ ...files, 'stackledger-skills.yaml': LINE }));
  expect(Object.keys(JSON.parse(withMap.stdout).summary)).toEqual(Object.keys(JSON.parse(without.stdout).summary));
  const counts = (text: string) => text.trimEnd().split('\n').at(-1)!.replace(/warnings: \d+/, 'warnings: n');
  expect(counts(run(['skills', 'validate'], skillSet({ ...files, 'stackledger-skills.yaml': LINE })).stdout))
    .toBe(counts(run(['skills', 'validate'], skillSet(files)).stdout));
});
