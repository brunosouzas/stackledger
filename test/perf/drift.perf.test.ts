/** drift-command "Large drift": elapsed time of `stackledger drift` comparing a snapshot of 2,000
 * items with 500 annotated components, in each format. It measures wall-clock time, so it runs alone
 * (npm run test:perf, one worker, after npm run build), never next to the site builds of npm test. */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cli } from '../integration/helpers.js';
import { catalogue, snapshotFile } from '../integration/drift-helpers.js';
import { app, brew, cask, comp, launchd, simple, snapshotOf } from '../drift-helpers.js';

const LIMIT_MS = 2000;
const pad = (i: number) => String(i).padStart(4, '0');

function timed(args: string[]) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' }, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, wallMs: performance.now() - started };
}

test('Large drift', () => {
  // 2,000 items over five sources, with dependencies, apps inside casks and jobs inside apps.
  const items = Array.from({ length: 400 }, (_, i) => [
    brew(`northwind-formula-${pad(i)}`, { dependsOn: [`northwind-formula-${pad((i + 1) % 400)}`], onRequest: i % 2 === 0 }),
    cask(`northwind-cask-${pad(i)}`, [`Northwind App ${pad(i)}.app`]),
    app(`com.northwind.app${pad(i)}`, `/Applications/Northwind App ${pad(i)}.app`),
    launchd(`com.northwind.job${pad(i)}`, `/Applications/Northwind App ${pad(i)}.app/Contents/MacOS/job`),
    simple('npm', `northwind-package-${pad(i)}`),
  ]).flat();
  // 500 components: each of the first 400 lists a formula and a job, the rest list identifiers not installed.
  const components = Array.from({ length: 500 }, (_, i) => comp(`component-${pad(i)}`, i < 400
    ? { 'stackledger/brew': `northwind-formula-${pad(i)}`, 'stackledger/launchd': `com.northwind.job${pad(i)}` }
    : { 'stackledger/npm': `northwind-gone-${pad(i)}` }));
  const path = catalogue(...components), file = snapshotFile(snapshotOf(items));
  for (const format of ['text', 'json']) {
    const args = ['drift', path, '--snapshot', file, '--format', format];
    const [first, second] = [timed(args), timed(args)];
    expect(first.status, first.stderr).toBe(0);
    expect(first.stderr).toBe('');
    expect(second.stdout, format).toBe(first.stdout);
    if (format === 'json') expect(JSON.parse(first.stdout).counts).toMatchObject({ items: 2000, matched: 800, missing: 100, proposedRelations: 400 });
    console.info(`drift-command: 2,000 items and 500 components, ${format}: ${Math.round(first.wallMs)} ms elapsed`);
    expect(first.wallMs, format).toBeLessThan(LIMIT_MS);
  }
}, 120_000);
