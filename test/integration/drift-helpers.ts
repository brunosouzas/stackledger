/** Catalogues, snapshot files and runs for the drift integration and performance tests. Build first
 * (npm run build).
 *
 * `driftRun` runs the real CLI (dist/cli.js); `driftEntry` runs test/integration/drift-entry.mjs, which
 * calls driftCommand with a host built from a JSON file (fake programs, a temporary snapshot root) and
 * optional faults in the scaffold writes, so the default-snapshot and fault scenarios run on any
 * platform without touching the real ~/.stackledger. Every folder is temporary (test/helpers.ts).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { serialise, type Snapshot } from '../../src/discovery/snapshot.js';
import { folder } from '../helpers.js';
import { run } from './helpers.js';

export const driftEntry = fileURLToPath(new URL('./drift-entry.mjs', import.meta.url));

/** A catalogue folder with the given documents in one file. */
export const catalogue = (...documents: unknown[]) => folder({ 'catalog-info.yaml': documents.map(document => stringify(document)).join('---\n') });

/** The snapshot serialised as discover writes it, in a temporary folder; returns its path. */
export function snapshotFile(snapshot: Snapshot | unknown): string {
  const path = join(folder(), 'snapshot.json');
  writeFileSync(path, typeof snapshot === 'string' ? snapshot : serialise(snapshot as Snapshot));
  return path;
}

/** Write the snapshot where the default path of `machine` under `snapshotRoot` leads. */
export function defaultSnapshot(snapshotRoot: string, machine: string, snapshot: Snapshot): string {
  const dir = join(snapshotRoot, machine);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, 'snapshot.json');
  writeFileSync(path, serialise(snapshot), { mode: 0o600 });
  return path;
}

export const driftRun = (args: string[], flags: string[] = []) => run(['drift', ...args], undefined, flags);

/** Run drift through the entry script with `config` ({ host, faults }, see drift-entry.mjs). */
export function driftEntryRun(config: Record<string, unknown>, args: string[]) {
  const file = join(folder(), 'config.json');
  writeFileSync(file, JSON.stringify(config));
  const result = spawnSync(process.execPath, [driftEntry, file, 'drift', ...args], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
  if (result.error) throw result.error;
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}
