/** scripts/release-publish.sh, the publishing step of a release (package-release spec, Completing a
 * partial release). Run npm test. Fake `npm` and `gh` programs first on PATH record their arguments
 * and answer as each case needs; nothing reaches npm or GitHub.
 */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
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
const fakeGh = `#!/bin/bash
echo "gh $*" >> "$FAKE_LOG"
case "$1 $2" in
  "release view") printf '%s' "$FAKE_GH_VIEW_STDERR" >&2; exit "\${FAKE_GH_VIEW_STATUS:-0}" ;;
  "release create"|"release upload") exit 0 ;;
  *) echo "fake gh: unexpected call" >&2; exit 99 ;;
esac
`;

interface Answers { npmView: { status: number; stdout?: string; stderr?: string }; ghView?: { status: number; stderr?: string } }

function release(answers: Answers) {
  const work = folder({ 'bin/npm': fakeNpm, 'bin/gh': fakeGh, 'release/brunosouzas-stackledger-0.1.0.tgz': 'tarball bytes',
    'release/integrity': `${integrity}\n`, 'release/stackledger-0.1.0.cdx.json': '{"bomFormat":"CycloneDX"}' });
  chmodSync(join(work, 'bin/npm'), 0o755); chmodSync(join(work, 'bin/gh'), 0o755);
  const log = join(work, 'calls.log');
  const result = spawnSync('bash', [script, join(work, 'release/brunosouzas-stackledger-0.1.0.tgz'), join(work, 'release/integrity'), join(work, 'release/stackledger-0.1.0.cdx.json')], {
    cwd: work, encoding: 'utf8',
    env: { ...process.env, PATH: `${join(work, 'bin')}${delimiter}${process.env.PATH}`, FAKE_LOG: log, GITHUB_REF_NAME: 'v0.1.0',
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
