/** `stackledger discover` end to end (discover-command spec). Build first: npm run build && npm test.
 * Each run reads a fictitious Northwind Mac laid out in a temporary folder, through
 * test/integration/discover-entry.mjs, with a temporary HOME and snapshot root; the real
 * ~/.stackledger is never touched. Runs on every platform (the host says darwin and the sandbox is
 * a pass-through stand-in); the real sandbox is tested in discover-sandbox.test.ts.
 */
import { test, expect } from 'vitest';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { spawnSync } from 'node:child_process';
import { cli, run } from './helpers.js';
import { diskMachine, discoverRun, discoverRunAsync } from './discover-helpers.js';
import { checkSnapshot } from '../../src/discovery/snapshot.js';
import { SOURCES } from '../../src/discovery/annotations.js';

const MACHINE = 'username-macbook-air';
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
const oneLine = (stderr: string) => stderr.endsWith('\n') && stderr.trimEnd().split('\n').length === 1;
const snapshotFile = (machine: { snapshotRoot: string }) => join(machine.snapshotRoot, MACHINE, 'snapshot.json');
const mode = (path: string) => statSync(path).mode & 0o777;

test('Snapshot written', () => {
  const machine = diskMachine();
  const result = discoverRun(machine);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  const lines = result.stdout.trimEnd().split('\n');
  expect(lines[0]).toBe(snapshotFile(machine));
  expect(lines.slice(1).map(line => line.split(/\s+/)[0])).toEqual([...SOURCES]);
  expect(checkSnapshot(JSON.parse(readFileSync(snapshotFile(machine), 'utf8')))).toHaveProperty('snapshot');
});

test('Skipped source still succeeds', () => {
  const machine = diskMachine({ programs: { mas: null } });
  const result = discoverRun(machine);
  expect(result.status).toBe(0);
  const mas = result.stdout.split('\n').find(line => line.startsWith('mas '))!;
  expect(mas).toContain('skipped');
  expect(mas).toContain('not found');
});

test('Unexpected folder', () => {
  const machine = diskMachine();
  const result = discoverRun(machine, ['./catalogue']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('takes no folder');
  expect(result.stderr).toContain('Usage:');
  expect(existsSync(machine.snapshotRoot)).toBe(false);
});

test('Discover help', () => {
  const result = run(['discover', '--help', '--out', 'x']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('stackledger discover');
  expect(result.stderr).toBe('');
});

test('Not macOS', () => {
  const machine = diskMachine({ host: { platform: 'linux' } });
  const result = discoverRun(machine);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('runs only on macOS');
  expect(existsSync(machine.snapshotRoot)).toBe(false);
  if (process.platform === 'linux') {
    // The real CLI on Linux, with a temporary HOME so nothing real could be touched.
    const home = folder();
    const real = spawnSync(process.execPath, [cli, 'discover'], { encoding: 'utf8', env: { ...process.env, HOME: home, NODE_OPTIONS: '' } });
    expect(real.status).toBe(1);
    expect(real.stdout).toBe('');
    expect(real.stderr).toContain('runs only on macOS');
    expect(readdirSync(home)).toEqual([]);
  }
});

test('Sandbox missing', () => {
  const machine = diskMachine({ sandbox: join(folder(), 'sandbox-exec') });
  const result = discoverRun(machine);
  expect(result.status).toBe(1);
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('sandbox');
  expect(existsSync(machine.snapshotRoot)).toBe(false);
});

test('First run', () => {
  const machine = diskMachine();
  expect(discoverRun(machine).status).toBe(0);
  expect(mode(machine.snapshotRoot)).toBe(0o700);
  expect(mode(join(machine.snapshotRoot, MACHINE))).toBe(0o700);
  expect(mode(snapshotFile(machine))).toBe(0o600);
});

test('Two runs at once', async () => {
  const machine = diskMachine();
  const results = await Promise.all([discoverRunAsync(machine), discoverRunAsync(machine)]);
  expect(results.map(result => result.status)).toEqual([0, 0]);
  expect(readdirSync(join(machine.snapshotRoot, MACHINE))).toEqual(['snapshot.json']);
  expect(checkSnapshot(JSON.parse(readFileSync(snapshotFile(machine), 'utf8')))).toHaveProperty('snapshot');
});

test('Linked snapshot folder', () => {
  const machine = diskMachine(), elsewhere = folder();
  symlinkSync(elsewhere, machine.snapshotRoot);
  const result = discoverRun(machine);
  expect(result.status).toBe(1);
  expect(oneLine(result.stderr)).toBe(true);
  expect(readdirSync(elsewhere)).toEqual([]);
});

test('Folder writable by others', () => {
  const machine = diskMachine(), machineFolder = join(machine.snapshotRoot, MACHINE);
  mkdirSync(machineFolder, { recursive: true, mode: 0o700 });
  chmodSync(machine.snapshotRoot, 0o700);
  chmodSync(machineFolder, 0o777);
  const result = discoverRun(machine);
  expect(result.status).toBe(1);
  expect(oneLine(result.stderr)).toBe(true);
  expect(readdirSync(machineFolder)).toEqual([]);
});

test('Folder readable by others', () => {
  const machine = diskMachine();
  mkdirSync(machine.snapshotRoot);
  chmodSync(machine.snapshotRoot, 0o755);
  const result = discoverRun(machine);
  expect(result.status).toBe(1);
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('must be private to the user');
  expect(readdirSync(machine.snapshotRoot)).toEqual([]);
});

test('Folder not writable', () => {
  const machine = diskMachine(), machineFolder = join(machine.snapshotRoot, MACHINE);
  mkdirSync(machineFolder, { recursive: true, mode: 0o700 });
  writeFileSync(join(machineFolder, 'snapshot.json'), 'previous');
  chmodSync(machineFolder, 0o500);
  const result = discoverRun(machine);
  chmodSync(machineFolder, 0o700);
  expect(result.status).toBe(1);
  expect(oneLine(result.stderr)).toBe(true);
  expect(readFileSync(join(machineFolder, 'snapshot.json'), 'utf8')).toBe('previous');
  expect(readdirSync(machineFolder)).toEqual(['snapshot.json']);
});

test('Program output kept out', () => {
  const noisy = "printf '\\033[2J\\033]0;northwind\\007'\nprintf '\\033[31mnorthwind\\233' >&2\nexit 1";
  const machine = diskMachine({ programs: { brew: noisy, npm: noisy, mas: noisy } });
  const result = discoverRun(machine);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('exited with code 1');
  expect(result.stdout).not.toMatch(CONTROL);
  expect(result.stderr).not.toMatch(CONTROL);
  expect(result.stdout + result.stderr).not.toContain('northwind');
});
