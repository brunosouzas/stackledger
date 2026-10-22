/** `stackledger build --skills` against the built CLI (build-command spec: Command, Writes, Deterministic
 * build, Skill folders, Skills settings with problems, Skill folder errors, One page per skill item,
 * Output folder and the skill set, Skills build report). Build first with npm run build. Each case
 * runs the real command in a child process, in one temporary folder removed after the file. Catalogues
 * and skill sets are fictitious Northwind ones.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { component, line, set, settings } from '../unit/helpers.js';
import { yaml } from './mcp-helpers.js';
import { cli, root } from './helpers.js';
import { agent, playbook, rules, skill } from '../skills-helpers.js';

const DATE = '2027-06-01';
interface Result { status: number; stdout: string; stderr: string }

function build(args: string[], options: { cwd?: string; flags?: string[]; env?: Record<string, string> } = {}): Promise<Result> {
  return new Promise(resolve => {
    execFile(process.execPath, [...(options.flags ?? []), cli, 'build', ...args], { cwd: options.cwd ?? root,
      env: { ...process.env, NODE_OPTIONS: '', ...options.env }, timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
    (error, stdout, stderr) => resolve({ status: error ? (typeof error.code === 'number' ? error.code : -1) : 0, stdout, stderr }));
  });
}

let base = '';
let counter = 0;
const fresh = (name: string) => join(base, `${name}-${++counter}`);
function writeFolder(path: string, files: Record<string, string>): string {
  mkdirSync(path, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    writeFileSync(join(path, file), content);
  }
  return path;
}
function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(relative, entry.name);
      if (entry.isSymbolicLink()) result[path] = `link:${readlinkSync(join(dir, path))}`;
      else if (entry.isDirectory()) { result[path] = 'dir'; walk(path); }
      else result[path] = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
    }
  };
  walk('');
  return result;
}
const stops = (name: string, names: string[]) => set(line(name), 'spec.stops', names.map(item => `component:${item}`));
const catalogueFiles = (extra: unknown[] = []) => ({ 'catalog-info.yaml': yaml(component('editor'), component('forge'), stops('ship', ['editor', 'forge']), ...extra) });
const skillsMap = (body: string) => body;
const SKILL_LINE = 'apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: skills\nspec:\n  stations:\n    "playbook:release": [0, 0]\n    "skill:writer": [2, 0]\n    "agent:reviewer": [4, 0]\n---\n'
  + 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["playbook:release", "skill:writer", "agent:reviewer"]\n';
/** Three skills, one playbook, two agents and ten rules, with a placed skill line. */
const kitFiles = (): Record<string, string> => ({
  'writer/SKILL.md': skill('writer'), 'writer/rules.md': rules(...Array.from({ length: 6 }, (_, i) => `- **WR-${i + 1}** Rule ${i + 1}.`)),
  'editor/SKILL.md': skill('editor'), 'editor/rules.md': rules(...Array.from({ length: 4 }, (_, i) => `- **ED-${i + 1}** Rule ${i + 1}.`)),
  'linter/SKILL.md': skill('linter'),
  'release/SKILL.md': playbook('release', 'writer editor', 'reviewer'),
  'agents/reviewer.md': agent('reviewer'), 'agents/builder.md': agent('builder'),
  'stackledger-skills.yaml': skillsMap(SKILL_LINE),
});
const lines = (text: string) => text.trimEnd().split('\n');

let catalogue = '';
let kit = '';
let withSkills: { out: string; result: Result };

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'stackledger-build-skills-')));
  catalogue = writeFolder(join(base, 'catalogue'), catalogueFiles());
  kit = writeFolder(join(base, 'kit'), kitFiles());
  const out = join(base, 'public');
  withSkills = { out, result: await build([catalogue, '--out', out, '--date', DATE, '--skills', kit]) };
}, 180_000);
afterAll(() => { if (base) rmSync(base, { recursive: true, force: true }); });

test('Two sites with skills', () => {
  const { out, result } = withSkills;
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) expect(existsSync(join(out, site, 'skills', 'index.html'))).toBe(true);
});
test('Counts line', () => {
  expect(lines(withSkills.result.stderr)).toContain('Skills: 3 skills, 1 playbook, 2 agents, 10 rules');
  expect(withSkills.result.stderr).not.toMatch(/Skill set: \d+ error/);
});

test.concurrent('Skills folder elsewhere', async () => {
  const other = fresh('elsewhere');
  cpSync(catalogue, join(other, 'deep', 'catalogue'), { recursive: true });
  cpSync(kit, join(other, 'deep', 'tools', 'kit'), { recursive: true });
  const out = fresh('elsewhere-out');
  const result = await build([join(other, 'deep', 'catalogue'), '--out', out, '--date', DATE, '--skills', join(other, 'deep', 'tools', 'kit')]);
  expect(result.status, result.stderr).toBe(0);
  expect(snapshot(out)).toEqual(snapshot(withSkills.out));
}, 180_000);

test.concurrent('Folders from the settings', async () => {
  const top = fresh('settings');
  const cat = writeFolder(join(top, 'cat'), catalogueFiles([settings('settings', { skills: { folders: ['../kit'] } })]));
  writeFolder(join(top, 'kit'), kitFiles());
  const out = fresh('settings-out');
  const result = await build([cat, '--out', out, '--date', DATE]);
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) expect(existsSync(join(out, site, 'skills', 'writer', 'index.html'))).toBe(true);
}, 180_000);

test.concurrent('The option replaces the settings', async () => {
  const cat = writeFolder(fresh('replace'), catalogueFiles([settings('settings', { skills: { folders: ['../missing'] } })]));
  const out = fresh('replace-out');
  const result = await build([cat, '--out', out, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(out, 'full', 'skills', 'writer', 'index.html'))).toBe(true);
}, 180_000);

test.concurrent('Several option folders', async () => {
  const team = writeFolder(fresh('team'), { 'writer/SKILL.md': skill('writer') });
  const vendor = writeFolder(fresh('vendor'), { 'writer/SKILL.md': skill('writer', { description: 'Vendor copy.' }), 'linter/SKILL.md': skill('linter') });
  const out = fresh('several-out');
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', team, '--skills', vendor]);
  expect(result.status, result.stderr).toBe(0);
  // One set, team first: the vendor's writer is a duplicate name (an error), linter joins.
  expect(readFileSync(join(out, 'full', 'skills', 'writer', 'index.html'), 'utf8')).toContain('Helps the Northwind team with writer.');
  expect(existsSync(join(out, 'full', 'skills', 'linter', 'index.html'))).toBe(true);
  expect(result.stderr).toMatch(/Skill set: 1 error/);
}, 180_000);

test.concurrent('No skill set', async () => {
  const out = fresh('none-out');
  const result = await build([catalogue, '--out', out, '--date', DATE]);
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) for (const folder of ['skills', 'skill-map', 'rules', 'playbooks', 'agents']) expect(existsSync(join(out, site, folder))).toBe(false);
  expect(result.stderr).not.toContain('Skills:');
}, 180_000);

test.concurrent('Error elsewhere in the settings', async () => {
  const cat = writeFolder(fresh('err-elsewhere'), catalogueFiles([settings('settings', { skills: { folders: ['../kit'] }, site: { colors: { accent: 'red' } } })]));
  const out = fresh('err-elsewhere-out');
  expect((await build([catalogue, '--out', out, '--date', DATE])).status).toBe(0);
  const before = snapshot(out);
  const result = await build([cat, '--out', out, '--date', DATE]);
  expect(result.status).toBe(1); expect(result.stderr).toContain('stackledger validate');
  expect(snapshot(out)).toEqual(before);
}, 180_000);

test.concurrent('Error in the skills settings', async () => {
  const cat = writeFolder(fresh('err-skills'), catalogueFiles([settings('settings', { skills: { folders: ['/home/northwind/kit'] } })]));
  const out = fresh('err-skills-out');
  const result = await build([cat, '--out', out, '--date', DATE]);
  expect(result.status).toBe(1); expect(existsSync(out)).toBe(false);
}, 180_000);

test.concurrent('Broken settings and the option', async () => {
  const cat = writeFolder(fresh('broken-option'), catalogueFiles([settings('settings', { skills: { folders: ['/nowhere'] } })]));
  const out = fresh('broken-option-out');
  const result = await build([cat, '--out', out, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(out, 'full', 'skills', 'writer', 'index.html'))).toBe(true);
}, 180_000);

test.concurrent('Unreadable settings file', async () => {
  const cat = writeFolder(fresh('unreadable'), { ...catalogueFiles(), 'settings.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Settings\nmetadata:\n  name: settings\nspec: [\n' });
  const out = fresh('unreadable-out');
  const result = await build([cat, '--out', out, '--date', DATE]);
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(out, 'full', 'skills'))).toBe(false);
  expect(result.stderr).toMatch(/Skill folders could not be read from the settings/);
}, 180_000);

test.concurrent('Broken settings without skills', async () => {
  const cat = writeFolder(fresh('broken-no-skills'), catalogueFiles([settings('settings', { site: { colors: { accent: 'red' } } })]));
  const out = fresh('broken-no-skills-out');
  const result = await build([cat, '--out', out, '--date', DATE]);
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) expect(existsSync(join(out, site, 'skills'))).toBe(false);
}, 180_000);

test.concurrent('Missing skills folder', async () => {
  const out = fresh('missing-out');
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', 'missing'], { cwd: base });
  expect(result.status).toBe(2); expect(result.stderr).toContain('missing'); expect(existsSync(out)).toBe(false);
}, 60_000);

test.concurrent('Missing configured folder', async () => {
  const cat = writeFolder(fresh('missing-configured'), catalogueFiles([settings('settings', { skills: { folders: ['../kit-gone'] } })]));
  const result = await build([cat, '--out', fresh('missing-configured-out'), '--date', DATE]);
  expect(result.status).toBe(2); expect(result.stderr).toContain('../kit-gone'); expect(result.stderr).toContain('spec.skills.folders');
}, 60_000);

test.concurrent('Empty option', async () => {
  const out = fresh('empty-option-out');
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', '']);
  expect(result.status).toBe(2); expect(existsSync(out)).toBe(false);
}, 60_000);

test.concurrent('Nothing found does not empty the section', async () => {
  const out = fresh('nothing-out');
  expect((await build([catalogue, '--out', out, '--date', DATE, '--skills', kit])).status).toBe(0);
  const before = snapshot(out);
  const docs = writeFolder(fresh('docs'), { 'notes.md': '# Notes\n' });
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', docs]);
  expect(result.status).toBe(1); expect(result.stderr).toContain('No skill folder or agent file found');
  expect(snapshot(out)).toEqual(before);
}, 180_000);

test.concurrent('Skill set with errors', async () => {
  const set = writeFolder(fresh('with-errors'), { 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': '---\nname: editor\n---\n' });
  const out = fresh('with-errors-out');
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', set]);
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(out, 'full', 'skills', 'writer', 'index.html'))).toBe(true);
  expect(existsSync(join(out, 'full', 'skills', 'editor'))).toBe(false);
}, 180_000);

test.concurrent('Colliding page names', async () => {
  // Two lone surrogates both encode as U+FFFD, so the two agents get one page file name.
  const set = writeFolder(fresh('collide'), { 'writer/SKILL.md': skill('writer'),
    'agents/one.md': '---\nname: "a\\ud800"\ndescription: One.\n---\n', 'agents/two.md': '---\nname: "a\\udc00"\ndescription: Two.\n---\n' });
  const out = fresh('collide-out');
  expect((await build([catalogue, '--out', out, '--date', DATE])).status).toBe(0);
  const before = snapshot(out);
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', set]);
  expect(result.status, result.stderr).toBe(1);
  expect(result.stderr).toContain('agents/one.md'); expect(result.stderr).toContain('agents/two.md');
  expect(snapshot(out)).toEqual(before);
}, 180_000);

test.concurrent('Output inside a skill folder', async () => {
  const top = fresh('inside-skill');
  writeFolder(join(top, 'skills'), kitFiles());
  const result = await build([catalogue, '--out', './skills/writer/site', '--date', DATE, '--skills', './skills'], { cwd: top });
  expect(result.status).toBe(2); expect(existsSync(join(top, 'skills', 'writer', 'site'))).toBe(false);
}, 60_000);

test.concurrent('Output in the agents folder', async () => {
  const top = fresh('agents-out');
  writeFolder(join(top, 'skills'), kitFiles());
  const result = await build([catalogue, '--out', './skills/agents/site', '--date', DATE, '--skills', './skills'], { cwd: top });
  expect(result.status).toBe(2); expect(existsSync(join(top, 'skills', 'agents', 'site'))).toBe(false);
}, 60_000);

test.concurrent('Output contains the skills folder', async () => {
  const top = fresh('contains');
  mkdirSync(join(top, 'public'), { recursive: true });
  writeFolder(join(top, 'public', 'skills'), kitFiles());
  const before = snapshot(join(top, 'public'));
  const result = await build([catalogue, '--out', './public', '--date', DATE, '--skills', './public/skills'], { cwd: top });
  expect(result.status).toBe(2); expect(snapshot(join(top, 'public'))).toEqual(before);
}, 60_000);

test.concurrent('Output holds a linked input', async () => {
  const top = fresh('linked-input');
  const out = join(top, 'public');
  expect((await build([catalogue, '--out', out, '--date', DATE])).status).toBe(0);
  writeFileSync(join(out, 'full', 'notes.md'), '# Notes\n');
  writeFolder(join(top, 'skills'), { 'writer/SKILL.md': skill('writer') });
  symlinkSync(join(out, 'full', 'notes.md'), join(top, 'skills', 'writer', 'rules.md'));
  const result = await build([catalogue, '--out', 'public', '--date', DATE, '--skills', 'skills'], { cwd: top });
  expect(result.status).toBe(2); expect(readFileSync(join(out, 'full', 'notes.md'), 'utf8')).toBe('# Notes\n');
}, 180_000);

test.concurrent('Building inside the skills repository', async () => {
  const repo = writeFolder(fresh('repo'), { ...kitFiles(), ...Object.fromEntries(Object.entries(catalogueFiles()).map(([file, text]) => [`catalog/${file}`, text])) });
  const result = await build(['catalog', '--skills', '.', '--out', 'public', '--date', DATE], { cwd: repo });
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(repo, 'public', 'full', 'skills', 'writer', 'index.html'))).toBe(true);
}, 180_000);

test.concurrent('Output inside a linked skill folder', async () => {
  const top = fresh('linked-skill');
  writeFolder(join(top, 'kit', 'skills', 'writer'), { 'SKILL.md': skill('writer') });
  mkdirSync(join(top, 'tool'));
  symlinkSync(join(top, 'kit', 'skills', 'writer'), join(top, 'tool', 'writer'));
  const result = await build([catalogue, '--out', 'kit/skills/writer/site', '--date', DATE, '--skills', 'tool'], { cwd: top });
  expect(result.status).toBe(2); expect(existsSync(join(top, 'kit', 'skills', 'writer', 'site'))).toBe(false);
}, 60_000);

test.concurrent('Skills problems', async () => {
  const set = writeFolder(fresh('problems'), { 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': '---\nname: editor\n---\n',
    'agents/reviewer.md': agent('reviewer', 'skills:\n  - ghost\n  - phantom\n') });
  const result = await build([catalogue, '--out', fresh('problems-out'), '--date', DATE, '--skills', set]);
  expect(result.status, result.stderr).toBe(0);
  expect(lines(result.stderr)).toContain('Skill set: 1 error, 2 warnings; run stackledger skills validate for details');
}, 180_000);

const unplaced = (name: string) => writeFolder(fresh('unplaced'), { [`${name === 'writer' ? 'writer' : 'w'}/SKILL.md`]: skill(name), 'editor/SKILL.md': skill('editor'),
  'stackledger-skills.yaml': `apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: skills\nspec:\n  stations:\n    "skill:editor": [0, 0]\n---\napiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: [${JSON.stringify(`skill:${name}`)}, "skill:editor"]\n` });

test.concurrent('Suggested skill position', async () => {
  const result = await build([catalogue, '--out', fresh('suggest-out'), '--date', DATE, '--skills', unplaced('writer')]);
  const report = lines(result.stderr);
  const heading = report.indexOf('Suggested positions for the skills map (MapLayout spec.stations in stackledger-skills.yaml):');
  expect(heading).toBeGreaterThan(-1); expect(report[heading + 1]).toMatch(/^ {4}skill:writer: \[\d+, \d+\]$/);
}, 180_000);

test.concurrent('Suggested position of a name that is not a file name', async () => {
  // A skill named Writer must sit in a folder named Writer (skill-source, Name and folder).
  const set = writeFolder(fresh('upper'), { 'Writer/SKILL.md': skill('Writer'), 'editor/SKILL.md': skill('editor'),
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: skills\nspec:\n  stations:\n    "skill:editor": [0, 0]\n---\napiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["skill:Writer", "skill:editor"]\n' });
  const result = await build([catalogue, '--out', fresh('upper-out'), '--date', DATE, '--skills', set]);
  expect(result.stderr).toMatch(/^ {4}skill:Writer: \[\d+, \d+\]$/m);
  expect(result.stderr).not.toContain('_5772');
}, 180_000);

test.concurrent('Control character in a suggested name', async () => {
  const set = writeFolder(fresh('control'), { 'agents/esc.md': '---\nname: "re\\u001bviewer"\ndescription: Escape.\n---\n', 'editor/SKILL.md': skill('editor'),
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["agent:re\\u001bviewer", "skill:editor"]\n' });
  const result = await build([catalogue, '--out', fresh('control-out'), '--date', DATE, '--skills', set]);
  expect(result.stderr).toMatch(/agent:reviewer: \[/);
  expect(result.stderr).not.toContain('\u001b');
}, 180_000);

const permission = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout;
const sandboxSupported = /\s--permission\b/.test(permission) && permission.includes('--allow-addons');
test.concurrent('Sandboxed build', async context => {
  if (!sandboxSupported) { context.skip('This Node version has no stable --permission flag with --allow-addons'); return; }
  const out = fresh('sandbox-out');
  mkdirSync(out);
  const before = snapshot(kit);
  const flags = ['--permission', `--allow-fs-read=${catalogue}`, `--allow-fs-read=${kit}`, `--allow-fs-read=${root}`, `--allow-fs-read=${out}`, `--allow-fs-write=${out}`,
    '--allow-addons', '--allow-child-process', '--allow-worker'];
  const home = fresh('home');
  const result = await build([catalogue, '--out', out, '--date', DATE, '--skills', kit], { flags, env: { HOME: home, TMPDIR: home } });
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(home)).toBe(false); expect(snapshot(kit)).toEqual(before);
  expect(snapshot(out)).toEqual(snapshot(withSkills.out));
}, 180_000);

// Skill folder errors: every exit-2 check before any exit-1 check. A staging folder left with old/ is
// exit 1, so an output inside a skill folder that holds one must still be refused with exit 2.
test.concurrent('Output inside a skill folder, with a staging folder left behind', async () => {
  const top = fresh('order');
  writeFolder(join(top, 'skills'), { ...kitFiles(), 'writer/site/.stackledger-tmp-0123456789abcdef/old/full/index.html': 'old\n' });
  const result = await build([catalogue, '--out', './skills/writer/site', '--date', DATE, '--skills', './skills'], { cwd: top });
  expect(result.status, result.stderr).toBe(2);
}, 60_000);

test.concurrent('Output in the agents folder, in another case', async () => {
  // No agents folder yet: `Agents/site` is still refused, as `skills map` refuses it (APFS and NTFS ignore case).
  const top = fresh('agents-case');
  writeFolder(join(top, 'skills'), { 'writer/SKILL.md': skill('writer') });
  const result = await build([catalogue, '--out', './skills/Agents/site', '--date', DATE, '--skills', './skills'], { cwd: top });
  expect(result.status).toBe(2); expect(existsSync(join(top, 'skills', 'Agents'))).toBe(false);
}, 60_000);
