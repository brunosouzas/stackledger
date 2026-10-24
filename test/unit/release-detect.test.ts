/** scripts/release-detect.mjs, the first job of a release (package-release spec, Release on the version
 * merge, Detection errors). Run npm test. Each case builds a small Git repository in a temporary folder
 * and runs the script there as the release workflow does.
 */
import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folder } from '../helpers.js';

const script = fileURLToPath(new URL('../../scripts/release-detect.mjs', import.meta.url));
const zeros = '0000000000000000000000000000000000000000';
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Northwind Release', GIT_AUTHOR_EMAIL: 'release@example.com',
  GIT_COMMITTER_NAME: 'Northwind Release', GIT_COMMITTER_EMAIL: 'release@example.com', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

/** main: 0.1.0 (tagged), then 0.2.0 (the version pull request), then a README fix. */
function history() {
  const cwd = folder();
  git(cwd, 'init', '-q', '-b', 'main');
  const commit = (files: Record<string, string | null>, message: string) => {
    for (const [name, text] of Object.entries(files)) {
      if (text === null) rmSync(join(cwd, name), { force: true }); else writeFileSync(join(cwd, name), text);
    }
    git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', message);
    return git(cwd, 'rev-parse', 'HEAD');
  };
  const first = commit({ 'package.json': JSON.stringify({ name: 'stackledger', version: '0.1.0' }) }, '0.1.0');
  git(cwd, 'tag', 'v0.1.0');
  const bump = commit({ 'package.json': JSON.stringify({ name: 'stackledger', version: '0.2.0' }) }, '0.2.0');
  const readme = commit({ 'README.md': 'fix' }, 'readme');
  return { cwd, first, bump, readme, commit };
}

function detect(cwd: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: gitEnv });
  return { status: result.status, out: result.stdout, why: result.stderr };
}

describe('Release on the version merge', { timeout: 30_000 }, () => {
  test('The version merge releases', () => {
    const { cwd, first, bump } = history();
    const result = detect(cwd, 'branch', 'main', first, bump, 'false');
    expect(result).toMatchObject({ status: 0, out: 'release=true\ntag=v0.2.0\n' });
    expect(result.why.trim().split('\n')).toHaveLength(1);
  });

  test('A later merge with the same version', () => {
    const { cwd, bump, readme } = history();
    expect(detect(cwd, 'branch', 'main', bump, readme, 'false')).toMatchObject({ status: 0, out: 'release=false\ntag=v0.2.0\n' });
    git(cwd, 'tag', 'v0.2.0', bump);
    expect(detect(cwd, 'branch', 'main', bump, readme, 'false').out).toBe('release=false\ntag=v0.2.0\n');
  });

  test('Version whose tag exists', () => {
    const { cwd, first, bump } = history();
    git(cwd, 'tag', 'v0.2.0', bump);
    expect(detect(cwd, 'branch', 'main', first, bump, 'false').out).toBe('release=false\ntag=v0.2.0\n');
  });

  test('Several commits in one push', () => {
    const { cwd, first, readme } = history();
    expect(detect(cwd, 'branch', 'main', first, readme, 'false').out).toBe('release=true\ntag=v0.2.0\n');
  });

  test('Forced or rewritten main', () => {
    const { cwd, first, bump, readme } = history();
    expect(detect(cwd, 'branch', 'main', first, bump, 'true')).toMatchObject({ status: 0, out: 'release=false\ntag=\n' });
    git(cwd, 'switch', '-qc', 'rewrite', first);
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'stackledger', version: '0.3.0' }));
    git(cwd, 'commit', '-qam', '0.3.0 without a merge');
    const rewritten = git(cwd, 'rev-parse', 'HEAD');
    expect(detect(cwd, 'branch', 'main', readme, rewritten, 'false')).toMatchObject({ status: 0, out: 'release=false\ntag=\n' });
  });

  test('Pushed tag and other refs', () => {
    const { cwd, first, bump } = history();
    expect(detect(cwd, 'tag', 'v0.2.0', zeros, bump, 'false').out).toBe('release=true\ntag=v0.2.0\n');
    expect(detect(cwd, 'branch', 'ab172-x', first, bump, 'false').out).toBe('release=false\ntag=\n');
    expect(detect(cwd, 'branch', 'main', zeros, bump, 'false').out).toBe('release=false\ntag=\n');
    expect(detect(cwd, 'branch', 'main', 'f'.repeat(40), bump, 'false').out).toBe('release=false\ntag=\n');
  });
});

describe('Detection errors', { timeout: 30_000 }, () => {
  test('Unreadable version', () => {
    for (const manifest of [null, 'not json', JSON.stringify({ name: 'stackledger' })]) {
      const { cwd, bump, commit } = history();
      const broken = commit({ 'package.json': manifest }, 'broken');
      const result = detect(cwd, 'branch', 'main', bump, broken, 'false');
      expect(result.status, String(manifest)).toBe(1);
      expect(result.out, String(manifest)).toBe('');
      expect(result.why, String(manifest)).toContain(broken);
    }
  });

  test('Forced push wins over an unreadable version', () => {
    const { cwd, bump, commit } = history();
    const broken = commit({ 'package.json': null }, 'no manifest');
    expect(detect(cwd, 'branch', 'main', bump, broken, 'true')).toMatchObject({ status: 0, out: 'release=false\ntag=\n' });
  });

  test('Previous version missing or unreadable', () => {
    for (const [previous, status, out] of [[null, 0, 'release=true\ntag=v0.2.0\n'], [JSON.stringify({ name: 'x' }), 0, 'release=true\ntag=v0.2.0\n'], ['not json', 1, '']] as const) {
      const cwd = folder();
      git(cwd, 'init', '-q', '-b', 'main');
      writeFileSync(join(cwd, 'README.md'), 'start');
      if (previous !== null) writeFileSync(join(cwd, 'package.json'), previous);
      git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'before');
      const before = git(cwd, 'rev-parse', 'HEAD');
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'stackledger', version: '0.2.0' }));
      git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'after');
      const after = git(cwd, 'rev-parse', 'HEAD');
      expect(detect(cwd, 'branch', 'main', before, after, 'false'), String(previous)).toMatchObject({ status, out });
    }
  });

  test('Git fails', () => {
    const outside = folder();
    const result = detect(outside, 'branch', 'main', 'a'.repeat(40), 'b'.repeat(40), 'false');
    expect(result.status).toBe(1);
    expect(result.out).toBe('');
    expect(result.why).toMatch(/git/i);
  });

  test('Wrong arguments', () => {
    const { cwd } = history();
    const result = detect(cwd, 'branch', 'main');
    expect(result.status).toBe(1);
    expect(result.why).toMatch(/usage/);
  });
});
