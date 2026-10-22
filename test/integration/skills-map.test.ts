/** `stackledger skills map` on the built CLI (skills-map-command spec: input, usage, the folders it
 * refuses, the owned entries, writing without following links, the identity re-check, determinism,
 * `--check` and exit codes). Run npm run build && npm test. Fictitious Northwind skill sets only, in
 * temporary folders; the Folder swapped, Kind folder appears as a link and Page that cannot be read
 * tests run test/integration/skills-map-with-faults.mjs. Stray spelling on a case-insensitive disk runs
 * only on such a disk (the macOS default); the case-sensitive part of Hard-linked page only on a
 * case-sensitive one (Linux; set TMPDIR to a case-sensitive volume to run it on macOS); the unreadable
 * page of Page that cannot be read only when not run as root.
 */
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/** True when the temporary folder's disk finds `a` under the name `A` (APFS and NTFS by default). */
const caseInsensitive = (() => {
  const probe = mkdtempSync(join(tmpdir(), 'stackledger-case-'));
  try { writeFileSync(join(probe, 'a'), ''); return existsSync(join(probe, 'A')); } finally { rmSync(probe, { recursive: true, force: true }); }
})();
/** Root ignores file modes, so an unreadable page cannot be made. */
const asRoot = process.getuid?.() === 0;
const withFaults = (plan: object, args: string[], cwd: string) =>
  spawnSync(process.execPath, [faults, JSON.stringify(plan), ...args], { cwd, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });

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
  // Names are compared ignoring case, as a case-insensitive disk (or a tool) would read them.
  for (const out of ['repo/agents', 'repo/AGENTS', 'repo/Agents/map']) {
    const result = run(['skills', 'map', 'repo', '--out', out], root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('agents folder');
  }
  expect(snapshot(root)).toEqual(before);
});

test('Output in a tool folder', () => {
  const root = skillSet({ ...repository(), 'home/.claude/skills/helper/SKILL.md': skill('helper') });
  const repo = join(root, 'repo');
  const before = snapshot(root);
  for (const args of [['--out', '.claude/commands/map'], ['--out', 'OpenSpec/specs/map'], ['.', '../home/.claude', '--out', '../home/.claude/commands/map']]) {
    const result = run(['skills', 'map', ...args], repo);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('tool folders load Markdown as instructions');
  }
  expect(snapshot(root)).toEqual(before);
});

test('Output holds a linked source file', () => {
  // A SKILL.md, then a .stackledgerignore, that links to a file the map folder owns (a stale page).
  const sources = [
    { 'map/skills/input.md': skill('writer'), 'repo/skills/writer/SKILL.md': link('map/skills/input.md') },
    { 'map/skills/input.md': 'templates/\n', 'repo/.stackledgerignore': link('map/skills/input.md'), 'repo/skills/writer/SKILL.md': skill('writer') },
  ];
  for (const files of sources) {
    const root = skillSet({ 'map/.stackledger-skills-map': MARKER[1], ...files });
    const before = snapshot(root);
    const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('must not hold a skill folder or agent file of the set, or a file the set was read from');
    expect(snapshot(root)).toEqual(before);
    expect(readFileSync(join(root, 'map', 'skills', 'input.md'), 'utf8')).toBe(files['map/skills/input.md']);
  }
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
  // A temporary file an interrupted run left at the top is owned too.
  writeFileSync(join(map, '.stackledger-skills-map-1.tmp'), '# partial\n');
  const check = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(check.status).toBe(1);
  expect(check.stderr).toBe('remove .stackledger-skills-map-1.tmp\nremove skills/old.md\nremove skills/scratch/\n'
    + 'The skills map in map is out of date: run stackledger skills map without --check\n');
  const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('0 created, 0 updated, 3 removed');
  expect(existsSync(join(map, '.stackledger-skills-map-1.tmp'))).toBe(false);
  expect(existsSync(join(map, 'skills', 'old.md'))).toBe(false);
  expect(existsSync(join(map, 'skills', 'scratch'))).toBe(false);
  expect(existsSync(join(map, 'skills', 'writer.md'))).toBe(true);
});

test.runIf(caseInsensitive)('Stray spelling on a case-insensitive disk', () => {
  // The stray spelling with the current page (no write was scheduled before), then with an old one.
  for (const stale of [false, true]) {
    const root = skillSet(repository());
    const map = writtenMap(root);
    const skills = join(map, 'skills');
    const expected = readFileSync(join(skills, 'writer.md'), 'utf8');
    renameSync(join(skills, 'writer.md'), join(skills, 'Writer.md'));
    if (stale) writeFileSync(join(skills, 'Writer.md'), '# Writer\n');
    expect(readdirSync(skills)).toContain('Writer.md');
    const check = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('remove skills/Writer.md\n');
    expect(check.stderr).toContain('create skills/writer.md\n');
    const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
    expect(result.status).toBe(0);
    expect(readdirSync(skills).sort()).toEqual(['editor.md', 'writer.md']);
    expect(readFileSync(join(skills, 'writer.md'), 'utf8')).toBe(expected);
    expect(run(['skills', 'map', 'repo', '--out', 'map', '--check'], root).status).toBe(0);
  }
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
  // On a case-sensitive disk, skills/Writer.md hard-linked to the page is a separate entry, so it is
  // removed and the page kept. A case-insensitive disk (the macOS default) cannot hold both names.
  if (caseInsensitive) return;
  linkSync(page, join(map, 'skills', 'Writer.md'));
  const check = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(check.stderr).toBe('remove skills/Writer.md\nThe skills map in map is out of date: run stackledger skills map without --check\n');
  expect(run(['skills', 'map', 'repo', '--out', 'map'], root).status).toBe(0);
  expect(readdirSync(join(map, 'skills')).sort()).toEqual(['editor.md', 'writer.md']);
  expect(readFileSync(page, 'utf8')).toContain('Writes Northwind release notes.');
  expect(run(['skills', 'map', 'repo', '--out', 'map', '--check'], root).status).toBe(0);
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
  const result = withFaults(plan, ['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain(`the output folder ${map} was moved or replaced during the run`);
  // The original map is now at map-moved and the other folder at map: neither changed.
  expect(snapshot(`${map}-moved`, true)).toEqual(mapBefore);
  expect(snapshot(map, true)).toEqual(otherBefore);
  // An entry that vanishes while it is compared (the marker's second read) is the folder changing too: exit 1, no usage text.
  const moved = `${map}-moved`;
  const vanished = withFaults({ out: moved, fail: [{ op: 'readFile', nth: 2, code: 'ENOENT' }] }, ['skills', 'map', 'repo', '--out', 'map-moved'], root);
  expect(vanished.status).toBe(1);
  expect(vanished.stderr).toBe(`stackledger skills map: the output folder ${moved} changed (.stackledger-skills-map vanished) during the run; stopped before changing anything more\n`);
  expect(snapshot(moved, true)).toEqual(mapBefore);

  // A swap later than the first check: right after the page was inspected, and right after its
  // temporary file was created. The replacement holds a page at the same path, which a write through
  // the swap would change.
  for (const after of [{ op: 'lstat', path: 'skills/editor.md', nth: 2 }, { op: 'writeNew', nth: 1 }]) {
    const base = realpathSync(skillSet({ ...repository(), 'other/skills/editor.md': 'Northwind other page.\n' }));
    const out = writtenMap(base);
    writeFileSync(join(base, 'repo/skills/editor/SKILL.md'), skill('editor', { description: 'Edits Northwind drafts.' }));
    const replacement = snapshot(join(base, 'other'), true);
    const swap = { to: join(base, 'other'), kind: 'folder', after: { ...after, ...(after.path ? { path: join(out, after.path) } : {}) } };
    const late = withFaults({ out, swap }, ['skills', 'map', 'repo', '--out', 'map'], base);
    expect(late.status).toBe(1);
    expect(late.stderr).toBe(`stackledger skills map: the output folder ${out} was moved or replaced during the run; stopped before changing anything more\n`);
    expect(snapshot(out, true)).toEqual(replacement);
  }

  // A folder that vanishes after the writes started is the folder changing too: the map folder just
  // created (its identity read), and a kind folder listed for the cleanup.
  // (lstat calls on a new map folder: resolving it, the check, the re-check before mkdir, the identity.)
  const fresh = join(root, 'fresh');
  const created = withFaults({ out: fresh, fail: [{ op: 'lstat', path: fresh, nth: 4, code: 'ENOENT' }] }, ['skills', 'map', 'repo', '--out', 'fresh'], root);
  expect(created.status).toBe(1);
  expect(created.stderr).toBe(`stackledger skills map: the output folder ${fresh} changed (. vanished) during the run; stopped before changing anything more\n`);
  // (readdir calls on skills/: the comparison, then the cleanup.)
  const cleanup = withFaults({ out: moved, fail: [{ op: 'readdir', path: join(moved, 'skills'), nth: 2, code: 'ENOENT' }] }, ['skills', 'map', 'repo', '--out', 'map-moved'], root);
  expect(cleanup.status).toBe(1);
  expect(cleanup.stderr).toBe(`stackledger skills map: the folder skills of the output folder ${join(moved, 'skills')} changed (skills/ vanished) during the run; stopped before changing anything more\n`);
}, 60_000);

test('Kind folder appears as a link', () => {
  const root = realpathSync(skillSet({ ...repository(), 'elsewhere/notes.md': 'Northwind elsewhere.\n' }));
  const map = writtenMap(root);
  // skills/ is absent at the check; a link named skills appears before the first write.
  rmSync(join(map, 'skills'), { recursive: true });
  const elsewhereBefore = snapshot(join(root, 'elsewhere'), true);
  const plan = { out: map, appear: { path: join(map, 'skills'), to: join(root, 'elsewhere'), atCheck: 2 } };
  const result = withFaults(plan, ['skills', 'map', 'repo', '--out', 'map'], root);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe(`stackledger skills map: the folder skills of the output folder ${join(map, 'skills')} appeared during the run; stopped before changing anything more\n`);
  expect(snapshot(join(root, 'elsewhere'), true)).toEqual(elsewhereBefore);
});

test('Page that cannot be read', () => {
  const root = realpathSync(skillSet(repository()));
  const map = writtenMap(root);
  const page = join(map, 'skills', 'writer.md');
  writeFileSync(join(root, 'repo/skills/writer/SKILL.md'), skill('writer', { description: 'Writes Northwind release notes.' }));
  // Root ignores file modes, so an unreadable page cannot be made there.
  if (!asRoot) {
    chmodSync(page, 0o000);
    const check = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('update skills/writer.md\n');
    const result = run(['skills', 'map', 'repo', '--out', 'map'], root);
    expect(result).toEqual({ status: 0, stdout: '', stderr: 'Wrote the skills map in map: 0 created, 1 updated, 0 removed\n' });
    expect(readFileSync(page, 'utf8')).toContain('Writes Northwind release notes.');
    writeFileSync(join(root, 'repo/skills/writer/SKILL.md'), skill('writer', { description: 'Writes Northwind notes.' }));
  }
  // A read that fails once the writes started (the cleanup's listing of skills/, the identity of a
  // folder just created) is exit 1 naming the path, never a usage error.
  const cleanup = withFaults({ out: map, fail: [{ op: 'readdir', path: join(map, 'skills'), nth: 2 }] }, ['skills', 'map', 'repo', '--out', 'map'], root);
  expect(cleanup).toMatchObject({ status: 1, stdout: '', stderr: 'stackledger skills map: cannot read skills/ in the output folder (EIO)\n' });
  const fresh = join(root, 'fresh');
  const created = withFaults({ out: fresh, fail: [{ op: 'lstat', path: fresh, nth: 4 }] }, ['skills', 'map', 'repo', '--out', 'fresh'], root);
  expect(created).toMatchObject({ status: 1, stdout: '', stderr: 'stackledger skills map: cannot read . in the output folder (EIO)\n' });
}, 60_000);

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
  // The marker and .gitattributes too: a CRLF marker is a valid one.
  for (const file of [...pageFiles(map), MARKER[0], '.gitattributes']) {
    const path = join(map, file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\n', '\r\n'));
  }
  const result = run(['skills', 'map', 'repo', '--out', 'map', '--check'], root);
  expect(result).toEqual({ status: 0, stdout: '', stderr: 'The skills map in map is up to date\n' });
  // A run accepts the folder and writes the files back with LF.
  expect(run(['skills', 'map', 'repo', '--out', 'map'], root).status).toBe(0);
  expect(readFileSync(join(map, MARKER[0]), 'utf8')).toBe(MARKER[1]);
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
