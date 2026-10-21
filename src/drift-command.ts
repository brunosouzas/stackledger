/** `stackledger drift <folder> [--snapshot <file>] [--format text|json]` (drift-command spec, design
 * D6). Called by src/cli.ts; run node dist/cli.js drift examples/northwind --snapshot
 * examples/northwind-machine/snapshot.json.
 *
 * Like `stackledger report`: usage, folder and snapshot problems throw a plain Error before anything
 * is written (exit 2 with usage, from src/cli.ts); a catalogue with errors is still compared, using the
 * components the `full` view serves, with the counts line of src/map/command.ts on stderr. The whole
 * output is built in memory first, so a failure while comparing or serialising leaves stdout empty and
 * exits 1 with one line; a failure while writing stdout (a closed pipe) also exits 1 with one line.
 *
 * The snapshot: `--snapshot <file>`, or this machine's ~/.stackledger/<machine>/snapshot.json, whose
 * machine name needs macOS and the sandbox (src/discovery/machine.ts through the sandboxed `scutil`).
 * It must be a regular file of at most 32 MiB holding a `stackledger-snapshot/v1` snapshot that passes
 * the consistency rules and the secret guard (src/discovery/snapshot.ts). Every reason is a fixed text:
 * never the file's path or content.
 *
 * Only reads: the catalogue folder and the snapshot. `host` exists for the tests
 * (test/integration/drift-entry.mjs); src/cli.ts passes nothing, so the shipped command reads the real machine.
 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { internal } from './errors.js';
import { createHost, type Host } from './discovery/host.js';
import { machineName } from './discovery/machine.js';
import { checkSnapshot, type Snapshot } from './discovery/snapshot.js';
import { buildDrift } from './drift.js';
import { formatDriftJson, formatDriftText } from './drift-formats.js';
import { problemCounts } from './map/command.js';
import { loadFolder } from './source.js';
import { writeStdout } from './stdout.js';
import { validateLoaded } from './validate.js';
import { applyView, resolveHidden } from './views.js';

export const DRIFT_USAGE = 'Usage: stackledger drift <folder> [--snapshot <file>] [--format text|json]\n';
export const DRIFT_FORMATS = ['text', 'json'] as const;
type DriftFormat = typeof DRIFT_FORMATS[number];
export const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;

interface DriftArgs { folder: string; snapshot: string | undefined; format: DriftFormat }

function parseDriftArgs(args: string[]): DriftArgs {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true,
    options: { snapshot: { type: 'string' }, format: { type: 'string' } } });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  const format = values.format ?? 'text';
  if (!DRIFT_FORMATS.includes(format as DriftFormat)) throw new Error(`Unknown format; allowed formats: ${DRIFT_FORMATS.join(', ')}`);
  return { folder, snapshot: values.snapshot, format: format as DriftFormat };
}

/** This machine's snapshot path; its name can only be found on macOS with the sandbox. */
async function defaultSnapshotPath(host: Host): Promise<string> {
  if (host.platform !== 'darwin' || !(await host.isFile(host.sandbox))) {
    throw new Error("This machine's name cannot be found (it needs macOS and its sandbox); pass --snapshot <file>");
  }
  return join(host.snapshotRoot, await machineName(host.run), 'snapshot.json');
}

const SNAPSHOT_PROBLEMS = {
  format: 'The snapshot format is not supported; expected stackledger-snapshot/v1',
  shape: 'The snapshot does not have the stackledger-snapshot/v1 shape',
  consistency: 'The snapshot is not consistent',
} as const;

/** A snapshot that cannot be used: a usage error (exit 2) whose message is a fixed text. */
class SnapshotProblem extends Error {}

/** Read the snapshot's bytes: a regular file of at most 32 MiB. */
async function readSnapshotBytes(path: string): Promise<Buffer> {
  let handle;
  // O_NONBLOCK: a FIFO in place of the file must not block the open; it is refused as not a regular file.
  try { handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') throw new SnapshotProblem('No snapshot found; run stackledger discover to make one, or pass --snapshot <file>');
    throw new SnapshotProblem('The snapshot cannot be read');
  }
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new SnapshotProblem('The snapshot is not a regular file');
    if (status.size > MAX_SNAPSHOT_BYTES) throw new SnapshotProblem('The snapshot is larger than 32 MiB');
    // Room for one byte more than the size: a file that grew after the stat is refused, not cut.
    const buffer = Buffer.alloc(status.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > status.size) throw new SnapshotProblem('The snapshot changed while it was read');
    return buffer.subarray(0, length);
  } catch (error) {
    throw error instanceof SnapshotProblem ? error : new SnapshotProblem('The snapshot cannot be read');
  } finally {
    await handle.close();
  }
}

/** Read and check the snapshot; every failure is a usage error with a fixed reason. */
async function readSnapshot(path: string): Promise<Snapshot> {
  const bytes = await readSnapshotBytes(path);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new SnapshotProblem('The snapshot is not JSON'); }
  const checked = checkSnapshot(value);
  if ('snapshot' in checked) return checked.snapshot;
  if (checked.problem === 'secret') throw new SnapshotProblem(`The snapshot breaks a secret rule: ${checked.rule}`);
  throw new SnapshotProblem(SNAPSHOT_PROBLEMS[checked.problem]);
}

export async function driftCommand(args: string[], host: Host = createHost()): Promise<void> {
  if (args.includes('--help')) { await writeStdout(DRIFT_USAGE, 'stackledger drift: cannot write to stdout'); return; }
  const options = parseDriftArgs(args);
  const loaded = await loadFolder(resolve(options.folder));
  const snapshot = await readSnapshot(options.snapshot === undefined ? await defaultSnapshotPath(host) : resolve(options.snapshot));
  const catalogue = validateLoaded(loaded);

  // Arguments, the folder and the snapshot are checked above: a failure from here on is exit 1, never usage.
  let output: string;
  try {
    const drift = buildDrift(snapshot, applyView(catalogue.served, 'full', resolveHidden(catalogue)).components);
    output = options.format === 'json' ? formatDriftJson(drift) : formatDriftText(drift);
  } catch (error) {
    throw internal('drift', error);
  }
  const counts = problemCounts('drift', catalogue);
  if (counts.length) process.stderr.write(`${counts.join('\n')}\n`);
  await writeStdout(output, 'stackledger drift: cannot write the result to stdout');
}
