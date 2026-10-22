/** The `.stackledgerignore` file (skill-source spec: Ignore file, Ignore file syntax, Ignore file text,
 * Matching paths, Tested path, What the ignore file skips, Ignored count and list, Ignore file limits,
 * Ignore file problems). One test per scenario, named after it. Run npm test.
 * Fixtures are fictitious Northwind skills in temporary folders (test/skills-helpers.ts); the card
 * number is the standard test number 4111111111111111.
 */
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readSkillSet } from '../../src/skills/source.js';
import { formatJson, formatText } from '../../src/skills/command.js';
import { IgnoreMatcherError, MAX_IGNORE_BYTES } from '../../src/skills/ignore.js';
import { internal } from '../../src/errors.js';
import { agent, link, rules, skill, skillSet } from '../skills-helpers.js';

const IGNORE = '.stackledgerignore';
const CARD = '4111111111111111';
const read = (root: string, folders: string[] = []) => readSkillSet(folders, { cwd: root });
const names = (set: { skills: { name: string }[] }) => set.skills.map(item => item.name);
const errors = (set: Awaited<ReturnType<typeof readSkillSet>>) => set.problems.filter(problem => problem.severity === 'error');
/** Both outputs of a set, to check that a value never reaches them. */
const outputs = (set: Awaited<ReturnType<typeof readSkillSet>>) => formatText(set) + formatJson(set);
/** An ignore file of `bytes` bytes: `templates/`, then comment lines. */
const oversized = (bytes: number) => `templates/\n${'# Northwind padding\n'.repeat(Math.ceil(bytes / 19))}`.slice(0, bytes);

test('Template folder ignored', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'templates/\n', 'repo/skills/writer/SKILL.md': skill('writer'),
    'repo/templates/skill/SKILL.md': skill('skill') }), ['repo']);
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
});

test('Ignore file below the top', async () => {
  const set = await read(skillSet({ [`repo/skills/${IGNORE}`]: 'writer/\n', 'repo/skills/writer/SKILL.md': skill('writer') }), ['repo']);
  expect(names(set)).toEqual(['writer']);
  expect(set.summary.ignored).toBe(0);
});

test('Ignore file above the given folder', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'templates/\n', 'repo/skills/templates/skill/SKILL.md': skill('skill') }), ['repo/skills']);
  expect(names(set)).toEqual(['skill']);
  expect(set.summary.ignored).toBe(0);
});

test('Ignore file in a skill folder', async () => {
  const set = await read(skillSet({ 'writer/SKILL.md': skill('writer'), [`writer/${IGNORE}`]: '*\n' }), ['writer']);
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(0);
});

test('Negation re-includes a skill', async () => {
  const set = await read(skillSet({ [IGNORE]: 'examples/*\n!examples/northwind\n',
    'examples/northwind/SKILL.md': skill('northwind'), 'examples/draft/SKILL.md': skill('draft') }));
  expect(names(set)).toEqual(['northwind']);
  expect(set.problems).toEqual([]);
});

test('Ignored folder cannot be re-included below', async () => {
  const set = await read(skillSet({ [IGNORE]: 'fixtures/\n!fixtures/good/\n', 'fixtures/good/SKILL.md': skill('good'), 'skills/writer/SKILL.md': skill('writer') }));
  expect(names(set)).toEqual(['writer']);
  expect(set.ignored).toEqual(['fixtures']);
});

test('Pattern syntax table', async () => {
  const rows: [string, string, boolean][] = [
    ['draft/\n', 'a/b/draft', false],
    ['/draft/\n', 'a/b/draft', true],
    ['**/tmp/\n', 'x/y/tmp', false],
    ['\\!keep/\n', '!keep', false],
    ['\\#draft/\n', '#draft', false],
    ['# templates/\n', 'templates/skill', true],
    ['old \n', 'old', false],
    ['Templates/\n', 'templates/skill', true],
    ['a[\ntemplates/\n', 'templates/skill', false],
  ];
  for (const [file, folder, expected] of rows) {
    // The skill's name is its folder name without punctuation: `!keep` and `#draft` are not YAML-safe names.
    const name = folder.split('/').at(-1)!.replace(/[^a-z]/g, '');
    const set = await read(skillSet({ [IGNORE]: file, [`${folder}/SKILL.md`]: skill(name), 'writer/SKILL.md': skill('writer') }));
    expect([file, names(set).includes(name)]).toEqual([file, expected]);
    expect(errors(set)).toEqual([]);
  }
});

test('CRLF and byte-order mark', async () => {
  const set = await read(skillSet({ [IGNORE]: '\uFEFFtemplates/\r\nfixtures/\r\n', 'templates/skill/SKILL.md': skill('skill'),
    'fixtures/broken/SKILL.md': skill('broken'), 'skills/writer/SKILL.md': skill('writer') }));
  expect(names(set)).toEqual(['writer']);
  expect(set.ignored).toEqual(['fixtures', 'templates']);
});

test('Link matched by its name', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'shared\n', 'repo/skills/writer/SKILL.md': skill('writer'),
    'elsewhere/shared/SKILL.md': skill('shared'), 'repo/shared': link('elsewhere/shared') }), ['repo']);
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(1);
  expect(set.ignored).toEqual(['repo/shared']);
});

test('Folder pattern does not match a link', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'shared/\n', 'elsewhere/shared/SKILL.md': skill('shared'), 'repo/shared': link('elsewhere/shared') }), ['repo']);
  expect(names(set)).toEqual(['shared']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(0);
});

test('Broken link matched', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'old\n', 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/old': link('missing') }), ['repo']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(1);
});

test('Folder pattern does not match a broken link', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'old/\n', 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/old': link('missing') }), ['repo']);
  expect(set.problems).toMatchObject([{ path: 'repo/old', severity: 'warning' }]);
  expect(set.problems).toHaveLength(1);
});

test('SKILL.md pattern and a linked skill', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'fixtures/*/SKILL.md\n', 'elsewhere/shared/SKILL.md': skill('shared'),
    'repo/fixtures/shared': link('elsewhere/shared') }), ['repo']);
  expect(names(set)).toEqual(['shared']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(0);
});

test('Folder pattern does not match a file', async () => {
  const set = await read(skillSet({ [IGNORE]: 'helper.md/\n', 'agents/helper.md': agent('helper') }));
  expect(set.agents.map(item => item.name)).toEqual(['helper']);
  expect(set.problems).toEqual([]);
});

test('SKILL.md pattern', async () => {
  const set = await read(skillSet({ [IGNORE]: 'fixtures/*/SKILL.md\n', 'fixtures/broken/SKILL.md': '# Broken on purpose\n', 'skills/writer/SKILL.md': skill('writer') }));
  expect(names(set)).toEqual(['writer']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(1);
  expect(set.ignored).toEqual(['fixtures/broken']);
});

test('Files the walk does not use', async () => {
  const set = await read(skillSet({ [IGNORE]: '*.txt\nREADME.md\n', 'README.md': '# Northwind skills\n', 'notes.txt': 'Northwind notes\n',
    'skills/writer/SKILL.md': skill('writer') }));
  expect(names(set)).toEqual(['writer']);
  expect(set.summary.ignored).toBe(0);
  expect(set.ignored).toEqual([]);
});

test('Agent file ignored', async () => {
  const set = await read(skillSet({ [IGNORE]: 'agents/README.md\n', 'agents/README.md': '---\nname: notes\n', 'agents/reviewer.md': agent('reviewer') }));
  expect(set.agents.map(item => item.name)).toEqual(['reviewer']);
  expect(set.problems).toEqual([]);
  expect(set.ignored).toEqual(['agents/README.md']);
});

test('Patterns stay in their folder', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'writer/\n', 'repo/skills/editor/SKILL.md': skill('editor'), 'tool/skills/writer/SKILL.md': skill('writer') }), ['repo', 'tool']);
  expect(set.skills.map(item => item.path)).toEqual(['repo/skills/editor/SKILL.md', 'tool/skills/writer/SKILL.md']);
  expect(set.problems).toEqual([]);
});

test('Overlapping folders', async () => {
  const set = await read(skillSet({ [`repo/${IGNORE}`]: 'skills/draft/\n', 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/skills/draft/SKILL.md': skill('draft') }),
    ['repo', 'repo/skills']);
  expect(set.skills.map(item => item.path)).toEqual(['repo/skills/writer/SKILL.md', 'repo/skills/draft/SKILL.md']);
  expect(set.problems).toEqual([]);
  expect(set.summary.ignored).toBe(1);
  expect(set.ignored).toEqual(['repo/skills/draft']);
});

test('Rules file is never ignored', async () => {
  const set = await read(skillSet({ [IGNORE]: 'rules.md\n', 'skills/writer/SKILL.md': skill('writer'), 'skills/writer/rules.md': rules('- **DOC-1** Update the README.') }));
  expect(set.skills[0]!.rules.map(rule => rule.id)).toEqual(['DOC-1']);
  expect(set.summary).toMatchObject({ rules: 1, ignored: 0 });
});

test('Count', async () => {
  const set = await read(skillSet({ [IGNORE]: 'templates/\nfixtures/*\n', 'templates/skill/SKILL.md': skill('skill'),
    'fixtures/broken/SKILL.md': skill('broken'), 'fixtures/empty/SKILL.md': skill('empty'), 'skills/writer/SKILL.md': skill('writer') }));
  expect(set.summary.ignored).toBe(3);
  expect(set.ignored).toEqual(['fixtures/broken', 'fixtures/empty', 'templates']);
});

test('Skill skipped by its SKILL.md', async () => {
  const set = await read(skillSet({ [IGNORE]: '**/draft/SKILL.md\n', 'skills/draft/SKILL.md': skill('draft'), 'skills/writer/SKILL.md': skill('writer') }));
  expect(JSON.parse(formatJson(set)).ignored).toEqual(['skills/draft']);
  expect(names(set)).toEqual(['writer']);
});

test('Folder given twice with an ignore file', async () => {
  const set = await read(skillSet({ [`team/${IGNORE}`]: 'templates/\n', 'team/templates/skill/SKILL.md': skill('skill'), 'team/skills/writer/SKILL.md': skill('writer') }),
    ['team', './team/']);
  expect(set.summary.ignored).toBe(1);
  expect(set.ignored).toEqual(['team/templates']);
  expect(set.problems).toEqual([]);
});

test('Too many pattern lines', async () => {
  const lines = ['templates/', ...Array.from({ length: 100 }, (_, index) => `draft-${index}/`)];
  const set = await read(skillSet({ [IGNORE]: `${lines.join('\n')}\n`, 'templates/skill/SKILL.md': skill('skill') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, severity: 'error' })]);
  expect(set.problems[0]!.message).toContain('line 101');
  expect(names(set)).toEqual(['skill']);
});

test('Line too long for the matcher', async () => {
  const line = `northwind-${'q'.repeat(191)}`;
  expect(line).toHaveLength(201);
  const set = await read(skillSet({ [IGNORE]: `# Northwind\n${line}\n`, 'skills/writer/SKILL.md': skill('writer') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, severity: 'error' })]);
  expect(set.problems[0]!.message).toContain('line 2');
  expect(outputs(set)).not.toContain('northwind-q');
});

test('Too many wildcards', async () => {
  const set = await read(skillSet({ [IGNORE]: `templates/\n${'*'.repeat(17)}\n`, 'skills/writer/SKILL.md': skill('writer') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, severity: 'error' })]);
  expect(set.problems[0]!.message).toContain('line 2');
});

test('Matcher failure', async () => {
  const root = skillSet({ [IGNORE]: 'templates/\n', 'skills/writer/SKILL.md': skill('writer') });
  // A matcher whose own message repeats the pattern and the tested path, as a library error might.
  const failing = () => ({ ignores(path: string): boolean { throw new Error(`pattern templates/ failed on ${path}`); } });
  const failure = await readSkillSet([], { cwd: root, matcher: failing }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(IgnoreMatcherError);
  const message = internal('skills validate', failure).message;
  expect(message).toMatch(/^stackledger skills validate: internal error: /);
  // The first tested path is `skills/`; the command's own name holds the word skills.
  for (const text of ['templates', 'skills/', 'writer']) expect(message).not.toContain(text);
});

test('Secret in the ignore file', async () => {
  const set = await read(skillSet({ [IGNORE]: `${CARD}/\ntemplates/\n`, 'templates/skill/SKILL.md': skill('skill') }));
  expect(set.problems).toEqual([{ path: IGNORE, line: 1, column: 1, severity: 'error', field: null, message: 'Payment-card number is not allowed' }]);
  expect(names(set)).toEqual(['skill']);
  for (const line of outputs(set).split('\n')) expect(line).not.toContain(CARD);
});

test('Oversized ignore file', async () => {
  const set = await read(skillSet({ [IGNORE]: oversized(MAX_IGNORE_BYTES + 1), 'templates/skill/SKILL.md': skill('skill') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, line: 1, column: 1, severity: 'error' })]);
  expect(names(set)).toEqual(['skill']);
  // At the limit the file is read: its first line skips the template.
  const atLimit = await read(skillSet({ [IGNORE]: oversized(MAX_IGNORE_BYTES), 'templates/skill/SKILL.md': skill('skill'), 'skills/writer/SKILL.md': skill('writer') }));
  expect(atLimit.problems).toEqual([]);
  expect(names(atLimit)).toEqual(['writer']);
});

test('FIFO ignore file', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer') });
  execFileSync('mkfifo', [join(root, IGNORE)]);
  const set = await read(root);
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, line: 1, column: 1, severity: 'error' })]);
  expect(names(set)).toEqual(['writer']);
});

test('Broken link ignore file', async () => {
  const set = await read(skillSet({ [IGNORE]: link('missing'), 'templates/skill/SKILL.md': skill('skill') }));
  expect(set.problems).toEqual([expect.objectContaining({ path: IGNORE, line: 1, column: 1, severity: 'error' })]);
  expect(names(set)).toEqual(['skill']);
});

test('Ignore file problem in a folder given twice', async () => {
  const set = await read(skillSet({ [`team/${IGNORE}`]: oversized(MAX_IGNORE_BYTES + 1), 'team/skills/writer/SKILL.md': skill('writer') }), ['team', './team/']);
  expect(set.problems).toEqual([expect.objectContaining({ path: `team/${IGNORE}`, severity: 'error' })]);
});
