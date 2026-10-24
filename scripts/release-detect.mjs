#!/usr/bin/env node
/** The first job of a release: does this push release a version, and which tag?
 *
 * Why: .github/workflows/release.yml runs on every push to main and on every pushed tag v*. Most
 * pushes to main release nothing. A push to main releases only when it moves main forward (a merge,
 * never a forced push), changes the `version` in package.json against the commit before the push,
 * and the tag v<version> does not exist yet. So a later merge (a README fix) never releases again,
 * even while the version still waits for the owner's approval. A pushed tag v* always goes on to the
 * tag check: that is how the owner releases by hand or retries (package-release spec, Release on the
 * version merge, Detection errors; the same flow as brunosouzas-design-system).
 *
 * Run from the repository root, after a checkout with the full history and the tags (fetch-depth: 0):
 *   node scripts/release-detect.mjs <ref-type> <ref-name> <before-sha> <after-sha> [<forced>]
 * (in the workflow: github.ref_type, github.ref_name, github.event.before, github.sha,
 * github.event.forced, all through env).
 * Prints `release=<true|false>` and `tag=<tag>` on stdout for $GITHUB_OUTPUT, and one line on stderr
 * that says why. Exit 0 in both cases; exit 1, with nothing on stdout, when it cannot tell.
 * The rules are applied in order, the first match winning (spec, Detection errors).
 */
import { spawnSync } from 'node:child_process';

function fail(message) {
  process.stderr.write(`release detect: ${message}\n`);
  process.exit(1);
}

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) fail(`cannot run git: ${result.error.message}`);
  return result;
}

function answer(release, tag, why) {
  process.stdout.write(`release=${release}\ntag=${tag}\n`);
  process.stderr.write(`release detect: ${why}\n`);
  process.exit(0);
}

/** The version in package.json at a commit: a string, `missing` (no file or no string version), or exit 1. */
function versionAt(sha, { strict }) {
  const listed = git('ls-tree', '--name-only', sha, '--', 'package.json');
  if (listed.status !== 0) fail(`cannot read ${sha}: ${listed.stderr.trim() || 'git failed'}`);
  if (listed.stdout.trim() === '') {
    if (strict) fail(`package.json is missing at ${sha}`);
    return 'missing';
  }
  const shown = git('show', `${sha}:package.json`);
  if (shown.status !== 0) fail(`cannot read package.json at ${sha}: ${shown.stderr.trim() || 'git failed'}`);
  let manifest;
  try {
    manifest = JSON.parse(shown.stdout);
  } catch {
    fail(`package.json at ${sha} is not JSON`);
  }
  if (typeof manifest?.version === 'string') return manifest.version;
  if (strict) fail(`package.json at ${sha} has no version`);
  return 'missing';
}

const [refType, refName, before, after, forced] = process.argv.slice(2);
if (!refType || !refName || before === undefined || !after) {
  fail('usage: release-detect.mjs <ref-type> <ref-name> <before-sha> <after-sha> [<forced>]');
}

if (refType === 'tag') answer(true, refName, `tag ${refName} pushed: the tag check decides`);
if (refType !== 'branch' || refName !== 'main') answer(false, '', `push to ${refType} ${refName}: nothing to release`);

// A Git failure must not look like a missing commit: check the repository first.
const inside = git('rev-parse', '--git-dir');
if (inside.status !== 0) fail(`not a Git checkout: ${inside.stderr.trim() || 'git failed'}`);

if (forced === 'true') answer(false, '', 'forced push to main: nothing to release (push the tag by hand to release)');

if (/^0+$/.test(before) || git('cat-file', '-e', `${before}^{commit}`).status !== 0) {
  answer(false, '', `no previous commit to compare with (${before || 'none'}): nothing to release`);
}

const forward = git('merge-base', '--is-ancestor', before, after);
if (forward.status === 1) answer(false, '', `main moved from ${before} to ${after} without a fast-forward: nothing to release`);
if (forward.status !== 0) fail(`cannot compare ${before} with ${after}: ${forward.stderr.trim() || 'git failed'}`);

const version = versionAt(after, { strict: true });
const tag = `v${version}`;
const previous = versionAt(before, { strict: false });
if (previous === version) answer(false, tag, `version ${version} unchanged by this push: nothing to release`);

const existing = git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`);
if (existing.status === 0) answer(false, tag, `tag ${tag} already exists: nothing to release`);
if (existing.status !== 1) fail(`cannot check whether ${tag} exists: ${existing.stderr.trim() || 'git failed'}`);

answer(true, tag, `version changed from ${previous} to ${version} and ${tag} does not exist: release ${tag}`);
