/** `stackledger report` against the built CLI (report-command spec, and the command part of the
 * licence-reports Empty report scenario): one test per scenario, named after it. Run
 * npm run build && npm test. Catalogues are synthetic and fictitious.
 */
import { expect, test } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cli, root, run } from './helpers.js';
import { yaml } from './mcp-helpers.js';
import { folder } from '../helpers.js';
import { component, licence, set } from '../unit/helpers.js';
import { buildGraph, localDate } from '../../src/graph.js';
import { buildReport } from '../../src/reports.js';
import { formatText } from '../../src/report-formats.js';
import { validateFolder } from '../../src/validate.js';
import { applyView, resolveHidden } from '../../src/views.js';

const DATE = '2027-06-01';

function lic(name: string, fields: Record<string, unknown> = {}): unknown {
  let document: unknown = licence(name);
  for (const [field, value] of Object.entries(fields)) document = set(document, `spec.licence.${field}`, value);
  return document;
}

const catalogueOf = (...documents: unknown[]) => folder({ 'catalogue.yaml': yaml(...documents) });
const fixture = () => catalogueOf(set(component('editor'), 'spec.dependsOn', ['resource:licence-editor']), lic('licence-editor', { renewsOn: '2027-06-30' }));

function hashes(path: string): Record<string, string> {
  return Object.fromEntries(readdirSync(path, { recursive: true }).map(String).filter(file => statSync(join(path, file)).isFile()).sort()
    .map(file => [file, createHash('sha256').update(readFileSync(join(path, file))).digest('hex')]));
}

/** Minimal CSV reader (RFC 4180, every field quoted): rows of fields. */
function csvRows(text: string): string[][] {
  expect(text.endsWith('\r\n')).toBe(true);
  const rows: string[][] = [];
  const field = /"((?:[^"]|"")*)"(,|\r\n)/gy;
  let row: string[] = [];
  let consumed = 0;
  for (let match = field.exec(text); match; match = field.exec(text)) {
    consumed = field.lastIndex;
    row.push(match[1]!.replaceAll('""', '"'));
    if (match[2] === '\r\n') {
      rows.push(row);
      row = [];
    }
  }
  // Every byte belongs to a quoted field.
  expect(consumed).toBe(text.length);
  return rows;
}

test('Default options', async () => {
  const path = fixture();
  const result = run(['report', path]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  const catalogue = await validateFolder(path);
  const expected = formatText(buildReport(buildGraph(applyView(catalogue.served, 'full', resolveHidden(catalogue))), localDate(), 90));
  expect(result.stdout).toBe(expected);
  expect(result.stdout).toContain('(90 days)');
});

test('Read-only', { timeout: 60_000 }, () => {
  const path = fixture(), before = hashes(path);
  const flags = ['--permission', `--allow-fs-read=${join(root, 'dist')}`, `--allow-fs-read=${join(root, 'node_modules')}`, `--allow-fs-read=${path}`];
  const plain = run(['report', path, '--date', DATE, '--format', 'json']);
  const restricted = run(['report', path, '--date', DATE, '--format', 'json'], root, flags);
  expect(restricted).toEqual(plain);
  expect(restricted.status).toBe(0);
  expect(JSON.parse(restricted.stdout).renewals).toHaveLength(1);
  expect(hashes(path)).toEqual(before);
  // The sandbox really refuses writes, so the run above proves the command writes nothing.
  const probe = spawnSync(process.execPath, [...flags, '-e', 'require("node:fs").writeFileSync(process.argv[1], "denied")', join(path, 'forbidden')], { encoding: 'utf8' });
  expect(probe.status).not.toBe(0);
  expect(probe.stderr).toContain('ERR_ACCESS_DENIED');
});

test('Days out of range', () => {
  expect(run(['report', fixture(), '--days', '400']).stderr).toContain('from 0 to 366');
  for (const days of ['400', '-1', '1.5', 'ten', '367', '']) {
    // `--days=-1`: written apart, a value starting with a dash reads as another option.
    const result = run(['report', fixture(), `--days=${days}`]);
    expect(result.status, days).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('from 0 to 366');
    expect(result.stderr).toContain('Usage:');
  }
  expect(run(['report', fixture(), '--days', '366']).status).toBe(0);
});

test('Unknown format', () => {
  const result = run(['report', fixture(), '--format', 'xlsx']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('allowed formats: text, json, csv, ics');
});

test('Missing folder', () => {
  const result = run(['report', join(folder(), 'absent')]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('folder was not found');
  // The other usage errors of the spec behave the same way.
  for (const args of [['report'], ['report', fixture(), '--fast'], ['report', fixture(), fixture()], ['report', fixture(), '--date', '2027-02-30']]) {
    const other = run(args);
    expect(other.status, args.join(' ')).toBe(2);
    expect(other.stdout).toBe('');
    expect(other.stderr).toMatch(/.+\nUsage:/);
  }
  expect(run(['report', '--format', 'xlsx', '--help']).status).toBe(0);
});

test('Amount too large', () => {
  const path = catalogueOf(lic('licence-absurd', { cost: 12345678901234567 }), lic('licence-editor'));
  const result = run(['report', path, '--date', DATE, '--format', 'json']);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('resource:licence-absurd');
  expect(result.stderr.trimEnd().split('\n')).toHaveLength(1);
  expect(result.stderr).not.toContain('Usage:');
});

test('Closed pipe', async () => {
  // Long titles make the CSV far larger than any pipe buffer, so the writer meets the closed end.
  const title = 'Northwind shared licence '.repeat(80);
  const path = catalogueOf(...Array.from({ length: 300 }, (_, i) => set(lic(`licence-${String(i).padStart(3, '0')}`), 'metadata.title', title)));
  const child = spawn(process.execPath, [cli, 'report', path, '--date', DATE, '--format', 'csv'], { env: { ...process.env, NODE_OPTIONS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.stdout.once('data', () => child.stdout.destroy());
  const status = await new Promise<number | null>(done => child.on('close', code => done(code)));
  expect(status).toBe(1);
  expect(stderr.trimEnd().split('\n')).toHaveLength(1);
  expect(stderr).toContain('cannot write the report');
  expect(stderr).not.toContain('Usage:');
});

test('JSON totals', () => {
  const result = run(['report', catalogueOf(lic('licence-a', { cost: 4 }), lic('licence-b', { cost: 6 })), '--date', DATE, '--format', 'json']);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.recurring).toEqual([{ currency: 'GBP', monthly: 10, yearly: 120, incomplete: 0 }]);
  expect(Object.keys(report)).toEqual(['date', 'days', 'to', 'renewals', 'overdue', 'unknownDates', 'recurring', 'groups', 'oneOff', 'planned', 'incomplete']);
});

test('CSV rows', () => {
  const path = catalogueOf(
    lic('licence-monthly', { cost: 10 }), lic('licence-once', { cycle: 'one-off', cost: 300 }), lic('licence-unknown', { cost: 'unknown' }),
    lic('licence-planned', { status: 'to-buy', cycle: 'yearly', cost: 600, currency: 'EUR' }), lic('licence-old', { status: 'cancelled' }),
  );
  const result = run(['report', path, '--date', DATE, '--format', 'csv']);
  expect(result.status).toBe(0);
  const [header, ...rows] = csvRows(result.stdout);
  expect(header!.join(',')).toBe('ref,title,vendor,status,cycle,cost,currency,monthly,yearly,renewsOn,owner,paidBy,zone,counted');
  const column = (name: string) => header!.indexOf(name);
  const byRef = new Map(rows.map(row => [row[0], row]));
  expect(rows.map(row => row[0])).toEqual(['resource:licence-monthly', 'resource:licence-once', 'resource:licence-planned', 'resource:licence-unknown']);
  expect(rows.filter(row => row[column('counted')] === 'true').map(row => row[0])).toEqual(['resource:licence-monthly']);
  for (const ref of ['resource:licence-once', 'resource:licence-unknown']) {
    expect(byRef.get(ref)![column('monthly')], ref).toBe('');
    expect(byRef.get(ref)![column('yearly')], ref).toBe('');
  }
  expect(byRef.get('resource:licence-unknown')![column('cost')]).toBe('unknown');
  expect(byRef.get('resource:licence-planned')!.slice(column('monthly'), column('yearly') + 1)).toEqual(['50.00', '600.00']);
  expect(byRef.get('resource:licence-monthly')![column('paidBy')]).toBe('');
});

test('Formula in a title', () => {
  const path = catalogueOf(set(lic('licence-a'), 'metadata.title', '=HYPERLINK("x")'), set(lic('licence-b'), 'metadata.title', '＠SUM(1)'));
  const result = run(['report', path, '--date', DATE, '--format', 'csv']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain(',"\'=HYPERLINK(""x"")",');
  expect(result.stdout).toContain(',"\'＠SUM(1)",');
});

test('One error', () => {
  const path = catalogueOf(lic('licence-a'), set(component('broken'), 'spec.owner', undefined));
  const result = run(['report', path, '--date', DATE]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('stackledger report: 1 error, 0 warnings; run stackledger validate for details\n');
  expect(result.stdout).toMatch(/^Licence report for 2027-06-01/);
  expect(result.stdout).toContain('resource:licence-a');
});

// 'Large catalogue' measures elapsed time, so it runs alone: test/perf/report.perf.test.ts.

test('Window past the last date', () => {
  // A renewal's calendar event ends the next day, so the window must end by 9999-12-30.
  for (const [date, days] of [['9999-12-31', '0'], ['9999-10-01', '91']]) {
    const result = run(['report', fixture(), '--date', date, '--days', days]);
    expect(result.status, date).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('no later than 9999-12-30');
  }
  expect(run(['report', fixture(), '--date', '9999-10-01', '--days', '90', '--format', 'ics']).status).toBe(0);
});

test('Hostile label in an internal error', () => {
  const path = catalogueOf(
    lic('licence-big', { cycle: 'monthly', cost: 1e15, currency: 'GBP', paidBy: 'pay\nfake line\u001b[31m' }),
    lic('licence-cent', { cycle: 'monthly', cost: 0.01, currency: 'GBP', paidBy: 'pay\nfake line\u001b[31m' }),
  );
  const result = run(['report', path, '--date', DATE, '--format', 'json']);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trimEnd().split('\n')).toHaveLength(1);
  expect(result.stderr).not.toContain('\u001b');
});

test('Empty report', () => {
  const path = catalogueOf(component('editor'));
  const output = (format: string) => {
    const result = run(['report', path, '--date', DATE, '--format', format]);
    expect(result.status, format).toBe(0);
    return result.stdout;
  };
  expect(output('csv')).toBe('"ref","title","vendor","status","cycle","cost","currency","monthly","yearly","renewsOn","owner","paidBy","zone","counted"\r\n');
  expect(output('ics')).not.toContain('BEGIN:VEVENT');
  expect(output('text')).toContain('There are no licences.');
  expect(JSON.parse(output('json'))).toEqual({
    date: DATE, days: 90, to: '2027-08-30', renewals: [], overdue: [], unknownDates: [], recurring: [],
    groups: { owner: [], payer: [], zone: [] }, oneOff: { items: [], totals: [] }, planned: { items: [], recurring: [], oneOff: [] }, incomplete: [],
  });
});
