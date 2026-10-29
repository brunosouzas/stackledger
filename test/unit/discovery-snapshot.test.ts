/** The snapshot discovery produces (mac-discovery spec, Snapshot content, consistency, secret guard,
 * determinism). Run npm test. Uses the in-memory fictitious Northwind machine of test/virtual-host.ts.
 */
import { test, expect } from 'vitest';
import { discover } from '../../src/discovery/index.js';
import { checkSnapshot, serialise, snapshotSchema } from '../../src/discovery/snapshot.js';
import { SOURCES } from '../../src/discovery/annotations.js';
import { machineFiles, virtualHost } from '../virtual-host.js';

const at = (iso: string) => new Date(iso);

test('Snapshot shape', async () => {
  const snapshot = await discover(virtualHost(), at('2026-10-21T07:30:00.456Z'));
  const parsed = snapshotSchema.safeParse(JSON.parse(serialise(snapshot)));
  expect(parsed.success).toBe(true);
  expect(snapshot.format).toBe('stackledger-snapshot/v1');
  expect(snapshot.takenAt).toBe('2026-10-21T07:30:00Z');
  expect(snapshot.machine).toEqual({ name: 'username-macbook-air', user: 'username', macos: '27.2' });
  expect(snapshot.sources.map(source => source.source)).toEqual([...SOURCES]);
  expect(Object.keys(snapshot.items.find(item => item.source === 'app')!)).toEqual(['source', 'id', 'versions', 'title', 'path', 'appStore']);
  expect(checkSnapshot(JSON.parse(serialise(snapshot)))).toEqual({ snapshot });
});

test('Consistent counts', async () => {
  const host = virtualHost({ files: { ...machineFiles(), '/Applications/Northwind Blank.app/Contents/Info.plist': { CFBundleName: 'Northwind Blank' } } });
  const snapshot = await discover(host, at('2026-10-21T07:30:00Z'));
  const source = (name: string) => snapshot.sources.find(entry => entry.source === name)!;
  expect(source('cask')).toEqual({ source: 'cask', status: 'ok', reason: null, items: 2, ignored: 0 });
  expect(source('app')).toMatchObject({ items: 5, ignored: 1 });
  for (const entry of snapshot.sources) expect(entry.items).toBe(snapshot.items.filter(item => item.source === entry.source).length);
  // An item of a skipped source breaks consistency.
  const broken = structuredClone(snapshot);
  broken.sources[2] = { source: 'mas', status: 'skipped', reason: 'not found', items: 2, ignored: 0 };
  expect(checkSnapshot(JSON.parse(serialise(broken)))).toEqual({ problem: 'consistency' });
});

test('Secret in the user name', async () => {
  const host = virtualHost({ user: 'username4111111111111111' });
  await expect(discover(host, at('2026-10-21T07:30:00Z'))).rejects.toThrow(/payment-card number/i);
  await expect(discover(host, at('2026-10-21T07:30:00Z'))).rejects.not.toThrow(/4111/);
});

test('Same state twice', async () => {
  const first = serialise(await discover(virtualHost(), at('2026-10-21T07:30:00Z')));
  // The same machine listed in the opposite order: sorting, not the file system, decides the order.
  const reversed = virtualHost();
  const readdir = reversed.readdir;
  reversed.readdir = async path => (await readdir(path)).reverse();
  const second = serialise(await discover(reversed, at('2026-10-22T08:00:00Z')));
  expect(second).not.toBe(first);
  expect(second.replace('2026-10-22T08:00:00Z', '2026-10-21T07:30:00Z')).toBe(first);
  expect(first.endsWith('}\n')).toBe(true);
});

test('Item without versions', async () => {
  const snapshot = JSON.parse(serialise(await discover(virtualHost(), at('2026-10-21T07:30:00Z'))));
  for (const source of ['brew', 'cask', 'mas', 'mise', 'npm', 'pipx']) {
    const copy = structuredClone(snapshot);
    const item = copy.items.find((entry: { source: string }) => entry.source === source);
    if (!item) continue;
    item.versions = [];
    expect(checkSnapshot(copy), source).toEqual({ problem: 'shape' });
  }
  const app = structuredClone(snapshot);
  app.items.find((entry: { source: string }) => entry.source === 'app').versions = [];
  expect(checkSnapshot(app)).toHaveProperty('snapshot');
});

// Snapshot without script (launchd-script change): written before the field existed.
test('Snapshot from before the script field', async () => {
  const snapshot = await discover(virtualHost(), at('2026-10-21T07:30:00Z'));
  const old = JSON.parse(serialise(snapshot));
  for (const item of old.items) if (item.source === 'launchd') delete item.script;
  const checked = checkSnapshot(old);
  expect(checked).toHaveProperty('snapshot');
  const launchd = (checked as { snapshot: typeof snapshot }).snapshot.items.filter(item => item.source === 'launchd');
  expect(launchd.length).toBeGreaterThan(0);
  for (const item of launchd) expect(item).toMatchObject({ script: null });
});

test('Script of the wrong type', async () => {
  const snapshot = JSON.parse(serialise(await discover(virtualHost(), at('2026-10-21T07:30:00Z'))));
  snapshot.items.find((item: { source: string }) => item.source === 'launchd').script = 42;
  expect(checkSnapshot(snapshot)).toEqual({ problem: 'shape' });
});

test('Launchd item fields in order', async () => {
  const snapshot = await discover(virtualHost(), at('2026-10-21T07:30:00Z'));
  expect(Object.keys(snapshot.items.find(item => item.source === 'launchd')!)).toEqual(['source', 'id', 'versions', 'scope', 'path', 'program', 'script']);
});
