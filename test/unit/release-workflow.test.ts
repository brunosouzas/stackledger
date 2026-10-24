/** .github/workflows/release.yml (package-release spec: Checks without publishing rights,
 * Publication of the checked tarball, Release workflow hardening). Run npm test.
 * The workflow is read as YAML; actionlint runs on it when it is on PATH (see test/tools.ts).
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { actionlint, toolOrSkip } from '../tools.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflowFile = '.github/workflows/release.yml';

interface Step { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }
interface Job { needs?: string | string[]; if?: string; environment?: string | { name: string }; permissions?: Record<string, string>;
  outputs?: Record<string, string>; concurrency?: { group: string; 'cancel-in-progress': boolean }; steps: Step[] }
const workflowText = readFileSync(new URL(`../../${workflowFile}`, import.meta.url), 'utf8');
const workflow = parse(workflowText) as { on: unknown; permissions?: unknown; concurrency?: unknown; jobs: Record<string, Job> };
const publishScript = readFileSync(new URL('../../scripts/release-publish.sh', import.meta.url), 'utf8');
const [detectName, checkName, publishName] = Object.keys(workflow.jobs);
const detect = workflow.jobs[detectName!]!, checks = workflow.jobs[checkName!]!, publish = workflow.jobs[publishName!]!;
const needs = (job: Job) => (job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs]);
const allSteps = Object.values(workflow.jobs).flatMap(job => job.steps);

/** Index of the first run step matching `pattern`, or -1. */
const runIndex = (job: Job, pattern: RegExp) => job.steps.findIndex(step => step.run !== undefined && pattern.test(step.run));

test('Release on the version merge: pushes to main and v* tags; a read-only detect job first', () => {
  expect(workflow.on).toEqual({ push: { branches: ['main'], tags: ['v*'] } });
  expect(workflow.permissions).toEqual({});
  expect(detectName).toBe('detect');
  expect(detect.needs).toBeUndefined();
  expect(detect.permissions).toEqual({ contents: 'read' });
  expect(detect.outputs).toEqual({ release: '${{ steps.detect.outputs.release }}', tag: '${{ steps.detect.outputs.tag }}' });
  const step = detect.steps.find(candidate => candidate.run?.includes('scripts/release-detect.mjs'))!;
  expect(step.run).toBe('node scripts/release-detect.mjs "$REF_TYPE" "$REF_NAME" "$BEFORE" "$GITHUB_SHA" "$FORCED" >> "$GITHUB_OUTPUT"');
  expect(step.env).toEqual({ REF_TYPE: '${{ github.ref_type }}', REF_NAME: '${{ github.ref_name }}', BEFORE: '${{ github.event.before }}', FORCED: '${{ github.event.forced }}' });
  expect(detect.steps.find(candidate => candidate.uses?.startsWith('actions/checkout@'))?.with?.['fetch-depth']).toBe(0);
});

test('A later merge with the same version: no check or publish unless detect answers release=true', () => {
  expect(needs(checks)).toEqual(['detect']);
  expect(checks.if).toBe("needs.detect.outputs.release == 'true'");
  expect(needs(publish).sort()).toEqual(['check', 'detect']);
});

test('No event value is interpolated into a run block', () => {
  for (const step of allSteps) expect(step.run ?? '', step.name).not.toMatch(/\$\{\{/);
});

test('Concurrency groups: one per version tag, never cancelling', () => {
  expect(workflow.concurrency).toBeUndefined();
  expect(checks.concurrency).toEqual({ group: 'release-${{ needs.detect.outputs.tag }}', 'cancel-in-progress': false });
  expect(publish.concurrency).toEqual({ group: 'release-${{ needs.detect.outputs.tag }}-publish', 'cancel-in-progress': false });
  expect(detect.concurrency).toBeUndefined();
});

test('The SBOM and publish steps take the version from detect, never from GITHUB_REF_NAME', () => {
  expect(workflowText).not.toContain('GITHUB_REF_NAME');
  const sbom = checks.steps.find(step => step.run?.includes('npm sbom'))!;
  expect(sbom.env?.RELEASE_TAG).toBe('${{ needs.detect.outputs.tag }}');
  const script = publish.steps.find(step => step.run?.includes('scripts/release-publish.sh'))!;
  expect(script.env?.RELEASE_TAG).toBe('${{ needs.detect.outputs.tag }}');
  expect(script.env?.RELEASE_COMMIT).toBe("${{ github.ref_type == 'branch' && github.sha || '' }}");
  expect(script.run).toContain('version="${RELEASE_TAG#v}"');
});

test('Checks job: contents: read only; tag check, npm ci, build, tests, audit, pack and SBOM in order', () => {
  expect(checks.permissions).toEqual({ contents: 'read' });
  const order = [
    /node scripts\/check-release-tag\.mjs "\$RELEASE_TAG" "\$GITHUB_SHA"/, /^npm ci\b/m, /^npm run build\b/m, /^npm test\b/m,
    /^npm audit --audit-level=low\b/m, /^node scripts\/pack-production\.mjs\b/m, /^\s*npm sbom --package-lock-only --sbom-format cyclonedx\b/m,
  ].map(pattern => runIndex(checks, pattern));
  expect(order.every(index => index >= 0), String(order)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  const sbomStep = checks.steps[order.at(-1)!]!.run!;
  expect(sbomStep).toMatch(/tar -xzf "\$RUNNER_TEMP\/release\/brunosouzas-stackledger-.*\.tgz"/);
  expect(sbomStep).toContain('package/package.json package/npm-shrinkwrap.json');
  expect(sbomStep).toContain('--strip-components=1 -C "$RUNNER_TEMP/sbom/@brunosouzas/stackledger"');
  expect(sbomStep).toMatch(/cd "\$RUNNER_TEMP\/sbom\/@brunosouzas\/stackledger"/);
  // The tag check is the first command the job runs: nothing of the repository runs before it.
  expect(checks.steps.findIndex(step => step.run !== undefined)).toBe(order[0]);
  expect(checks.steps.some(step => step.uses?.startsWith('actions/upload-artifact@'))).toBe(true);
});

test('Publishing job: after the checks, in environment npm, publishing the checked tarball only', () => {
  expect(needs(publish)).toContain(checkName);
  const environment = typeof publish.environment === 'string' ? publish.environment : publish.environment?.name;
  expect(environment).toBe('npm');
  expect(publish.permissions).toEqual({ contents: 'write', 'id-token': 'write' });
  const checkout = publish.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  expect(checkout?.with?.['persist-credentials']).toBe(false);
  const runs = publish.steps.filter(step => step.run !== undefined).map(step => step.run!);
  expect(runs.some(run => /^scripts\/release-publish\.sh /m.test(run))).toBe(true);
  expect(runs.filter(run => /\bnpm (ci|install|i|run|test|pack|exec)\b|\bnpx\b/.test(run))).toEqual([]);
  expect(publish.steps.some(step => step.uses?.startsWith('actions/download-artifact@'))).toBe(true);
  expect(publishScript).toMatch(/npm publish "\$tarball" --provenance --access public --ignore-scripts/);
  // The bootstrap token is read from the environment's secret only; empty after the first version.
  const script = publish.steps.find(step => step.run?.includes('scripts/release-publish.sh'));
  expect(script?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.NPM_TOKEN }}');
});

describe('Pinned', () => {
  test('every action names a 40-character commit SHA and no step enables a package cache', () => {
    const uses = allSteps.filter(step => step.uses !== undefined).map(step => step.uses!);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(use => !/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/.test(use))).toEqual([]);
    for (const step of allSteps) {
      expect(step.with?.cache, step.uses).toBeUndefined();
      if (step.uses?.startsWith('actions/setup-node@')) expect(step.with?.['package-manager-cache'], step.uses).toBe(false);
      if (step.uses?.startsWith('actions/checkout@')) expect(step.with?.['persist-credentials'], step.uses).toBe(false);
    }
  });

  const binary = toolOrSkip('actionlint', 'release-workflow.test.ts');
  test.runIf(binary)('actionlint reports nothing', () => {
    const result = actionlint(binary!, workflowFile, root);
    expect(result.output).toBe('');
    expect(result.status).toBe(0);
  });
});
