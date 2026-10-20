/** Atomic publication of a prepared build into the output folder (build-command, Atomic replace;
 * design D8). Called by src/site/command.ts after prepareBuild has filled the staging folder.
 *
 * What: for each entry `staff`, `full`, `_headers`, `robots.txt` and `.stackledger-build`, in that
 * order, the existing entry (if any) is renamed into `<staging>/old/`, then the new one is renamed
 * into place. Every rename is recorded. The rename of the marker is the commit point: a failure
 * before it undoes the recorded renames in reverse, so the output folder is byte for byte what it
 * was. Renames stay on one filesystem because the staging folder is inside the output folder.
 *
 * Test-only hook: `failAt` makes the n-th rename (1-based) throw instead of renaming, so the
 * integration tests can prove the undo at every step. The command sets it only from the
 * STACKLEDGER_TEST_FAIL environment variable (see command.ts); nothing else uses it.
 *
 * What can go wrong: an undo rename can itself fail (for example a folder made read-only during
 * the build). Then the error says where the previous entries are, and the staging folder is kept.
 */
import { lstatSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { InternalError } from '../errors.js';
import { MARKER_NAME } from './policy.js';

/** Prefix of the staging folders inside the output folder. */
export const STAGING_PREFIX = '.stackledger-tmp-';

/** Published entries, in publication order, with their place in the staging folder. The marker is last. */
export const ENTRIES: readonly { name: string; staged: string }[] = [
  { name: 'staff', staged: 'site-staff' },
  { name: 'full', staged: 'site-full' },
  { name: '_headers', staged: join('root', '_headers') },
  { name: 'robots.txt', staged: join('root', 'robots.txt') },
  { name: MARKER_NAME, staged: join('root', MARKER_NAME) },
];

interface Step { from: string; to: string }

function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Remove staging folders left by a build that crashed; only folders whose name has the staging prefix. */
export function removeStaleStaging(out: string): void {
  for (const entry of readdirSync(out, { withFileTypes: true })) {
    if (entry.name.startsWith(STAGING_PREFIX)) rmSync(join(out, entry.name), { recursive: true, force: true });
  }
}

/** Publish the staged entries into `out`. Throws (after undoing every rename) on a failure before the commit. */
export function publish(out: string, staging: string, failAt?: number): void {
  const old = join(staging, 'old');
  mkdirSync(old);
  const done: Step[] = [];
  const move = (from: string, to: string): void => {
    if (done.length + 1 === failAt) throw new Error(`injected failure at publication step ${failAt}`);
    renameSync(from, to);
    done.push({ from, to });
  };
  try {
    for (const entry of ENTRIES) {
      const target = join(out, entry.name);
      if (exists(target)) move(target, join(old, entry.name));
      move(join(staging, entry.staged), target);
    }
  } catch (error) {
    const failed: string[] = [];
    for (const step of done.reverse()) {
      try {
        renameSync(step.to, step.from);
      } catch (undoError) {
        failed.push(`${step.to}: ${(undoError as Error).message}`);
      }
    }
    if (failed.length) {
      throw new InternalError(`stackledger build: publication failed and could not be undone; the previous entries are in ${old} (${failed.join('; ')})`);
    }
    throw error;
  }
}
