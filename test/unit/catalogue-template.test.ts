/** The catalogue repository template's workflow, read as YAML (catalogue-pipeline spec). Run npm test.
 * actionlint runs on it when it is on PATH (see test/tools.ts); the commands themselves are run by
 * test/integration/catalogue-template.test.ts.
 */
import { describe, expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkflow, template, workflowPath, type Job, type Step } from '../template-workflow.js';
import { actionlint, toolOrSkip } from '../tools.js';

const workflow = readWorkflow();
const { site, deploy } = workflow.jobs;
const steps = [...site.steps, ...deploy.steps];
const text = (step: Step) => `${step.run ?? ''}\n${JSON.stringify(step.env ?? {})}\n${JSON.stringify(step.with ?? {})}`;
const runs = (job: Job, pattern: RegExp) => job.steps.filter(step => step.run !== undefined && pattern.test(step.run));

test('Template files: workflow, .gitignore, README.md and catalog/, with the four triggers', () => {
  const listed = readdirSync(template).sort();
  expect(listed).toEqual(['.github', '.gitignore', 'README.md', 'catalog']);
  expect(existsSync(join(template, workflowPath))).toBe(true);
  expect(statSync(join(template, 'catalog')).isDirectory()).toBe(true);
  expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'schedule', 'workflow_dispatch']);
  expect(workflow.on.push).toEqual({ branches: ['main'] });
  expect(workflow.on.schedule).toEqual([{ cron: '0 6 * * 1' }]);
  const readme = readFileSync(join(template, 'README.md'), 'utf8');
  for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'PAGES_PROJECT', 'docs/hosting.md']) expect(readme).toContain(name);
  expect(readFileSync(join(template, '.gitignore'), 'utf8').split('\n').filter(Boolean)).toEqual(['node_modules/', '.DS_Store']);
});

test('Exact versions: actions by SHA, stackledger and wrangler x.y.z, gitleaks checked before use', () => {
  const uses = steps.filter(step => step.uses !== undefined).map(step => step.uses!);
  expect(uses.length).toBeGreaterThan(0);
  expect(uses.filter(use => !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(use))).toEqual([]);
  // Scoped value parses: a YAML string, quoted in the file because a plain value cannot start with @.
  expect(typeof workflow.env.STACKLEDGER).toBe('string');
  expect(workflow.env.STACKLEDGER).toMatch(/^@brunosouzas\/stackledger@\d+\.\d+\.\d+$/);
  expect(workflow.env.WRANGLER).toMatch(/^wrangler@\d+\.\d+\.\d+$/);
  expect(workflow.env.GITLEAKS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  expect(workflow.env.GITLEAKS_SHA256).toMatch(/^[0-9a-f]{64}$/);
  // stackledger runs only as npx --yes "$STACKLEDGER", so the version is set once.
  const calls = site.steps.flatMap(step => step.run?.match(/npx [^\n]*/g) ?? []);
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.filter(call => !call.startsWith('npx --yes "$STACKLEDGER" '))).toEqual([]);
  const [scan] = runs(site, /gitleaks/);
  const script = scan!.run!;
  const download = script.indexOf('curl '), check = script.indexOf('sha256sum -c'), use = script.search(/gitleaks"? git /);
  expect(download).toBeGreaterThanOrEqual(0);
  expect(check).toBeGreaterThan(download);
  expect(use).toBeGreaterThan(check);
  // GitHub runs `run` with bash -e, so a failed checksum check stops the step before gitleaks runs.
  expect(script).toContain('"${GITLEAKS_SHA256}  ');
});

test('Build date: the build passes --date with the UTC date of the run', () => {
  const [dated] = runs(site, /date -u \+%F/);
  expect(dated?.run).toMatch(/BUILD_DATE=\$\(date -u \+%F\)/);
  const [build] = runs(site, /\bbuild catalog\b/);
  expect(build?.run).toContain('--date "$BUILD_DATE"');
  expect(site.steps.indexOf(dated!)).toBeLessThan(site.steps.indexOf(build!));
});

test('Pull request does not deploy: deploy needs site, runs only on main and not for a pull request', () => {
  expect(deploy.needs).toBe('site');
  expect(deploy.if).toBe("github.ref == 'refs/heads/main' && github.event_name != 'pull_request'");
  expect(site.steps.map(text).join('\n')).not.toMatch(/secrets\.|CLOUDFLARE/);
});

test('Wrangler installed without secrets: no checkout, --ignore-scripts install, no npx in the deploy step', () => {
  expect(deploy.steps.some(step => step.uses?.startsWith('actions/checkout@'))).toBe(false);
  const [install] = runs(deploy, /npm install/);
  expect(install?.run).toContain('--ignore-scripts');
  expect(install?.run).toContain('"$WRANGLER"');
  expect(text(install!)).not.toMatch(/secrets\./);
  const withSecrets = deploy.steps.filter(step => /secrets\./.test(text(step)));
  expect(withSecrets).toHaveLength(1);
  const [deployStep] = withSecrets;
  expect(deploy.steps.indexOf(install!)).toBeLessThan(deploy.steps.indexOf(deployStep!));
  expect(Object.keys(deployStep!.env ?? {})).toEqual(expect.arrayContaining(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']));
  expect(deployStep!.run).not.toMatch(/\bnpx\b|npm install|npm exec/);
  expect(deployStep!.run).toMatch(/"\$RUNNER_TEMP\/wrangler\/node_modules\/\.bin\/wrangler" pages deploy site/);
  expect(deployStep!['working-directory']).toBe('${{ runner.temp }}/deploy');
});

test('Labelled deployment: commit hash of the run and the date the site job wrote', () => {
  const [deployStep] = runs(deploy, /pages deploy/);
  expect(deployStep?.run).toContain('--commit-hash "$GITHUB_SHA"');
  expect(deployStep?.run).toMatch(/--commit-message "[^"]*\$BUILD_DATE[^"]*"/);
  // The deploy job reads BUILD_DATE from the build-date file and never asks the clock.
  expect(deploy.steps.map(text).join('\n')).not.toMatch(/\bdate -u\b|\$\(date\b/);
  expect(runs(deploy, /build-date/).some(step => /BUILD_DATE=/.test(step.run!))).toBe(true);
  expect(runs(site, /build-date/).some(step => /"\$BUILD_DATE" > /.test(step.run!))).toBe(true);
});

describe('Least privilege', () => {
  test('site has contents: read, deploy none, no persisted credentials, one concurrency group per ref', () => {
    expect(workflow.permissions).toEqual({});
    expect(site.permissions).toEqual({ contents: 'read' });
    expect(deploy.permissions).toEqual({});
    const checkouts = steps.filter(step => step.uses?.startsWith('actions/checkout@'));
    expect(checkouts).toHaveLength(1);
    expect(checkouts[0]!.with?.['persist-credentials']).toBe(false);
    expect(workflow.concurrency?.group).toContain('${{ github.ref }}');
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false);
    for (const step of steps) {
      expect(step.with?.cache, step.uses).toBeUndefined();
      if (step.uses?.startsWith('actions/setup-node@')) expect(step.with?.['package-manager-cache'], step.uses).toBe(false);
    }
  });

  const binary = toolOrSkip('actionlint', 'catalogue-template.test.ts');
  test.runIf(binary)('actionlint reports nothing', () => {
    const result = actionlint(binary!, workflowPath, template);
    expect(result.output).toBe('');
    expect(result.status).toBe(0);
  });
});
