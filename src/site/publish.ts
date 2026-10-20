/** Atomic publication of a prepared build into the output folder, and recovery of a publication
 * that was interrupted (build-command, Atomic replace; design D8). Called by src/site/command.ts.
 *
 * Publication: for each entry `staff`, `full`, `_headers`, `robots.txt` and `.stackledger-build`, in
 * that order, the existing entry (if any) is renamed into `<staging>/old/`, then the new one is
 * renamed into place. Each rename is announced in the staging folder's journal (journal.ts) before
 * it happens. The rename of the marker is the commit point: a failure before it undoes the renames
 * in reverse, so the output folder is byte for byte what it was. Renames stay on one filesystem
 * because the staging folder is inside the output folder; none goes through a symbolic link.
 *
 * Recovery: an undo can itself fail (a folder made read-only during the build) or the process can
 * die mid-publication. The previous entries are then under `<staging>/old/`, and the journal says
 * so. clearStaging, run by the next build before anything else changes, finishes that undo from the
 * journal; only then, or when there is nothing to finish, does it remove old staging folders. When
 * the undo cannot be finished it throws and deletes nothing.
 *
 * Test-only faults: `step` makes the n-th rename (1-based) throw instead of renaming and `undo` the
 * n-th undo rename, so the integration tests can prove the undo and the recovery. Only the tests'
 * BuildFaults set them (see command.ts); the CLI never does.
 */
import { mkdirSync, readdirSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { InternalError } from '../errors.js';
import { appendRecord, interrupted, pendingMoves, readJournal, type JournalRecord, type Move } from './journal.js';
import { lstatOrUndefined, within } from './paths.js';
import { MARKER_NAME } from './policy.js';

/** Prefix of the staging folders inside the output folder. */
export const STAGING_PREFIX = '.stackledger-tmp-';

/** Folder of the staging folder that holds the entries a publication replaces. */
export const OLD_NAME = 'old';

/** Published entries, in publication order, with their place in the staging folder. The marker is last. */
export const ENTRIES: readonly { name: string; staged: string }[] = [
  { name: 'staff', staged: 'site-staff' },
  { name: 'full', staged: 'site-full' },
  { name: '_headers', staged: join('root', '_headers') },
  { name: 'robots.txt', staged: join('root', 'robots.txt') },
  { name: MARKER_NAME, staged: join('root', MARKER_NAME) },
];

export interface PublishFaults { step?: number; undo?: number }

/** Publish the staged entries into `out`. Throws (after undoing every rename) on a failure before the commit. */
export function publish(out: string, staging: string, faults: PublishFaults = {}): void {
  mkdirSync(join(staging, OLD_NAME));
  const done: Move[] = [];
  const move = (from: string, to: string): void => {
    const step: Move = { index: done.length + 1, from: relative(out, from), to: relative(out, to) };
    appendRecord(staging, { kind: 'move', ...step });
    if (step.index === faults.step) throw new Error(`injected failure at publication step ${faults.step}`);
    renameSync(from, to);
    done.push(step);
  };
  try {
    for (const entry of ENTRIES) {
      const target = join(out, entry.name);
      const existing = lstatOrUndefined(target);
      // Never rename through a link (command.ts refuses them before the build; this is the last check).
      if (existing?.isSymbolicLink()) throw new Error(`${target} is a symbolic link`);
      if (existing) move(target, join(staging, OLD_NAME, entry.name));
      move(join(staging, entry.staged), target);
    }
    appendRecord(staging, { kind: 'commit' });
  } catch (error) {
    undo(out, staging, done, faults.undo);
    throw error;
  }
}

/** Undo the renames of a failed publication, latest first, recording each in the journal. */
function undo(out: string, staging: string, done: readonly Move[], failAt: number | undefined): void {
  const failed: string[] = [];
  for (const [i, step] of [...done].reverse().entries()) {
    try {
      if (i + 1 === failAt) throw new Error(`injected failure at undo step ${failAt}`);
      renameSync(join(out, step.to), join(out, step.from));
      appendRecord(staging, { kind: 'unmoved', index: step.index });
    } catch (undoError) {
      failed.push(`${step.to}: ${(undoError as Error).message}`);
    }
  }
  if (failed.length) {
    throw new InternalError(`stackledger build: publication failed and could not be undone; the previous entries are in ${join(staging, OLD_NAME)} (${failed.join('; ')}); the next build into ${out} finishes the undo`);
  }
  appendRecord(staging, { kind: 'undone' });
}

/** The InternalError for a publication that cannot be finished: nothing is deleted. */
function stuck(out: string, staging: string, reason: string): InternalError {
  return new InternalError(`stackledger build: the publication interrupted in ${staging} could not be undone (${reason}); nothing was deleted. Move the entries in ${join(staging, OLD_NAME)} back into ${out} by hand, then remove ${staging}`);
}

/** A journal path, resolved inside the output folder; anything else is refused. */
function journalPath(out: string, staging: string, path: string): string {
  const absolute = resolve(out, path);
  if (absolute === out || !within(absolute, out)) throw stuck(out, staging, `the journal names a path outside the output folder: ${path}`);
  return absolute;
}

/** Finish the undo of the publication interrupted in `staging`, from its journal records. */
function recoverPublication(out: string, staging: string, records: readonly JournalRecord[]): void {
  for (const step of pendingMoves(records)) {
    const from = journalPath(out, staging, step.from);
    const to = journalPath(out, staging, step.to);
    const atFrom = lstatOrUndefined(from);
    const atTo = lstatOrUndefined(to);
    // Still at its old place: this rename never happened (or was put back by hand).
    if (atFrom && !atTo) continue;
    if (atFrom || !atTo) throw stuck(out, staging, `${step.from} and ${step.to} are not where the journal expects them`);
    try {
      renameSync(to, from);
      appendRecord(staging, { kind: 'unmoved', index: step.index });
    } catch (error) {
      throw stuck(out, staging, `${step.to}: ${(error as Error).message}`);
    }
  }
  appendRecord(staging, { kind: 'undone' });
}

/** The journal records of a staging folder; undefined for a link, a file or a folder without one. */
function journalOf(staging: string): JournalRecord[] | undefined {
  if (!lstatOrUndefined(staging)?.isDirectory()) return undefined;
  return readJournal(staging);
}

/** True when `staging` holds a publication that neither committed nor was undone. An unreadable
 * journal answers false here; clearStaging refuses that folder later. */
export function isInterrupted(staging: string): boolean {
  try {
    const records = journalOf(staging);
    return records !== undefined && interrupted(records);
  } catch {
    return false;
  }
}

/** Remove one staging entry without following links: a link or a file is unlinked, a folder removed. */
function removeEntry(path: string): void {
  if (lstatOrUndefined(path)?.isDirectory()) rmSync(path, { recursive: true, force: true });
  else unlinkSync(path);
}

/** The staging entries of `out` with their journal records; refuses (deleting nothing) an unreadable journal. */
function stagingEntries(out: string): { path: string; records: JournalRecord[] | undefined }[] {
  const names = readdirSync(out).filter(name => name.startsWith(STAGING_PREFIX)).sort();
  return names.map(name => {
    const path = join(out, name);
    try {
      return { path, records: journalOf(path) };
    } catch (error) {
      throw stuck(out, path, `its journal cannot be read: ${(error as Error).message}`);
    }
  });
}

/** Before a build: finish the publication an earlier build left interrupted, then remove every
 * staging folder. `beforeChange` runs before each rename or removal and may throw to stop.
 * Returns one report line per recovered publication. Throws, deleting nothing, when an interrupted
 * publication cannot be finished. */
export function clearStaging(out: string, beforeChange: () => void = () => {}): string[] {
  const stagings = stagingEntries(out);
  const open = stagings.filter(({ records }) => records !== undefined && interrupted(records));
  if (open.length > 1) {
    const paths = open.map(({ path }) => path).join(', ');
    throw new InternalError(`stackledger build: ${open.length} interrupted publications in ${out} (${paths}); nothing was deleted. Restore the earlier build from one of them by hand, then remove them`);
  }
  const notes: string[] = [];
  for (const { path, records } of open) {
    beforeChange();
    recoverPublication(out, path, records!);
    notes.push(`Note: finished undoing the publication interrupted in ${path}; the earlier build was restored first`);
  }
  for (const { path } of stagings) {
    beforeChange();
    removeEntry(path);
  }
  return notes;
}
