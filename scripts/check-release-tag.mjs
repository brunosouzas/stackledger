#!/usr/bin/env node
/** The first step of a release: is this tag allowed to publish a version?
 *
 * Why: a pushed tag starts .github/workflows/release.yml. Only a tag v<major>.<minor>.<patch> (digits,
 * no pre-release suffix) that equals "v" plus the package.json version, on a commit already on
 * origin/main (merged and reviewed), may go on. Anything else stops the release before it builds.
 *
 * Run from the repository root, after a checkout with the full history (fetch-depth: 0):
 *   node scripts/check-release-tag.mjs "$GITHUB_REF_NAME"
 * Exit 0: the tag may be released. Exit 1: one line on stderr says why not. Git must be on PATH;
 * a Git failure other than "not an ancestor" also exits 1, with Git's message.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHAPE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function fail(message) {
  process.stderr.write(`release tag: ${message}\n`);
  process.exit(1);
}

function git(...args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

const tag = process.argv[2] ?? '';
if (!SHAPE.test(tag)) fail(`the tag must be v<major>.<minor>.<patch>, digits only, got ${JSON.stringify(tag)}`);

let version;
try {
  ({ version } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')));
} catch (error) {
  fail(`cannot read the version from package.json: ${error.message}`);
}
if (`v${version}` !== tag) fail(`tag ${tag} does not match package.json version ${version}`);

const commit = git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`);
if (commit.status !== 0) fail(`tag ${tag} does not name a commit in this checkout`);
const sha = commit.stdout.trim();

// --is-ancestor exits 0 when the commit is on origin/main, 1 when it is not, anything else on error.
const merged = git('merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main');
if (merged.status === 1) fail(`the tag must be on main: commit ${sha} of ${tag} is not on origin/main`);
if (merged.status !== 0) fail(`cannot check that ${tag} is on origin/main: ${merged.stderr.trim() || 'git failed'}`);
