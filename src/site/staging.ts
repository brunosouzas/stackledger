/** Staging folders left in the output folder by earlier builds (build-command, Interrupted
 * publication; design D8). Called by src/site/command.ts before anything changes.
 *
 * A staging folder `<out>/.stackledger-tmp-*` gets an `old/` folder just before publication's first
 * rename (publish.ts). So a staging folder without `old/` holds only fresh output from a build that
 * crashed or failed before publishing, and is removed. One with `old/` may hold the only copy of the
 * previous build: the command refuses the whole output folder (exit 1), changes nothing and points
 * to the manual restore in docs/site.md. stackledger never moves entries back by itself: code review
 * showed that automatic recovery from what a staging folder says is itself a way to lose the site.
 *
 * Nothing here follows a symbolic link: every entry is looked at with lstat, a `.stackledger-tmp-*`
 * entry that is a link or a file is refused (exit 2), and a folder is removed with rm, which removes
 * links inside it without following them. An `old` entry that cannot be looked at counts as present.
 */
import { basename, join } from 'node:path';
import { InternalError } from '../errors.js';
import { NODE_FS, type FsOps } from './fs-ops.js';
import { assertSameFolder, lstatOrUndefined, type FolderIdentity } from './paths.js';

/** Prefix of the staging folders inside the output folder. */
export const STAGING_PREFIX = '.stackledger-tmp-';

/** Folder of the staging folder that holds the entries a publication replaces. */
export const OLD_NAME = 'old';

/** Where a reader learns to restore an output folder by hand. */
export const RESTORE_GUIDE = 'docs/site.md, section "Restoring after a failed publication"';

/** What a `.stackledger-tmp-*` entry is: removable, a kept publication, or not ours to touch. */
type StagingState = 'stale' | 'publication' | 'not-a-folder' | 'gone';

/** True unless `staging` certainly has no `old` entry (of any kind: folder, file or link). */
function hasOld(staging: string, ops: FsOps): boolean {
  try {
    ops.lstat(join(staging, OLD_NAME));
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

function stagingState(path: string, ops: FsOps): StagingState {
  const stats = lstatOrUndefined(path, ops);
  if (!stats) return 'gone';
  if (!stats.isDirectory()) return 'not-a-folder';
  return hasOld(path, ops) ? 'publication' : 'stale';
}

/** The staging folders among `names` (the entries of `out`) that a build may remove. Throws,
 * changing nothing, an InternalError (exit 1) when one holds `old/`, or a usage error (exit 2) when
 * a `.stackledger-tmp-*` entry is a link or not a folder. */
export function staleStaging(out: string, names: readonly string[], ops: FsOps = NODE_FS): string[] {
  const paths = names.filter(name => name.startsWith(STAGING_PREFIX)).sort().map(name => join(out, name));
  const states = paths.map(path => ({ path, state: stagingState(path, ops) }));
  const kept = states.find(({ state }) => state === 'publication');
  if (kept) {
    throw new InternalError(`stackledger build: ${kept.path} holds entries that an earlier publication replaced (its ${OLD_NAME}/ folder); nothing was changed. Restore them by hand as ${RESTORE_GUIDE} explains, then remove that folder`);
  }
  const foreign = states.find(({ state }) => state === 'not-a-folder');
  if (foreign) {
    throw new Error(`Output folder entry ${basename(foreign.path)} is a symbolic link or not a folder; stackledger build removes only its own staging folders, so remove it by hand`);
  }
  return states.filter(({ state }) => state === 'stale').map(({ path }) => path);
}

/** Remove the stale staging folders found by staleStaging. Each is looked at again, and the output
 * folder's identity checked, immediately before its removal. */
export function removeStaging(paths: readonly string[], identity: FolderIdentity, ops: FsOps = NODE_FS): void {
  for (const path of paths) {
    const state = stagingState(path, ops);
    if (state === 'gone') continue;
    if (state !== 'stale') throw new InternalError(`stackledger build: ${path} changed during the build; stopped without further changes`);
    assertSameFolder(identity, ops);
    ops.rm(path);
  }
}
