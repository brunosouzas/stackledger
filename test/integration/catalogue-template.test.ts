/** Runs the commands of the catalogue repository template's workflow (catalogue-pipeline spec).
 * Run npm run build && npm test.
 *
 * The whole template is copied into a temporary folder, and each `run` step of the `site` job runs
 * there in bash, as GitHub runs it (bash -e -o pipefail), with `npx --yes "$STACKLEDGER"` replaced by
 * a wrapper around this checkout's dist/cli.js that records its arguments. So the commands that ship
 * are the commands tested. The `uses` steps are stood in for: checkout is the copy, the artifact is
 * a folder copy. A fake `date` first on PATH fixes the run's date. The deploy job's steps run on a
 * second temporary "runner" with a stub wrangler that only records how it was called; nothing
 * reaches Cloudflare. The gitleaks steps download the pinned release, so they need the network and
 * are skipped only when STACKLEDGER_OFFLINE=1.
 */
import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { delimiter, join } from 'node:path';
import { folder } from '../helpers.js';
import { readWorkflow, template, type Step } from '../template-workflow.js';
import { cli, root } from './helpers.js';

const workflow = readWorkflow();
const offline = process.env.STACKLEDGER_OFFLINE === '1';
if (offline) console.warn('catalogue-template.test.ts: the gitleaks checks are skipped (STACKLEDGER_OFFLINE=1; they download gitleaks)');

const gitEnv = { GIT_AUTHOR_NAME: 'Northwind Admin', GIT_AUTHOR_EMAIL: 'admin@example.com', GIT_COMMITTER_NAME: 'Northwind Admin',
  GIT_COMMITTER_EMAIL: 'admin@example.com', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/** The pinned gitleaks release for this machine: the template pins linux x64; the other assets'
 * SHA-256 come from the same release's gitleaks_<version>_checksums.txt. */
const gitleaksAssets: Record<string, { asset: string; sha256: string }> = {
  'linux x64': { asset: 'linux_x64', sha256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb' },
  'darwin arm64': { asset: 'darwin_arm64', sha256: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5' },
};
const gitleaksHere = gitleaksAssets[`${platform()} ${arch()}`];
const scanHere = !offline && gitleaksHere !== undefined;
if (!offline && !gitleaksHere) console.warn(`catalogue-template.test.ts: no pinned gitleaks for ${platform()} ${arch()}; the gitleaks checks are skipped`);

interface StepResult { name: string; status: number | null; output: string }
interface Run { repo: string; temp: string; steps: StepResult[]; calls: string[]; env: Record<string, string> }

const stepName = (step: Step) => step.name ?? step.run!.split('\n')[0]!;
const isScan = (step: Step) => /gitleaks/.test(step.run ?? '');

/** A copy of the whole template, then `change` applied to it (a catalogue, extra files, a commit). */
function repository(change: (repo: string) => void = () => {}): string {
  const repo = join(folder(), 'catalogue-repository');
  cpSync(template, repo, { recursive: true });
  change(repo);
  return repo;
}

/** Programs first on PATH: `date` answering the fixed date for `date -u +%F`, and the stackledger wrapper. */
function tools(work: string, log: string): string {
  const bin = join(work, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'date'), '#!/bin/bash\nif [ "$*" = "-u +%F" ]; then echo "$FAKE_DATE"; else exec /bin/date "$@"; fi\n');
  writeFileSync(join(bin, 'stackledger-under-test'), `#!/bin/bash\necho "stackledger $*" >> "${log}"\nexec "${process.execPath}" "${cli}" "$@"\n`);
  for (const name of ['date', 'stackledger-under-test']) chmodSync(join(bin, name), 0o755);
  return bin;
}

/** Run the `run` steps of one job in order, stopping at the first failure, as a runner would. */
function runSteps(job: Step[], cwd: (step: Step) => string, env: Record<string, string>, temp: string, script = (step: Step) => step.run!): StepResult[] {
  const results: StepResult[] = [];
  const githubEnv = join(temp, 'github-env');
  writeFileSync(githubEnv, '');
  for (const step of job) {
    if (step.run === undefined) continue;
    // Variables earlier steps wrote to GITHUB_ENV, as the runner passes them on.
    const exported = Object.fromEntries(readFileSync(githubEnv, 'utf8').split('\n').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    const file = join(temp, `step-${results.length}.sh`);
    writeFileSync(file, script(step));
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', file], {
      cwd: cwd(step), encoding: 'utf8', timeout: 240_000, env: { ...env, ...exported, ...(step.env ?? {}), GITHUB_ENV: githubEnv },
    });
    results.push({ name: stepName(step), status: result.status, output: `${result.stdout}${result.stderr}` });
    if (result.status !== 0) break;
  }
  return results;
}

/** The `site` job's commands in `repo`; `scan` includes the gitleaks step (network). */
function runSite(repo: string, options: { date?: string; scan?: boolean; gitleaksSha256?: string } = {}): Run {
  const work = folder(), temp = join(work, 'runner-temp'), log = join(work, 'calls.log');
  mkdirSync(temp);
  const env: Record<string, string> = {
    ...process.env as Record<string, string>, ...workflow.env, ...gitEnv,
    PATH: `${tools(work, log)}${delimiter}${process.env.PATH}`, RUNNER_TEMP: temp, FAKE_DATE: options.date ?? '2026-10-21', NODE_OPTIONS: '',
    ...(gitleaksHere ? { GITLEAKS_SHA256: options.gitleaksSha256 ?? gitleaksHere.sha256 } : {}),
  };
  const steps = workflow.jobs.site.steps.filter(step => options.scan || !isScan(step));
  const results = runSteps(steps, () => repo, env, temp, step => step.run!
    .replaceAll('npx --yes "$STACKLEDGER"', 'stackledger-under-test')
    .replaceAll('linux_x64', gitleaksHere?.asset ?? 'linux_x64'));
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return { repo, temp, steps: results, calls, env };
}

/** The artifact the `site` job uploads, as the folder it names. */
function artifactFolder(run: Run): string {
  const upload = workflow.jobs.site.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))!;
  return String(upload.with!.path).replace('${{ runner.temp }}', run.temp).replace(/\/$/, '');
}

/** The deploy job on a fresh runner: the artifact downloaded, then its `run` steps, wrangler stubbed. */
function runDeploy(site: Run, date: string) {
  const work = folder(), temp = join(work, 'runner-temp'), log = join(work, 'wrangler.log');
  mkdirSync(temp);
  const download = workflow.jobs.deploy.steps.find(step => step.uses?.startsWith('actions/download-artifact@'))!;
  const target = String(download.with!.path).replace('${{ runner.temp }}', temp);
  cpSync(artifactFolder(site), target, { recursive: true });
  // The install step is the only one not run: a stub stands in for the wrangler it installs.
  const wrangler = join(temp, 'wrangler', 'node_modules', '.bin', 'wrangler');
  mkdirSync(join(wrangler, '..'), { recursive: true });
  writeFileSync(wrangler, `#!/bin/bash\n{ echo "cwd $PWD"; echo "entries $(ls -A | tr '\\n' ' ')"; echo "wrangler $*"; } >> "${log}"\n`);
  chmodSync(wrangler, 0o755);
  const env: Record<string, string> = {
    ...process.env as Record<string, string>, ...workflow.env, PATH: `${tools(work, join(work, 'unused.log'))}${delimiter}${process.env.PATH}`,
    RUNNER_TEMP: temp, FAKE_DATE: date, GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567', PAGES_PROJECT: 'northwind-catalogue',
    CLOUDFLARE_API_TOKEN: 'not-a-token', CLOUDFLARE_ACCOUNT_ID: 'not-an-account', NODE_OPTIONS: '',
  };
  const steps = workflow.jobs.deploy.steps.filter(step => !/npm install/.test(step.run ?? ''));
  const cwd = (step: Step) => step['working-directory']?.replace('${{ runner.temp }}', temp) ?? work;
  // The deploy step's ${{ secrets.* }} and ${{ vars.* }} are stood in for by the env above.
  const results = runSteps(steps.map(step => ({ ...step, env: undefined })), cwd, env, temp);
  return { temp, deployFolder: target.replace(/\/site$/, ''), results, wrangler: existsSync(log) ? readFileSync(log, 'utf8') : '' };
}

const publishedEntries = (run: Run) => readdirSync(join(artifactFolder(run), 'site')).sort();
const four = ['_headers', 'full', 'robots.txt', 'staff'];
const statuses = (run: Run) => run.steps.map(step => step.status);

function catalogue(repo: string, documents: string) {
  rmSync(join(repo, 'catalog'), { recursive: true, force: true });
  mkdirSync(join(repo, 'catalog'));
  writeFileSync(join(repo, 'catalog', 'catalog-info.yaml'), documents);
}
const component = (metadata: string, owner = '  owner: group:northwind\n') =>
  `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: northwind-chat\n${metadata}spec:\n  type: tool\n  lifecycle: active\n${owner}`;

test('Copied template passes as is: every site command exits 0 beside the workflow YAML', () => {
  const run = runSite(repository());
  expect(run.steps.length).toBeGreaterThanOrEqual(4);
  expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
  expect(run.calls).toEqual([
    'stackledger validate catalog',
    `stackledger build catalog --out ${join(run.temp, 'site')} --date 2026-10-21`,
  ]);
  expect(publishedEntries(run)).toEqual(four);
  // The log names the stackledger version the job used.
  expect(run.steps.map(step => step.output).join('\n')).toContain(workflow.env.STACKLEDGER);
}, 240_000);

test('Catalogue error stops the job: validate exits 1 and the build does not run', () => {
  const run = runSite(repository(repo => catalogue(repo, component('', ''))));
  expect(statuses(run).at(-1)).toBe(1);
  expect(run.steps.at(-1)!.name).toBe('Validate the catalogue');
  expect(run.steps.at(-1)!.output).toMatch(/errors: 1\b/);
  expect(run.calls).toEqual(['stackledger validate catalog']);
  expect(existsSync(join(run.temp, 'site'))).toBe(false);
}, 120_000);

test('Catalogue warning does not stop the job: every command exits 0 and the publish folder is filled', () => {
  const run = runSite(repository(repo => catalogue(repo, component('  namespace: northwind\n'))));
  expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
  expect(run.steps.map(step => step.output).join('\n')).toMatch(/warnings: 1\b/);
  expect(publishedEntries(run)).toEqual(four);
}, 240_000);

test('Only the four entries: the Northwind example publishes full, staff, _headers and robots.txt', () => {
  const run = runSite(repository(repo => {
    rmSync(join(repo, 'catalog'), { recursive: true });
    cpSync(join(root, 'examples', 'northwind'), join(repo, 'catalog'), { recursive: true });
  }));
  expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
  expect(publishedEntries(run)).toEqual(four);
  // The build's own marker and staging folders stay behind in the build folder.
  expect(readdirSync(join(run.temp, 'site'))).toContain('.stackledger-build');
}, 240_000);

test('Repository extras are not deployed: the deploy folder holds only site/ with the four entries', () => {
  const run = runSite(repository(repo => {
    mkdirSync(join(repo, 'functions'));
    writeFileSync(join(repo, 'functions', '_middleware.js'), 'export const onRequest = () => new Response("not ours");\n');
    writeFileSync(join(repo, 'wrangler.toml'), 'name = "northwind-catalogue"\npages_build_output_dir = "."\n');
    writeFileSync(join(repo, 'NOTES'), 'not YAML, not published\n');
  }));
  expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
  const deployed = runDeploy(run, '2026-10-21');
  expect(deployed.results.filter(step => step.status !== 0)).toEqual([]);
  expect(readdirSync(deployed.deployFolder)).toEqual(['site']);
  expect(readdirSync(join(deployed.deployFolder, 'site')).sort()).toEqual(four);
  // wrangler ran in that folder and saw only site/.
  expect(deployed.wrangler).toContain(`cwd ${realpathSync(deployed.deployFolder)}\n`);
  expect(deployed.wrangler).toContain('entries site \n');
  expect(deployed.wrangler).toMatch(/^wrangler pages deploy site --project-name northwind-catalogue --branch main /m);
}, 240_000);

test('Build date travels with the files: built on 2026-10-21, deployed on 2026-10-22, labelled 2026-10-21', () => {
  const run = runSite(repository(), { date: '2026-10-21' });
  expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
  expect(run.calls[1]).toMatch(/ --date 2026-10-21$/);
  const deployed = runDeploy(run, '2026-10-22');
  expect(deployed.results.filter(step => step.status !== 0)).toEqual([]);
  expect(deployed.wrangler).toContain('--commit-hash 0123456789abcdef0123456789abcdef01234567');
  expect(deployed.wrangler).toContain('--commit-message stackledger 2026-10-21 0123456789abcdef0123456789abcdef01234567');
  expect(deployed.wrangler).not.toContain('2026-10-22');
}, 240_000);

describe.runIf(scanHere)('gitleaks (network)', () => {
  /** A Git repository of the template, committed, with `extra` files in the commit. */
  const committed = (extra: Record<string, string> = {}) => repository(repo => {
    for (const [path, content] of Object.entries(extra)) { mkdirSync(join(repo, path, '..'), { recursive: true }); writeFileSync(join(repo, path), content); }
    for (const args of [['init', '-q', '-b', 'main'], ['add', '-A'], ['commit', '-qm', 'catalogue']]) {
      const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...gitEnv } });
      if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    }
  });

  test('Copied template passes as is: the gitleaks scan finds nothing', () => {
    const run = runSite(committed(), { scan: true });
    expect(run.steps.filter(step => step.status !== 0)).toEqual([]);
    expect(run.steps[0]!.name).toMatch(/gitleaks/i);
  }, 240_000);

  test('Secret stops the job: a fictitious private key fails the scan before validate runs', () => {
    // Built at run time, so this file holds no key-shaped text; the bytes are random, not a key.
    const body = randomBytes(600).toString('base64').match(/.{1,64}/g)!.join('\n');
    const key = `-----BEGIN ${'RSA PRIVATE'} KEY-----\n${body}\n-----END ${'RSA PRIVATE'} KEY-----\n`;
    const run = runSite(committed({ 'notes/deploy.pem': key }), { scan: true });
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]!.name).toMatch(/gitleaks/i);
    expect(run.steps[0]!.status).not.toBe(0);
    expect(run.steps[0]!.output).toMatch(/leaks found: [1-9]/i);
    expect(run.calls).toEqual([]);
  }, 240_000);

  test('Exact versions: a gitleaks download that does not match the checksum stops the step', () => {
    const run = runSite(committed(), { scan: true, gitleaksSha256: '0'.repeat(64) });
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]!.status).not.toBe(0);
    expect(run.steps[0]!.output).toMatch(/FAILED/);
    expect(run.calls).toEqual([]);
  }, 240_000);

  test('the pinned checksums here are for the version the template pins', () => {
    expect(workflow.env.GITLEAKS_VERSION).toBe('8.30.1');
    expect(workflow.env.GITLEAKS_SHA256).toBe(gitleaksAssets['linux x64']!.sha256);
  });
});
