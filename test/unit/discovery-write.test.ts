/** Writing the snapshot file (discover-command spec, Folder swap, Write failures; design D4). Run npm test.
 * Swaps are injected through the WriteOps argument at a chosen call, in temporary folders only.
 */
import { test, expect } from 'vitest';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { virtualHost } from '../virtual-host.js';
import { discover } from '../../src/discovery/index.js';
import { NODE_WRITE_OPS, writeSnapshot, type WriteOps } from '../../src/discovery/write.js';
import type { Snapshot } from '../../src/discovery/snapshot.js';

async function setup() {
  const home = folder(), root = join(home, '.stackledger'), machine = join(root, 'username-macbook-air'), target = folder();
  mkdirSync(machine, { recursive: true, mode: 0o700 });
  const snapshot = await discover(virtualHost(), new Date('2026-10-21T07:30:00Z'));
  return { home, root, machine, target, snapshot };
}
/** Move the machine folder away and put a link to `target` in its place. */
function swap(machine: string, target: string) { renameSync(machine, `${machine}-moved`); symlinkSync(target, machine); }
function swapAt(op: keyof WriteOps, machine: string, target: string): WriteOps {
  const original = NODE_WRITE_OPS[op] as (...args: unknown[]) => unknown;
  let done = false;
  return { ...NODE_WRITE_OPS, [op]: (...args: unknown[]) => { if (!done) { done = true; swap(machine, target); } return original(...args); } };
}

test('Folder replaced before the temporary file', async () => {
  const { home, root, machine, target, snapshot } = await setup();
  expect(() => writeSnapshot(snapshot, { home, root }, swapAt('open', machine, target))).toThrow(/changed/);
  expect(readdirSync(target)).toEqual([]);
  expect(readdirSync(`${machine}-moved`)).toEqual([]);
});

test('Folder replaced before the rename', async () => {
  const { home, root, machine, target, snapshot } = await setup();
  writeFileSync(join(machine, 'snapshot.json'), 'previous');
  expect(() => writeSnapshot(snapshot, { home, root }, swapAt('close', machine, target))).toThrow(/changed/);
  expect(readdirSync(target)).toEqual([]);
  expect(readFileSync(join(`${machine}-moved`, 'snapshot.json'), 'utf8')).toBe('previous');
  // The temporary file stays in the folder that was moved away: nothing outside the path is removed.
  expect(readdirSync(`${machine}-moved`).filter(name => name.endsWith('.tmp'))).toHaveLength(1);
});

test('Snapshot too large', async () => {
  const { home, root, machine, snapshot } = await setup();
  writeFileSync(join(machine, 'snapshot.json'), 'previous');
  const huge: Snapshot = { ...snapshot, items: [{ source: 'npm', id: 'northwind-huge', versions: Array.from({ length: 33 }, (_, i) => `${i}`.padEnd(1024 * 1024, 'x')) }] };
  const calls: string[] = [];
  const recording = Object.fromEntries(Object.entries(NODE_WRITE_OPS).map(([name, call]) => [name, (...args: unknown[]) => { calls.push(name); return (call as (...a: unknown[]) => unknown)(...args); }])) as unknown as WriteOps;
  expect(() => writeSnapshot(huge, { home, root }, recording)).toThrow(/too large/);
  expect(calls).toEqual([]);
  expect(readFileSync(join(machine, 'snapshot.json'), 'utf8')).toBe('previous');
  expect(existsSync(join(machine, 'snapshot.json'))).toBe(true);
});
