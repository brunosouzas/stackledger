/** Path checks shared by the build command (command.ts) and the publication (publish.ts).
 *
 * Why one module: both decide whether a path is inside the output folder, look at entries without
 * following symbolic links, and re-check that the output folder is still the folder validated.
 *
 * Limit: Node.js has no directory handles (no openat, no O_NOFOLLOW on folders), so the build works
 * on path strings. FolderIdentity narrows the gap: the output folder's real path and its device and
 * inode numbers are recorded once validated and compared again immediately before each change.
 * Another process that renames the output folder or a parent between a check and the next change is
 * outside what this can catch; docs/site.md (Security) states that trust.
 */
import type { Stats } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { InternalError } from '../errors.js';
import { NODE_FS, type FsOps } from './fs-ops.js';

/** True when `child` is `parent` or inside it (both absolute paths). Only a `..` segment leaves
 * `parent`: a child named `..review-probe` is inside it. */
export function within(child: string, parent: string): boolean {
  const path = relative(parent, child);
  const outside = path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
  return !outside;
}

/** The entry's own status (a link is not followed), or undefined when nothing is there. */
export function lstatOrUndefined(path: string, ops: FsOps = NODE_FS): Stats | undefined {
  try {
    return ops.lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** What makes the output folder the one the build validated: its real path, device and inode. */
export interface FolderIdentity { path: string; real: string; dev: number; ino: number }

/** The identity of the folder at `path`, which must be a real folder, not a link. */
export function folderIdentity(path: string, ops: FsOps = NODE_FS): FolderIdentity {
  const stats = ops.lstat(path);
  if (!stats.isDirectory()) throw new InternalError(`stackledger build: the output folder ${path} is not a folder`);
  return { path, real: ops.realpath(path), dev: stats.dev, ino: stats.ino };
}

/** The output folder is no longer the one the build validated. Callers stop at once, even an undo. */
export class FolderChanged extends InternalError {}

/** Throw FolderChanged, before any further change, when the folder at `expected.path` is no longer
 * the same one: moved, replaced by another folder, or replaced by a link (a parent included). */
export function assertSameFolder(expected: FolderIdentity, ops: FsOps = NODE_FS): void {
  let now: FolderIdentity | undefined;
  try {
    now = folderIdentity(expected.path, ops);
  } catch {
    // Missing, unreadable or not a folder: in every case not the folder the build validated.
    now = undefined;
  }
  const same = now !== undefined && now.real === expected.real && now.dev === expected.dev && now.ino === expected.ino;
  if (!same) {
    throw new FolderChanged(`stackledger build: the output folder ${expected.path} was moved or replaced during the build; stopped without further changes`);
  }
}
