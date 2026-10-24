/** scripts/release-publish.sh, the publishing step of a release (package-release spec, Completing a
 * partial release). Run npm test. Fake `npm` and `gh` programs first on PATH record their arguments
 * and answer as each case needs; nothing reaches npm or GitHub.
 */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folder } from '../helpers.js';

const script = fileURLToPath(new URL('../../scripts/release-publish.sh', import.meta.url));
const integrity = 'sha512-bm9ydGh3aW5kIHBhY2thZ2UgYnl0ZXM=';

// Each fake appends one line per call to $FAKE_LOG and answers from FAKE_* variables.
const fakeNpm = `#!/bin/bash
echo "npm $*" >> "$FAKE_LOG"
case "$1" in
  view) printf '%s' "$FAKE_NPM_VIEW_STDOUT"; printf '%s' "$FAKE_NPM_VIEW_STDERR" >&2; exit "\${FAKE_NPM_VIEW_STATUS:-0}" ;;
  publish) exit 0 ;;
  *) echo "fake npm: unexpected call" >&2; exit 99 ;;
esac
`;
// gh keeps the tag and the release in files under $FAKE_STATE, so a later step sees what an earlier
// one created (change release-on-merge). git/refs POST answers 422 when the tag exists.
const fakeGh = `#!/bin/bash
echo "gh $*" >> "$FAKE_LOG"
case "$1 $2" in
  "release view") [ -f "$FAKE_STATE/release" ] && exit 0; printf '%s' "$FAKE_GH_VIEW_STDERR" >&2; exit "\${FAKE_GH_VIEW_STATUS:-0}" ;;
  "release create") touch "$FAKE_STATE/release"; exit 0 ;;
  "release upload") exit 0 ;;
esac
if [ "$1" = api ]; then
  if [ -n "$FAKE_GH_API_ERR" ]; then echo "$FAKE_GH_API_ERR" >&2; exit 1; fi
  case "$2" in */git/ref/tags/*) if [ -n "$FAKE_GH_REF_ERR" ]; then echo "$FAKE_GH_REF_ERR" >&2; exit 1; fi ;; esac
  case "$2" in */git/tags/*) if [ -n "$FAKE_GH_TAGOBJ_ERR" ]; then echo "$FAKE_GH_TAGOBJ_ERR" >&2; exit 1; fi; cat "$FAKE_STATE/annotated"; exit 0 ;; esac
  if [ "$2 $3" = "-X POST" ]; then
    [ -f "$FAKE_STATE/tag" ] && { echo "gh: Reference already exists (HTTP 422)" >&2; exit 1; }
    for a in "$@"; do case "$a" in sha=*) printf '%s' "\${a#sha=}" > "$FAKE_STATE/tag" ;; esac; done; exit 0
  fi
  [ -f "$FAKE_STATE/annotated" ] && { echo "tag tagobject1"; exit 0; }
  [ -f "$FAKE_STATE/tag" ] && { echo "commit $(cat "$FAKE_STATE/tag")"; exit 0; }
  echo "gh: Not Found (HTTP 404)" >&2; exit 1
fi
echo "fake gh: unexpected call" >&2; exit 99
`;

interface Answers { npmView: { status: number; stdout?: string; stderr?: string }; ghView?: { status: number; stderr?: string };
  /** From main: the commit to release (RELEASE_COMMIT), the tag already on GitHub, a GitHub API error. */
  commit?: string; tagOn?: string; apiError?: string;
  /** An annotated tag whose object points at this commit; failures of the ref and tag-object reads; the bash to run. */
  annotatedOn?: string; refError?: string; tagObjectError?: string; shell?: string }

function release(answers: Answers) {
  const work = folder({ 'bin/npm': fakeNpm, 'bin/gh': fakeGh, 'release/brunosouzas-stackledger-0.1.0.tgz': 'tarball bytes',
    'release/integrity': `${integrity}\n`, 'release/stackledger-0.1.0.cdx.json': '{"bomFormat":"CycloneDX"}' });
  chmodSync(join(work, 'bin/npm'), 0o755); chmodSync(join(work, 'bin/gh'), 0o755);
  const log = join(work, 'calls.log');
  const state = join(work, 'state'); mkdirSync(state);
  if (answers.tagOn) writeFileSync(join(state, 'tag'), answers.tagOn);
  if (answers.annotatedOn) { writeFileSync(join(state, 'tag'), 'tagobject1'); writeFileSync(join(state, 'annotated'), answers.annotatedOn); }
  const fromMain = answers.commit ? { GITHUB_REF_NAME: 'main', RELEASE_TAG: 'v0.1.0', RELEASE_COMMIT: answers.commit } : {};
  const result = spawnSync(answers.shell ?? 'bash', [script, join(work, 'release/brunosouzas-stackledger-0.1.0.tgz'), join(work, 'release/integrity'), join(work, 'release/stackledger-0.1.0.cdx.json')], {
    cwd: work, encoding: 'utf8',
    env: { ...process.env, PATH: `${join(work, 'bin')}${delimiter}${process.env.PATH}`, FAKE_LOG: log, FAKE_STATE: state, FAKE_GH_API_ERR: answers.apiError ?? '', FAKE_GH_REF_ERR: answers.refError ?? '', FAKE_GH_TAGOBJ_ERR: answers.tagObjectError ?? '', GH_REPO: 'brunosouzas/stackledger', GITHUB_REF_NAME: 'v0.1.0', ...fromMain,
      FAKE_NPM_VIEW_STATUS: String(answers.npmView.status), FAKE_NPM_VIEW_STDOUT: answers.npmView.stdout ?? '', FAKE_NPM_VIEW_STDERR: answers.npmView.stderr ?? '',
      FAKE_GH_VIEW_STATUS: String(answers.ghView?.status ?? 0), FAKE_GH_VIEW_STDERR: answers.ghView?.stderr ?? '' },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls, work };
}

const notFound = { status: 1, stdout: '{"error":{"code":"E404","summary":"Not Found - GET https://registry.npmjs.org/stackledger - Not found"}}', stderr: 'npm error code E404\n' };
const published = (dist: object) => ({ status: 0, stdout: JSON.stringify(dist) });
const withProvenance = { integrity, attestations: { url: 'https://registry.npmjs.org/-/npm/v1/attestations/@brunosouzas/stackledger@0.1.0', provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } };
const releaseNotFound = { status: 1, stderr: 'release not found\n' };

test('Version absent: publishes the tarball with provenance, public access and no scripts', () => {
  const run = release({ npmView: notFound, ghView: releaseNotFound });
  expect(run.status, run.stderr).toBe(0);
  expect(run.calls[0]).toBe('npm view @brunosouzas/stackledger@0.1.0 dist --json');
  // Lookup under the scoped name: the unscoped stackledger belongs to another npm account.
  expect(run.calls.filter(call => /(^|[\s/])stackledger@/.test(call) && !call.includes('@brunosouzas/stackledger@'))).toEqual([]);
  expect(run.calls).toContain(`npm publish ${join(run.work, 'release/brunosouzas-stackledger-0.1.0.tgz')} --provenance --access public --ignore-scripts`);
  expect(run.calls).toContain(`gh release create v0.1.0 ${join(run.work, 'release/stackledger-0.1.0.cdx.json')} --verify-tag --generate-notes`);
});

test('Re-run after the release step failed: skips publishing, creates the release or replaces its SBOM', () => {
  const created = release({ npmView: published(withProvenance), ghView: releaseNotFound });
  expect(created.status, created.stderr).toBe(0);
  expect(created.calls.filter(call => call.startsWith('npm publish'))).toEqual([]);
  expect(created.calls).toContain(`gh release create v0.1.0 ${join(created.work, 'release/stackledger-0.1.0.cdx.json')} --verify-tag --generate-notes`);

  const replaced = release({ npmView: published(withProvenance), ghView: { status: 0 } });
  expect(replaced.status, replaced.stderr).toBe(0);
  expect(replaced.calls.filter(call => call.startsWith('npm publish'))).toEqual([]);
  expect(replaced.calls).toContain(`gh release upload v0.1.0 ${join(replaced.work, 'release/stackledger-0.1.0.cdx.json')} --clobber`);
  expect(replaced.calls.filter(call => call.startsWith('gh release create'))).toEqual([]);
});

test('Same bytes without provenance: exit 1 without touching the GitHub release', () => {
  const run = release({ npmView: published({ integrity }) });
  expect(run.status).toBe(1);
  expect(run.stderr).toMatch(/provenance/);
  expect(run.calls).toEqual(['npm view @brunosouzas/stackledger@0.1.0 dist --json']);
});

test('Version already published with other bytes: exit 1 without publishing or touching the release', () => {
  const run = release({ npmView: published({ ...withProvenance, integrity: 'sha512-b3RoZXIgYnl0ZXM=' }) });
  expect(run.status).toBe(1);
  expect(run.stderr).toMatch(/integrity/);
  expect(run.calls).toEqual(['npm view @brunosouzas/stackledger@0.1.0 dist --json']);
});

test('Registry lookup fails: exit 1 without publishing or touching the release', () => {
  const answers = [
    { status: 1, stdout: '{"error":{"code":"ECONNRESET","summary":"network"}}', stderr: 'npm error code ECONNRESET\n' },
    { status: 1, stdout: '{"error":{"code":"E401","summary":"Unable to authenticate"}}', stderr: 'npm error code E401\n' },
    { status: 0, stdout: '' },
    { status: 0, stdout: '{}' },
    { status: 0, stdout: 'not json' },
    { status: 0, stdout: '{"integrity":""}' },
  ];
  for (const npmView of answers) {
    const run = release({ npmView });
    expect(run.status, JSON.stringify(npmView)).toBe(1);
    expect(run.calls, JSON.stringify(npmView)).toEqual(['npm view @brunosouzas/stackledger@0.1.0 dist --json']);
  }
});

test('Release lookup fails: exit 1 without creating or changing a release', () => {
  const run = release({ npmView: published(withProvenance), ghView: { status: 1, stderr: 'HTTP 401: Bad credentials\n' } });
  expect(run.status).toBe(1);
  expect(run.calls.filter(call => /^gh release (create|upload)/.test(call))).toEqual([]);
});

test('The script refuses to run without its three files', () => {
  const run = spawnSync('bash', [script], { encoding: 'utf8', env: { ...process.env, GITHUB_REF_NAME: 'v0.1.0' } });
  expect(run.status).toBe(2);
  expect(run.stderr).toMatch(/usage/i);
});

// From a push to main (package-release spec, Tag reserved before publishing, change release-on-merge).
const reserve = "gh api -X POST repos/brunosouzas/stackledger/git/refs -f ref=refs/tags/v0.1.0 -f sha=abc123";

test('Reserve, publish, release: the tag on the commit first, then npm, then the release on that tag', () => {
  const run = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123' });
  expect(run.status, run.stderr).toBe(0);
  const at = (prefix: string) => run.calls.findIndex(call => call.startsWith(prefix));
  expect(at(reserve)).toBe(0);
  expect(at('npm publish')).toBeGreaterThan(at(reserve));
  expect(run.calls[at('gh release create')]).toBe(`gh release create v0.1.0 ${join(run.work, 'release/stackledger-0.1.0.cdx.json')} --verify-tag --generate-notes`);
  expect(at('gh release create')).toBeGreaterThan(at('npm publish'));
});

test('Tag pushed meanwhile on another commit: exit 1 naming both, nothing published', () => {
  const run = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123', tagOn: 'def456' });
  expect(run.status).toBe(1);
  expect(run.stderr).toMatch(/def456/);
  expect(run.stderr).toMatch(/abc123/);
  expect(run.calls.filter(call => call.startsWith('npm'))).toEqual([]);
  expect(run.calls.filter(call => call.startsWith('gh release'))).toEqual([]);
});

test('Tag already on the released commit: goes on and publishes', () => {
  const run = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123', tagOn: 'abc123' });
  expect(run.status, run.stderr).toBe(0);
  expect(run.calls.some(call => call.startsWith('npm publish'))).toBe(true);
});

test('GitHub cannot answer for the tag: exit 1 without publishing', () => {
  const run = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123', apiError: 'HTTP 502: Bad gateway' });
  expect(run.status).toBe(1);
  expect(run.calls.filter(call => call.startsWith('npm'))).toEqual([]);
});

test('Registry fails after the reservation: exit 1, the tag stays, nothing published, no release', () => {
  const run = release({ npmView: { status: 1, stdout: '{"error":{"code":"E401","summary":"Unable to authenticate"}}' }, ghView: releaseNotFound, commit: 'abc123' });
  expect(run.status).toBe(1);
  expect(run.calls[0]).toBe(reserve);
  expect(readFileSync(join(run.work, 'state/tag'), 'utf8')).toBe('abc123');
  expect(run.calls.filter(call => call.startsWith('npm publish') || call.startsWith('gh release'))).toEqual([]);
});

// Every shell the script may meet: macOS bash 3.2 and, when installed, a bash 5 (CI's).
const shells = ['/bin/bash', '/opt/homebrew/bin/bash', '/usr/local/bin/bash'].filter(path => existsSync(path));

test('Tag reservation: annotated tags and every lookup failure stop before npm, on each bash', () => {
  for (const shell of shells) {
    const matching = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123', annotatedOn: 'abc123', shell });
    expect(matching.status, `${shell} ${matching.stderr}`).toBe(0);
    expect(matching.calls.some(call => call.startsWith('npm publish')), shell).toBe(true);

    const cases: [string, Partial<Answers>, RegExp][] = [
      ['annotated on another commit', { annotatedOn: 'def456' }, /names def456, not the released commit abc123/],
      ['ref lookup fails after 422', { tagOn: 'abc123', refError: 'HTTP 500: boom' }, /cannot read tag v0\.1\.0/],
      ['ref missing after 422', { tagOn: 'abc123', refError: 'gh: Not Found (HTTP 404)' }, /names nothing, not the released commit/],
      ['annotated tag object lookup fails', { annotatedOn: 'abc123', tagObjectError: 'HTTP 500: boom' }, /cannot read annotated tag/],
    ];
    for (const [name, extra, message] of cases) {
      const run = release({ npmView: notFound, ghView: releaseNotFound, commit: 'abc123', shell, ...extra });
      expect(run.status, `${shell} ${name}`).toBe(1);
      expect(run.stderr, `${shell} ${name}`).toMatch(message);
      expect(run.calls.filter(call => call.startsWith('npm') || call.startsWith('gh release')), `${shell} ${name}`).toEqual([]);
    }
  }
});
