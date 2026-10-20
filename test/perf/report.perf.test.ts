/** report-command "Large catalogue": elapsed time of `stackledger report` on 300 licences, in each
 * format. It measures wall-clock time, so it runs alone (npm run test:perf, one worker, after
 * npm run build), never next to the site builds of npm test. */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cli } from '../integration/helpers.js';
import { yaml } from '../integration/mcp-helpers.js';
import { folder } from '../helpers.js';
import { licence, set } from '../unit/helpers.js';

const DATE = '2027-06-01';
const LIMIT_MS = 2000;

function lic(name: string, fields: Record<string, unknown>): unknown {
  let document: unknown = licence(name);
  for (const [field, value] of Object.entries(fields)) document = set(document, `spec.licence.${field}`, value);
  return document;
}

function timed(args: string[]) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' }, timeout: 60_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, wallMs: performance.now() - started };
}

test('Large catalogue', () => {
  const documents = Array.from({ length: 300 }, (_, i) => lic(`licence-${String(i).padStart(3, '0')}`, {
    cycle: ['monthly', 'yearly', 'one-off', 'none'][i % 4], cost: ((i * 731) % 50000) / 100, currency: ['GBP', 'EUR', 'USD'][i % 3],
    status: ['active', 'to-confirm', 'to-buy', 'cancelled'][i % 4], renewsOn: `2027-${String((i % 12) + 1).padStart(2, '0')}-15`,
  }));
  const path = folder({ 'catalogue.yaml': yaml(...documents) });
  for (const format of ['text', 'json', 'csv', 'ics']) {
    const args = ['report', path, '--date', DATE, '--format', format];
    const [first, second] = [timed(args), timed(args)];
    expect(first.status, first.stderr).toBe(0);
    expect(first.stderr).toBe('');
    expect(second.stdout, format).toBe(first.stdout);
    console.info(`report-command: 300 licences, ${format}: ${Math.round(first.wallMs)} ms elapsed`);
    expect(first.wallMs, format).toBeLessThan(LIMIT_MS);
  }
}, 120_000);
