/** scripts/check-release-tag.mjs, the first step of a release (package-release spec, Release tags).
 * Run npm test. Each case builds a small Git repository in a temporary folder, with a package.json
 * and a fake origin/main, and runs the script there as the release workflow does.
 */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folder } from '../helpers.js';

const script = fileURLToPath(new URL('../../scripts/check-release-tag.mjs', import.meta.url));
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Northwind Release', GIT_AUTHOR_EMAIL: 'release@example.com',
  GIT_COMMITTER_NAME: 'Northwind Release', GIT_COMMITTER_EMAIL: 'release@example.com', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

/** A repository whose package.json says `version`; `merged` says whether the tag's commit is on origin/main. */
function repository(version: string, tag: string, merged: boolean): string {
  const cwd = folder();
  git(cwd, 'init', '-q', '-b', 'main');
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'stackledger', version }));
  git(cwd, 'add', 'package.json'); git(cwd, 'commit', '-qm', 'first');
  const first = git(cwd, 'rev-parse', 'HEAD');
  if (!merged) { writeFileSync(join(cwd, 'notes.txt'), 'unreviewed'); git(cwd, 'add', 'notes.txt'); git(cwd, 'commit', '-qm', 'unmerged'); }
  git(cwd, 'update-ref', 'refs/remotes/origin/main', first);
  git(cwd, 'tag', tag);
  return cwd;
}

function check(cwd: string, tag: string) {
  return spawnSync(process.execPath, [script, tag], { cwd, encoding: 'utf8', env: gitEnv });
}

test('A tag on main equal to the package version passes', () => {
  const result = check(repository('0.1.0', 'v0.1.0', true), 'v0.1.0');
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test('Tag and version differ: exit 1 with one line naming both values', () => {
  const result = check(repository('0.1.0', 'v0.2.0', true), 'v0.2.0');
  expect(result.status).toBe(1);
  const lines = result.stderr.trim().split('\n');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain('v0.2.0');
  expect(lines[0]).toContain('0.1.0');
});

test('Tag on an unmerged commit: exit 1 saying the tag must be on main', () => {
  const result = check(repository('0.1.0', 'v0.1.0', false), 'v0.1.0');
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/must be on main/);
});

test('Tag of another shape: exit 1 saying the tag must be v<major>.<minor>.<patch>', () => {
  for (const tag of ['v0.1.0-beta.1', 'vnotes', '0.1.0', 'v01.0.0', 'v0.1']) {
    const result = check(repository('0.1.0', tag, true), tag);
    expect(result.status, tag).toBe(1);
    expect(result.stderr, tag).toContain('v<major>.<minor>.<patch>');
  }
});

// From a push to main (package-release spec, Release tags, change release-on-merge): the tag does
// not exist yet and the commit is the pushed one.
function checkCommit(cwd: string, tag: string, commit: string) {
  return spawnSync(process.execPath, [script, tag, commit], { cwd, encoding: 'utf8', env: gitEnv });
}

test('From main before the tag exists: exit 0; a commit not on main exits 1', () => {
  const cwd = repository('0.1.0', 'v0.1.0', false);
  git(cwd, 'tag', '-d', 'v0.1.0');
  const main = git(cwd, 'rev-parse', 'refs/remotes/origin/main');
  const pass = checkCommit(cwd, 'v0.1.0', main);
  expect(pass.stderr).toBe('');
  expect(pass.status).toBe(0);
  const unmerged = checkCommit(cwd, 'v0.1.0', 'HEAD');
  expect(unmerged.status).toBe(1);
  expect(unmerged.stderr).toMatch(/must be on main/);
});

test('From main with the tag on another commit: exit 1 saying the tag already exists there', () => {
  const cwd = repository('0.1.0', 'v0.1.0', false);
  const main = git(cwd, 'rev-parse', 'refs/remotes/origin/main');
  git(cwd, 'tag', '-f', 'v0.1.0', 'HEAD');
  const other = git(cwd, 'rev-parse', 'HEAD');
  const result = checkCommit(cwd, 'v0.1.0', main);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`already exists on ${other}`);
});
