/** `stackledger drift <folder> [--snapshot <file>] [--format text|json] [--scaffold <dir>]`
 * (drift-command spec, design D6 and D10). Called by src/cli.ts; run node dist/cli.js drift examples/northwind --snapshot
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
 * Without `--scaffold` it only reads the catalogue folder and the snapshot. With `--scaffold <dir>` it
 * also writes the draft files of src/scaffold.ts, and only there: `dir` must not exist yet and must be
 * neither inside the catalogue folder nor contain it (real paths compared; a usage error otherwise).
 * Every folder on the real path of its parent, from / down to the parent, must not be writable by group
 * or others unless it has the sticky bit (as /tmp has), and must be owned by the user or root: otherwise
 * another user could swap `dir`, or the parent, for a link (usage error). Everything is built and
 * checked in memory first; then `dir` is created with an exclusive mkdir (no `recursive`, so a folder
 * created meanwhile is exit 2) and mode 0700, and its device and inode are remembered, as
 * src/discovery/write.ts does for the snapshot folders. The real path of the folder made must be the
 * one checked and outside the catalogue, else it is removed (still that folder and empty) and the
 * command exits 1: the parent was replaced after the checks. Before each file is created
 * (`wx`, mode 0644) and before stdout, `dir` must still be that folder and no link, else exit 1. A
 * failed write exits 1 with one line and removes what this run created: each file whose exclusive
 * create succeeded and that lstat still finds as a regular file with the device and inode its
 * descriptor had (so a file another process put there, before or after, is kept), then `dir` when it is
 * still the folder made (checked again right before the rmdir) and empty. Like write.ts this only detects a swap by the user's own
 * processes: Node has no openat to close the window between the check and the create.
 *
 * `host` and `ops` exist for the tests (test/integration/drift-entry.mjs); src/cli.ts passes nothing,
 * so the shipped command reads the real machine and writes through node:fs.
 */
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync, rmdirSync, unlinkSync, writeFileSync, type Stats } from 'node:fs';
import { open } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { InternalError, internal } from './errors.js';
import { createHost, type Host } from './discovery/host.js';
import { machineName } from './discovery/machine.js';
import { checkSnapshot, type Snapshot } from './discovery/snapshot.js';
import { MAX_SNAPSHOT_BYTES, sameFolder, WRITABLE_BY_OTHERS } from './discovery/write.js';
import { buildDrift } from './drift.js';
import { formatDriftJson, formatDriftText } from './drift-formats.js';
import { problemCounts } from './map/command.js';
import { buildScaffold, checkScaffold, type ScaffoldFile } from './scaffold.js';
import { loadFolder, type Loaded } from './source.js';
import { writeStdout } from './stdout.js';
import { validateLoaded } from './validate.js';
import { applyView, resolveHidden } from './views.js';

export const DRIFT_USAGE = 'Usage: stackledger drift <folder> [--snapshot <file>] [--format text|json] [--scaffold <dir>]\n';
export const DRIFT_FORMATS = ['text', 'json'] as const;
type DriftFormat = typeof DRIFT_FORMATS[number];

interface DriftArgs { folder: string; snapshot: string | undefined; format: DriftFormat; scaffold: string | undefined }

/** The file system calls of `--scaffold` (as src/site/fs-ops.ts does for build), so tests can inject a
 * failure or a folder created between the checks and the mkdir. Synchronous; each throws what node:fs throws. */
export interface ScaffoldOps {
  lstat(path: string): Stats;
  realpath(path: string): string;
  /** Create one folder, failing with EEXIST when it exists (never recursive). */
  mkdir(path: string): void;
  /** Create a new file exclusively (`wx`, mode 0644), failing with EEXIST when it exists; returns its
   * descriptor and the device and inode the descriptor has (fstat), closing it when fstat fails. */
  create(path: string): { fd: number; dev: number; ino: number };
  /** Write all of the text to a descriptor from `create`, then close it (also when the write fails). */
  write(fd: number, text: string): void;
  unlink(path: string): void;
  rmdir(path: string): void;
}
export const NODE_SCAFFOLD_OPS: ScaffoldOps = {
  lstat: path => lstatSync(path),
  realpath: path => realpathSync.native(path),
  mkdir: path => { mkdirSync(path, { mode: 0o700 }); },
  create: path => {
    const fd = openSync(path, 'wx', 0o644);
    try { const { dev, ino } = fstatSync(fd); return { fd, dev, ino }; } catch (error) { closeSync(fd); throw error; }
  },
  write: (fd, text) => { try { writeFileSync(fd, text); } finally { closeSync(fd); } },
  unlink: path => unlinkSync(path),
  rmdir: path => rmdirSync(path),
};
const code = (error: unknown) => (error as NodeJS.ErrnoException).code ?? 'unknown';
const STICKY = 0o1000, ROOT = 0;

function parseDriftArgs(args: string[]): DriftArgs {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true,
    options: { snapshot: { type: 'string' }, format: { type: 'string' }, scaffold: { type: 'string' } } });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  const format = values.format ?? 'text';
  if (!DRIFT_FORMATS.includes(format as DriftFormat)) throw new Error(`Unknown format; allowed formats: ${DRIFT_FORMATS.join(', ')}`);
  if (values.scaffold === '') throw new Error('--scaffold needs a folder');
  return { folder, snapshot: values.snapshot, format: format as DriftFormat, scaffold: values.scaffold };
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

/** Where `--scaffold` writes: the real path it will create and the catalogue's real path. */
interface ScaffoldPlace { target: string; catalogueReal: string }

/** The folders from `/` down to `folder` (a real path), the root first. */
function foldersDownTo(folder: string): string[] {
  const chain: string[] = [];
  for (let current = folder; ; current = dirname(current)) {
    chain.unshift(current);
    if (dirname(current) === current) return chain;
  }
}

/** Whether `target` is the catalogue, inside it, or contains it (real paths). */
function overlapsCatalogue(target: string, catalogueReal: string): 'inside' | 'contains' | undefined {
  if (target === catalogueReal || target.startsWith(catalogueReal + sep)) return 'inside';
  return catalogueReal.startsWith(target + sep) ? 'contains' : undefined;
}

/** The real path `--scaffold` will create; usage errors when it exists, is inside the catalogue or contains
 * it, or when another user could change a folder on the way to it. */
function scaffoldTarget(dir: string, catalogueFolder: string, ops: ScaffoldOps): ScaffoldPlace {
  const absolute = resolve(dir);
  let exists = true;
  try { ops.lstat(absolute); } catch (error) {
    if (code(error) !== 'ENOENT') throw new Error('The scaffold folder cannot be checked');
    exists = false;
  }
  if (exists) throw new Error('The scaffold folder already exists; name a new folder');
  let parent: string;
  try { parent = ops.realpath(dirname(absolute)); } catch { throw new Error('The folder that should hold the scaffold folder was not found'); }
  // Another user who can write the parent could replace the new folder with a link, and one who can
  // write any folder above it could replace the parent itself before the mkdir; so every folder on the
  // parent's real path, from / down, must be the user's or root's and closed to others. The sticky
  // bit (as on /tmp) stops other users renaming or removing a folder they do not own.
  for (const folder of foldersDownTo(parent)) {
    const which = folder === parent ? 'The folder that should hold the scaffold folder' : 'A folder above the one that should hold the scaffold folder';
    let status: Stats;
    try { status = ops.lstat(folder); } catch { throw new Error(`${which} cannot be checked`); }
    if ((status.mode & WRITABLE_BY_OTHERS) && !(status.mode & STICKY)) throw new Error(`${which} can be written by other users; name a folder in a private place`);
    if (status.uid !== process.getuid!() && status.uid !== ROOT) throw new Error(`${which} is not owned by the current user or root; name a folder in a private place`);
  }
  const target = join(parent, basename(absolute)), catalogueReal = ops.realpath(catalogueFolder);
  const overlap = overlapsCatalogue(target, catalogueReal);
  if (overlap === 'inside') throw new Error('The scaffold folder must be outside the catalogue folder');
  if (overlap === 'contains') throw new Error('The scaffold folder must not contain the catalogue folder');
  return { target, catalogueReal };
}

/** Every `metadata.name` of a catalogue document whose kind is Component, errors or not. */
function componentNames(loaded: Loaded): string[] {
  return loaded.sources.flatMap(source => {
    const metadata = source.value.metadata as Record<string, unknown> | null | undefined;
    const name = metadata !== null && typeof metadata === 'object' ? metadata.name : undefined;
    return source.value.kind === 'Component' && typeof name === 'string' ? [name] : [];
  });
}

/** A swap of the scaffold folder seen during the write (exit 1). */
class FolderReplaced extends InternalError {
  constructor() { super('stackledger drift: the scaffold folder was replaced while writing; the command stopped and wrote nothing through the new path'); }
}

/** Create `target` and write every file in it; on a failure remove what was written, then throw. */
function writeScaffold({ target, catalogueReal }: ScaffoldPlace, files: ScaffoldFile[], ops: ScaffoldOps): void {
  try { ops.mkdir(target); } catch (error) {
    if (code(error) === 'EEXIST') throw new Error('The scaffold folder already exists; name a new folder');
    throw new InternalError(`stackledger drift: cannot create the scaffold folder (${code(error)})`);
  }
  // The folder just made, by device and inode; every later step first checks `target` still is it.
  let folder: { dev: number; ino: number };
  try {
    const status = ops.lstat(target);
    if (!status.isDirectory() || status.isSymbolicLink()) throw new FolderReplaced();
    folder = { dev: status.dev, ino: status.ino };
  } catch (error) {
    if (error instanceof FolderReplaced) throw error;
    throw new InternalError(`stackledger drift: cannot check the scaffold folder (${code(error)})`);
  }
  // A parent swapped for a link between the checks and the mkdir puts the new folder somewhere else,
  // possibly in the catalogue: its real path must be the one checked. Otherwise the folder this run
  // made is removed by its real path, only while it is still that folder (rmdir keeps a non-empty one).
  let real: string | undefined;
  try { real = ops.realpath(target); } catch { real = undefined; }
  if (real !== target || overlapsCatalogue(real, catalogueReal) !== undefined) {
    let removed = false;
    if (real !== undefined) {
      try { if (sameFolder(ops.lstat(real), folder)) { ops.rmdir(real); removed = true; } } catch { removed = false; }
    }
    throw new InternalError(`stackledger drift: the folder that holds the scaffold folder was replaced before it was created; ${removed ? 'the folder made was removed and nothing was written' : 'nothing was written, but the folder made could not be removed'}`);
  }
  const stillOurs = () => { try { return sameFolder(ops.lstat(target), folder); } catch { return false; } };
  // Only files whose exclusive create succeeded, with the device and inode their descriptor had: a
  // file that was already there (EEXIST) or was put in place of one later is not this run's to remove.
  const created: { path: string; dev: number; ino: number }[] = [];
  try {
    for (const file of files) {
      if (!stillOurs()) throw new FolderReplaced();
      const path = join(target, file.file);
      const { fd, dev, ino } = ops.create(path);
      created.push({ path, dev, ino });
      ops.write(fd, file.text);
    }
    if (!stillOurs()) throw new FolderReplaced();
  } catch (error) {
    // Created files may be partly written; one already gone needs no removal. A replaced folder is
    // not this run's: it is left alone, and so is whatever its path now leads to.
    if (!stillOurs()) throw error instanceof FolderReplaced ? error : new FolderReplaced();
    for (const file of created) {
      try {
        const status = ops.lstat(file.path);
        if (status.isFile() && status.dev === file.dev && status.ino === file.ino) ops.unlink(file.path);
      } catch { /* already gone: nothing to remove */ }
    }
    // `dir` is checked again right before the rmdir: the removals above take time, and a folder put at
    // its path meanwhile is not this run's. rmdir removes only an empty folder: one still holding
    // another process's file is kept.
    let removed = stillOurs();
    if (removed) { try { ops.rmdir(target); } catch { removed = false; } }
    throw new InternalError(`stackledger drift: cannot write the scaffold files (${code(error)}); ${removed ? 'nothing was kept' : 'the scaffold folder could not be removed'}`);
  }
}

const leftOutLine = (count: number) => `stackledger drift: ${count} scaffold ${count === 1 ? 'file was' : 'files were'} left out because ${count === 1 ? 'it has' : 'they have'} errors; run stackledger validate on the drafts for details`;

export async function driftCommand(args: string[], host: Host = createHost(), ops: ScaffoldOps = NODE_SCAFFOLD_OPS): Promise<void> {
  if (args.includes('--help')) { await writeStdout(DRIFT_USAGE, 'stackledger drift: cannot write to stdout'); return; }
  const options = parseDriftArgs(args);
  const folder = resolve(options.folder);
  const loaded = await loadFolder(folder);
  const snapshot = await readSnapshot(options.snapshot === undefined ? await defaultSnapshotPath(host) : resolve(options.snapshot));
  const target = options.scaffold === undefined ? undefined : scaffoldTarget(options.scaffold, folder, ops);
  const catalogue = validateLoaded(loaded);

  // Arguments, the folder, the snapshot and the scaffold folder are checked above: a failure from
  // here on is exit 1, never usage (apart from a scaffold folder created meanwhile).
  let output: string;
  let scaffold: { files: ScaffoldFile[]; leftOut: number } | undefined;
  try {
    const drift = buildDrift(snapshot, applyView(catalogue.served, 'full', resolveHidden(catalogue)).components);
    output = options.format === 'json' ? formatDriftJson(drift) : formatDriftText(drift);
    if (target !== undefined) scaffold = checkScaffold(buildScaffold(drift, snapshot, componentNames(loaded)));
  } catch (error) {
    throw internal('drift', error);
  }
  if (target !== undefined) writeScaffold(target, scaffold!.files, ops);
  const notes = problemCounts('drift', catalogue);
  if (scaffold?.leftOut) notes.push(leftOutLine(scaffold.leftOut));
  if (notes.length) process.stderr.write(`${notes.join('\n')}\n`);
  await writeStdout(output, 'stackledger drift: cannot write the result to stdout');
}
