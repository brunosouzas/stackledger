/** Write the snapshot to <root>/<machine>/snapshot.json (design D4, discover-command spec): the only
 * place discovery writes.
 *
 * Steps: serialise first (over 32 MiB fails before any file system call); refuse a home folder that
 * group or others can write; check, or create with mode 0700 one level at a time, the snapshot root
 * and the machine folder (no link, a folder, owned by the user, no permission for group or others) and
 * remember their device and inode; refuse a snapshot.json that is not a regular file; create a new
 * temporary file with O_EXCL, O_NOFOLLOW and mode 0600; check the folders again; write, fsync, close;
 * check again; rename over snapshot.json. A reader sees the previous complete file or the new one;
 * two runs at once each rename a complete file and the last one wins.
 *
 * Threat model: this is a boundary against other users (they cannot write anything on the path). It
 * only detects a swap by the user's own processes: Node has no openat/renameat to close the window
 * between the last check and the rename. On a detected swap the temporary file is removed by its path
 * only while that path still leads to the file written; in a folder moved away it stays.
 *
 * Every call goes through WriteOps, so tests inject a swap at a chosen call. The shipped code always
 * uses NODE_WRITE_OPS. Failures throw InternalError (exit 1, one line).
 */
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, renameSync, statSync, unlinkSync, writeFileSync, type Stats } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { InternalError } from '../errors.js';
import { serialise, type Snapshot } from './snapshot.js';

export const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
export const SNAPSHOT_FILE = 'snapshot.json';
const PRIVATE_FOLDER = 0o700, PRIVATE_FILE = 0o600;
const WRITABLE_BY_OTHERS = 0o022, ANY_PERMISSION_FOR_OTHERS = 0o077;

export interface WriteOps {
  stat(path: string): Stats;
  lstat(path: string): Stats;
  mkdir(path: string, mode: number): void;
  open(path: string, flags: number, mode: number): number;
  fstat(fd: number): Stats;
  write(fd: number, text: string): void;
  fsync(fd: number): void;
  close(fd: number): void;
  rename(from: string, to: string): void;
  unlink(path: string): void;
}

export const NODE_WRITE_OPS: WriteOps = {
  stat: path => statSync(path),
  lstat: path => lstatSync(path),
  mkdir: (path, mode) => { mkdirSync(path, { mode }); },
  open: (path, flags, mode) => openSync(path, flags, mode),
  fstat: fd => fstatSync(fd),
  write: (fd, text) => writeFileSync(fd, text),
  fsync: fd => {
    // Under Node's permission model (`--permission`) fsync is refused even for a file the process may
    // write. The rename stays atomic without it; only durability after a power loss is lost, so that
    // one refusal is accepted on purpose and every other failure is reported.
    try { fsyncSync(fd); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ERR_ACCESS_DENIED') throw error; }
  },
  close: fd => closeSync(fd),
  rename: (from, to) => renameSync(from, to),
  unlink: path => unlinkSync(path),
};

const fail = (message: string) => new InternalError(`stackledger discover: ${message}`);
const code = (error: unknown) => (error as NodeJS.ErrnoException).code ?? 'unknown error';

interface Checked { path: string; dev: number; ino: number }

/** Check one snapshot folder, creating it when absent; refuses anything another user could change. */
function checkFolder(ops: WriteOps, path: string, label: string): Checked {
  let status: Stats;
  try { status = ops.lstat(path); } catch (error) {
    if (code(error) !== 'ENOENT') throw fail(`cannot read ${label} (${code(error)})`);
    // EEXIST: another run created it meanwhile; it is checked like any existing folder.
    try { ops.mkdir(path, PRIVATE_FOLDER); } catch (inner) { if (code(inner) !== 'EEXIST') throw fail(`cannot create ${label} (${code(inner)})`); }
    try { status = ops.lstat(path); } catch (inner) { throw fail(`cannot read ${label} (${code(inner)})`); }
  }
  if (status.isSymbolicLink()) throw fail(`${label} is a symbolic link; nothing was written`);
  if (!status.isDirectory()) throw fail(`${label} is not a folder; nothing was written`);
  if (status.uid !== process.getuid!()) throw fail(`${label} is not owned by the current user; nothing was written`);
  if (status.mode & ANY_PERMISSION_FOR_OTHERS) throw fail(`${label} must be private to the user (mode 0700); nothing was written`);
  return { path, dev: status.dev, ino: status.ino };
}

function unchanged(ops: WriteOps, folders: Checked[]): boolean {
  return folders.every(folder => {
    try {
      const status = ops.lstat(folder.path);
      return !status.isSymbolicLink() && status.isDirectory() && status.dev === folder.dev && status.ino === folder.ino;
    } catch { return false; }
  });
}

/** Remove the temporary file only while its path still leads to the file written. */
function removeTemporary(ops: WriteOps, path: string, ino: number | undefined): void {
  try {
    if (ino === undefined || ops.lstat(path).ino === ino) ops.unlink(path);
  } catch { /* Gone or moved away with its folder: there is nothing at this path to remove. */ }
}

/** Write the snapshot; returns the path of snapshot.json. */
export function writeSnapshot(snapshot: Snapshot, place: { home: string; root: string }, ops: WriteOps = NODE_WRITE_OPS): string {
  const text = serialise(snapshot);
  if (Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) throw fail('the snapshot is too large (over 32 MiB); nothing was written');
  let home: Stats;
  try { home = ops.stat(place.home); } catch (error) { throw fail(`cannot read the home folder (${code(error)})`); }
  if (home.mode & WRITABLE_BY_OTHERS) throw fail('the home folder can be written by group or others; nothing was written');
  const machine = join(place.root, snapshot.machine.name);
  const folders = [checkFolder(ops, place.root, 'the snapshot folder'), checkFolder(ops, machine, 'the machine folder')];
  const target = join(machine, SNAPSHOT_FILE);
  try {
    if (!ops.lstat(target).isFile()) throw fail(`${SNAPSHOT_FILE} is not a regular file; nothing was written`);
  } catch (error) { if (error instanceof InternalError) throw error; if (code(error) !== 'ENOENT') throw fail(`cannot read ${SNAPSHOT_FILE} (${code(error)})`); }

  const temporary = join(machine, `snapshot.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  let fd: number | undefined, ino: number | undefined;
  try { fd = ops.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, PRIVATE_FILE); }
  catch (error) { throw fail(`cannot create the snapshot file (${code(error)})`); }
  try {
    ino = ops.fstat(fd).ino;
    const swapped = () => fail('a snapshot folder changed while writing; the previous snapshot was kept');
    if (!unchanged(ops, folders)) throw swapped();
    ops.write(fd, text);
    ops.fsync(fd);
    ops.close(fd);
    fd = undefined;
    if (!unchanged(ops, folders)) throw swapped();
    ops.rename(temporary, target);
    return target;
  } catch (error) {
    removeTemporary(ops, temporary, ino);
    if (fd !== undefined) { try { ops.close(fd); } catch { /* The write already failed; that failure is reported. */ } }
    if (error instanceof InternalError) throw error;
    throw fail(`cannot write the snapshot (${code(error)}); the previous snapshot was kept`);
  }
}
