/** `stackledger skills map` on the built CLI (skills-map-command spec: input, usage, the folders it
 * refuses, the owned entries, writing without following links, the identity re-check, determinism,
 * `--check` and exit codes). Run npm run build && npm test. Fictitious Northwind skill sets only, in
 * temporary folders; the Folder swapped test runs test/integration/skills-map-with-faults.mjs.
 */
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './helpers.js';
import { agent, link, playbook, rules, skill, skillSet } from '../skills-helpers.js';

const USAGE_LINE = 'stackledger skills map [folder...] --out <folder> [--check]';
const MARKER = ['.stackledger-skills-map', 'stackledger skills map\n'] as const;
const faults = fileURLToPath(new URL('./skills-map-with-faults.mjs', import.meta.url));

// Node 22.12 only knows --experimental-permission; Node 26 only --permission; 22.13 to 24 accept both.
const nodeHelp = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout;
const permissionFlag = /\s--permission\b/.test(nodeHelp) ? '--permission' : '--experimental-permission';

/** Every entry below `root`: files with their text (and, with `identity`, inode and modification
 * time), links with their target, folders as such. */
function snapshot(root: string, identity = false): Record<string, string> {
  const entries: Record<string, string> = {};
  const walk = (path: string, prefix: string) => {
    for (const name of readdirSync(path).sort()) {
      const absolute = join(path, name), relative = prefix + name;
      const stats = lstatSync(absolute);
      if (stats.isSymbolicLink()) entries[relative] = `link ${readlinkSync(absolute)}`;
      else if (stats.isDirectory()) { entries[`${relative}/`] = 'folder'; walk(absolute, `${relative}/`); }
      else entries[relative] = `file ${readFileSync(absolute, 'utf8')}${identity ? ` ${stats.ino} ${stats.mtimeMs}` : ''}`;
    }
  };
  walk(root, '');
  return entries;
}
/** A repository with a playbook, two skills (one with rules) and an agent. */
const repository = (prefix = 'repo/') => ({
  [`${prefix}skills/release/SKILL.md`]: playbook('release', 'writer', 'reviewer'),
  [`${prefix}skills/writer/SKILL.md`]: skill('writer'),
  [`${prefix}skills/writer/rules.md`]: rules('- **WR-1** Write short.'),
  [`${prefix}skills/editor/SKILL.md`]: skill('editor'),
  [`${prefix}agents/reviewer.md`]: agent('reviewer', 'skills: [editor]\n'),
});
/** A marked map folder at `map` below `root`, written by a first run over `repo`. */
function writtenMap(root: string, folders = ['repo'], out = 'map'): string {
  const result = run(['skills', 'map', ...folders, '--out', out], root);
  expect(result.status).toBe(0);
  return join(root, out);
}
const pageFiles = (map: string) => Object.keys(snapshot(map)).filter(path => path.endsWith('.md'));

test('Missing out', () => {
  const root = skillSet(repository());
  const before = snapshot(root);
  for (const args of [['skills', 'map', 'repo'], ['skills', 'map', 'repo', '--check'], ['skills', 'map', 'repo', '--out', '']]) {
    const result = run(args, root);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--out is required');
    expect(result.stderr).toContain(USAGE_LINE);
  }
  expect(snapshot(root)).toEqual(before);
});

test('Out is a file', () => {
  const root = skillSet({ ...repository(), 'map.md': 'Northwind notes.\n' });
  const result = run(['skills', 'map', 'repo', '--out', 'map.md'], root);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Output path is not a folder');
  expect(readFileSync(join(root, 'map.md'), 'utf8')).toBe('Northwind notes.\n');
});

test('Same set as validate', () => {
  const root = skillSet({ 'repo/.stackledgerignore': 'templates/\n', 'repo/skills/writer/SKILL.md': skill('writer'), 'repo/templates/starter/SKILL.md': skill('starter'),
    'tool/skills/writer': link('repo/skills/writer'), 'tool/skills/writer2/SKILL.md': skill('writer') });
  const result = run(['skills', 'map', 'repo', 'tool', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
  expect(pageFiles(join(root, 'map'))).toEqual(['README.md', 'skills/writer.md']);
  expect(readFileSync(join(root, 'map', 'skills', 'writer.md'), 'utf8')).toContain('- [repo/skills/writer/SKILL.md](../../repo/skills/writer/SKILL.md)');
  // The duplicate under tool is the error validate reports, counted in the index.
  expect(readFileSync(join(root, 'map', 'README.md'), 'utf8')).toContain('- Errors: 1\n');
  expect(run(['skills', 'validate', 'repo', 'tool'], root).stdout).toContain('skills: 1, playbooks: 0, agents: 0, rules: 0, ignored: 1, errors: 1');
});

test('Help', () => {
  const result = run(['skills', 'map', '--help', '--bogus']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(USAGE_LINE);
  expect(result.stderr).toBe('');
  expect(run(['--help']).stdout).toContain(USAGE_LINE);
});

test('Output is the given folder', () => {
  const root = skillSet(repository());
  const before = snapshot(root);
  const result = run(['skills', 'map', 'repo', '--out', 'repo'], root);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('must not be a given folder');
  expect(snapshot(root)).toEqual(before);
});

test('Output holds a linked source', () => {
  const root = skillSet({ 'repo/map/.stackledger-skills-map': MARKER[1], 'repo/map/skills/writer/SKILL.md': skill('writer'), 'repo/map/skills/old.md': '# old\n',
    'tool/skills/writer': link('repo/map/skills/writer') });
  const before = snapshot(root);
  const result = run(['skills', 'map', 'tool', '--out', 'repo/map'], root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('must not hold a skill folder or agent file of the set');
  expect(snapshot(root)).toEqual(before);
});

test('Output inside a skill folder', () => {
  const root = skillSet(repository());
  const result = run(['skills', 'map', 'repo', '--out', 'repo/skills/writer/map'], root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('must not be inside a skill folder of the set');
  expect(existsSync(join(root, 'repo/skills/writer/map'))).toBe(false);
});

test('Output in the agents folder', () => {
  const root = skillSet(repository());
  const before = snapshot(root);
  const result = run(['skills', 'map', 'repo', '--out', 'repo/agents'], root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('agents folder');
  expect(snapshot(root)).toEqual(before);
});

test('Output in a tool folder', () => {
  const root = skillSet(repository(''));
  for (const out of ['.claude/commands/map', 'openspec/specs/map']) {
    const result = run(['skills', 'map', '--out', out], root);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('tool folders load Markdown as instructions');
  }
  expect(existsSync(join(root, '.claude'))).toBe(false);
  expect(existsSync(join(root, 'openspec'))).toBe(false);
});

test('Output inside the given folder', () => {
  const root = skillSet(repository());
  const repo = join(root, 'repo');
  const result = run(['skills', 'map', '.', '--out', 'docs/skills-map'], repo);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('Wrote the skills map in docs/skills-map: 7 created, 0 updated, 0 removed\n');
  const map = join(repo, 'docs', 'skills-map');
  expect(readFileSync(join(map, '.stackledger-skills-map'), 'utf8')).toBe(MARKER[1]);
  expect(readFileSync(join(map, '.gitattributes'), 'utf8')).toBe('* text eol=lf\n');
  expect(pageFiles(map)).toEqual(['README.md', 'agents/reviewer.md', 'playbooks/release.md', 'skills/editor.md', 'skills/writer.md']);
});

test('Unrelated non-empty folder', () => {
  const root = skillSet({ ...repository(), 'map/notes.md': 'Northwind notes.\n' });
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('was not written by stackledger skills map');
  expect(snapshot(join(root, 'map'))).toEqual({ 'notes.md': 'file Northwind notes.\n' });
});

test('Marker that is not valid', () => {
  for (const marker of ['folder', 'link', 'text']) {
    const root = skillSet({ ...repository(), 'map/README.md': '# Northwind map\n', 'elsewhere.txt': MARKER[1] });
    const path = join(root, 'map', MARKER[0]);
    if (marker === 'folder') mkdirSync(path);
    else if (marker === 'link') symlinkSync(join(root, 'elsewhere.txt'), path);
    else writeFileSync(path, 'stackledger build\n');
    const before = snapshot(root);
    const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
    expect(result.status).toBe(2);
    expect(snapshot(root)).toEqual(before);
  }
});

test('Other files kept', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  writeFileSync(join(map, 'notes.txt'), 'Northwind notes.\n');
  writeFileSync(join(root, 'repo/skills/editor/SKILL.md'), skill('editor', { description: 'Edits Northwind drafts.' }));
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('0 created, 1 updated, 0 removed');
  expect(readFileSync(join(map, 'notes.txt'), 'utf8')).toBe('Northwind notes.\n');
});

test('Removed skill', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  writeFileSync(join(map, 'skills', 'old.md'), '# old\n');
  mkdirSync(join(map, 'skills', 'scratch'));
  writeFileSync(join(map, 'skills', 'scratch', 'x.md'), '# x\n');
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('0 created, 0 updated, 2 removed');
  expect(existsSync(join(map, 'skills', 'old.md'))).toBe(false);
  expect(existsSync(join(map, 'skills', 'scratch'))).toBe(false);
  expect(existsSync(join(map, 'skills', 'writer.md'))).toBe(true);
});

test('Linked kind folder', () => {
  const root = skillSet({ ...repository(), 'map/.stackledger-skills-map': MARKER[1], 'elsewhere/old.md': '# Northwind\n', 'map/skills': link('elsewhere') });
  const before = snapshot(root);
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('Output folder entry skills is a symbolic link');
  expect(snapshot(root)).toEqual(before);
});

test('Linked page', () => {
  const root = skillSet({ ...repository(), 'outside.md': 'Northwind outside.\n' });
  const map = writtenMap(root);
  const page = join(map, 'skills', 'writer.md');
  const expected = readFileSync(page, 'utf8');
  // Replace the page by a link to the outside file.
  unlinkSync(page);
  symlinkSync(join(root, 'outside.md'), page);
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(readFileSync(join(root, 'outside.md'), 'utf8')).toBe('Northwind outside.\n');
  expect(lstatSync(page).isFile()).toBe(true);
  expect(readFileSync(page, 'utf8')).toBe(expected);
});

test('Hard-linked page', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  const page = join(map, 'skills', 'writer.md');
  const outside = join(root, 'outside.md');
  linkSync(page, outside);
  const before = readFileSync(outside, 'utf8');
  writeFileSync(join(root, 'repo/skills/writer/SKILL.md'), skill('writer', { description: 'Writes Northwind release notes.' }));
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(readFileSync(page, 'utf8')).toContain('Writes Northwind release notes.');
  expect(readFileSync(outside, 'utf8')).toBe(before);
});

test('Writes stay in the map folder', () => {
  const root = realpathSync(skillSet(repository()));
  // The map folder exists and is empty, so the only writes allowed are inside it.
  const map = join(root, 'map');
  mkdirSync(map);
  const flags = ['--no-warnings', permissionFlag, '--allow-fs-read=*', `--allow-fs-write=${map}`];
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root, flags);
  expect(result.stderr).toContain('7 created');
  expect(result.status).toBe(0);
  expect(pageFiles(map)).toHaveLength(5);
  // The same flags really deny a write outside the map folder.
  const target = join(root, 'repo', 'written');
  const probe = spawnSync(process.execPath, [...flags, '-e', 'require("node:fs").writeFileSync(process.argv[1], "x")', target], { encoding: 'utf8' });
  expect(probe.stderr).toContain('ERR_ACCESS_DENIED');
  expect(existsSync(target)).toBe(false);
}, 60_000);

test('Folder swapped', () => {
  const root = realpathSync(skillSet({ ...repository(), 'other/notes.md': 'Northwind other folder.\n' }));
  const map = writtenMap(root);
  // A change to write, so the run reaches its first change.
  writeFileSync(join(root, 'repo/skills/editor/SKILL.md'), skill('editor', { description: 'Edits Northwind drafts.' }));
  const mapBefore = snapshot(map, true), otherBefore = snapshot(join(root, 'other'), true);
  const plan = { out: map, swap: { to: join(root, 'other'), kind: 'folder', atCheck: 2 } };
  const result = spawnSync(process.execPath, [faults, JSON.stringify(plan), 'skills', 'map', 'repo', '--out', 'map'], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain(`the output folder ${map} was moved or replaced during the run`);
  // The original map is now at map-moved and the other folder at map: neither changed.
  expect(snapshot(`${map}-moved`, true)).toEqual(mapBefore);
  expect(snapshot(map, true)).toEqual(otherBefore);
});

test('Two runs', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  const before = snapshot(map, true);
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result).toEqual({ status: 0, stdout: '', stderr: 'The skills map in map is up to date; nothing changed\n' });
  expect(snapshot(map, true)).toEqual(before);
});

test('Checkout with CRLF', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  for (const page of pageFiles(map)) {
    const path = join(map, page);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\n', '\r\n'));
  }
  const result = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(result).toEqual({ status: 0, stdout: '', stderr: 'The skills map in map is up to date\n' });
});

test('Stale map in a pipeline', () => {
  const root = skillSet(repository());
  const map = writtenMap(root);
  writeFileSync(join(root, 'repo/skills/writer/SKILL.md'), skill('writer', { metadata: { 'stackledger-skills': 'editor' } }));
  const before = snapshot(map, true);
  const result = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('update README.md\nupdate skills/editor.md\nupdate skills/writer.md\n'
    + 'The skills map in map is out of date: run stackledger skills map without --check\n');
  expect(snapshot(map, true)).toEqual(before);
  // A missing map folder is out of date too, and is not created.
  const missing = run(['skills', 'map', 'repo', '--out', 'absent', '--check'], root);
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain('create .stackledger-skills-map\n');
  expect(existsSync(join(root, 'absent'))).toBe(false);
});

test('Up to date', () => {
  const root = skillSet(repository());
  writtenMap(root);
  const result = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(result).toEqual({ status: 0, stdout: '', stderr: 'The skills map in map is up to date\n' });
});

test('Set with errors', () => {
  const root = skillSet({ ...repository(), 'repo/skills/linting/SKILL.md': '---\nname: linting\n---\n' });
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('Wrote the skills map in map: 7 created, 0 updated, 0 removed\n'
    + 'stackledger skills map: 1 error, 0 warnings; run stackledger skills validate for details\n');
  expect(existsSync(join(root, 'map', 'skills', 'linting.md'))).toBe(false);
  expect(existsSync(join(root, 'map', 'skills', 'writer.md'))).toBe(true);
});

test('Wrong folder does not empty the map', () => {
  const root = skillSet({ ...repository(), 'empty/notes.txt': 'Northwind notes.\n' });
  const map = writtenMap(root);
  const before = snapshot(map, true);
  for (const args of [['skills', 'map', 'empty', '--out', 'map'], ['skills', 'map', 'repo', 'empty', '--out', 'map']]) {
    const result = run(args, root);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('stackledger skills map: empty: No skill folder or agent file found in this folder; the map in map is not changed\n');
  }
  expect(snapshot(map, true)).toEqual(before);
});
