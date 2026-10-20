/** Atomic publication of a prepared build into the output folder (build-command, Atomic replace and
 * Interrupted publication; design D8). Called by src/site/command.ts.
 *
 * For each entry `staff`, `full`, `_headers`, `robots.txt` and `.stackledger-build`, in that order,
 * the existing entry (if any) is renamed into `<staging>/old/`, then the new one is renamed into
 * place. `old/` is created just before the first rename, so a staging folder without it never held
 * a published entry (staging.ts). The renames done are recorded in memory only. The rename of the
 * marker is the commit point: a failure before it undoes the renames in reverse, so the output
 * folder is byte for byte what it was. Renames stay on one filesystem because the staging folder is
 * inside the output folder, and none goes through a symbolic link.
 *
 * The output folder's identity (paths.ts) is checked immediately before creating `old/` and before
 * every rename, the undo's included. A mismatch (FolderChanged) stops at once: no further rename,
 * not even to undo, because the paths may now lead somewhere else.
 *
 * What can go wrong: an undo rename can fail too (a folder made read-only meanwhile). The undo then
 * stops and throws UndoFailed; the previous entries are in `<staging>/old/`, the command keeps the
 * staging folder and the person running the build restores them by hand (RESTORE_GUIDE).
 */
import { join } from 'node:path';
import { InternalError } from '../errors.js';
import { NODE_FS, type FsOps } from './fs-ops.js';
import { assertSameFolder, FolderChanged, lstatOrUndefined, type FolderIdentity } from './paths.js';
import { MARKER_NAME } from './policy.js';
import { OLD_NAME, RESTORE_GUIDE } from './staging.js';

/** Published entries, in publication order, with their place in the staging folder. The marker is last. */
export const ENTRIES: readonly { name: string; staged: string }[] = [
  { name: 'staff', staged: 'site-staff' },
  { name: 'full', staged: 'site-full' },
  { name: '_headers', staged: join('root', '_headers') },
  { name: 'robots.txt', staged: join('root', 'robots.txt') },
  { name: MARKER_NAME, staged: join('root', MARKER_NAME) },
];

/** A publication failed and its undo failed too: the staging folder must be kept. */
export class UndoFailed extends InternalError {}

interface Move { from: string; to: string }

/** Publish the staged entries of `staging` into `out`. On a failure before the commit, undo every
 * rename and rethrow; throws FolderChanged or UndoFailed when that is not possible. */
export function publish(out: string, staging: string, identity: FolderIdentity, ops: FsOps = NODE_FS): void {
  const done: Move[] = [];
  const move = (from: string, to: string): void => {
    assertSameFolder(identity, ops);
    ops.rename(from, to);
    done.push({ from, to });
  };
  try {
    assertSameFolder(identity, ops);
    ops.mkdir(join(staging, OLD_NAME));
    for (const entry of ENTRIES) {
      const target = join(out, entry.name);
      const existing = lstatOrUndefined(target, ops);
      // Never rename through a link (command.ts refuses them before the build; this is the last check).
      if (existing?.isSymbolicLink()) throw new Error(`${target} is a symbolic link`);
      if (existing) move(target, join(staging, OLD_NAME, entry.name));
      move(join(staging, entry.staged), target);
    }
  } catch (error) {
    if (error instanceof FolderChanged) throw error;
    undo(staging, done, identity, ops, error);
    throw error;
  }
}

/** Put back the renames in `done`, latest first. Stops at the first failure: the remaining entries
 * stay where they are, which is the state the manual restore in docs/site.md starts from. */
function undo(staging: string, done: readonly Move[], identity: FolderIdentity, ops: FsOps, cause: unknown): void {
  for (const step of [...done].reverse()) {
    assertSameFolder(identity, ops);
    try {
      ops.rename(step.to, step.from);
    } catch (error) {
      throw new UndoFailed(undoFailedMessage(staging, cause, error));
    }
  }
}

function undoFailedMessage(staging: string, cause: unknown, error: unknown): string {
  const reason = (value: unknown) => (value instanceof Error ? value.message : String(value)).replace(/\s+/g, ' ').trim();
  return `stackledger build: publication failed (${reason(cause)}) and could not be undone (${reason(error)}); `
    + `the previous entries are in ${join(staging, OLD_NAME)}. The staging folder ${staging} was kept: `
    + `restore by hand as ${RESTORE_GUIDE} explains; until that folder is removed, stackledger build refuses this output folder`;
}
