/** Test-only FsOps wrapper (src/site/fs-ops.ts): fails or swaps the output folder at chosen calls.
 *
 * Why: the build must restore the output folder after any failure before the commit, and stop as
 * soon as the output folder is no longer the one it validated. The shipped code has no test hook;
 * the tests pass this wrapper as the `ops` argument instead (in process for publish.ts and
 * staging.ts, through test/integration/build-with-faults.mjs for the whole command).
 *
 * Plan (all optional except `out`):
 *   out              the output folder: its lstat calls are the identity checks, the one it swaps
 *   fail             [{ op, nth }]: the nth call of `op` (1-based, failed calls counted) throws
 *                    instead of running, like a disk error
 *   swap             { to, kind, after?: { op, nth }, atCheck?: n }: rename `out` to `<out>-moved`
 *                    and put at `out` either a symbolic link to `to` (kind 'link') or the real
 *                    folder `to` itself, moved there (kind 'folder', another inode). `after` swaps
 *                    right after the nth call of `op` returned; `atCheck` just before the nth
 *                    lstat of `out` (the first one records the identity, so use 2 or more)
 *   readOnlyStaging  make each new `.stackledger-tmp-*` folder read-only right after its mkdir,
 *                    so preparing the sites fails before anything is published
 * `changes` lists every change made after the swap (none is the expected result).
 */
import { chmodSync, renameSync, symlinkSync } from 'node:fs';
import { basename } from 'node:path';

const CHANGES = new Set(['mkdir', 'rename', 'rmdir', 'rm']);

export function wrapOps(base, plan) {
  const counts = {};
  let swapped = false;
  const changesAfterSwap = [];

  const swap = () => {
    if (swapped) return;
    swapped = true;
    renameSync(plan.out, `${plan.out}-moved`);
    if (plan.swap.kind === 'link') symlinkSync(plan.swap.to, plan.out);
    else renameSync(plan.swap.to, plan.out);
  };

  const wrap = (op, call) => (...args) => {
    const nth = (counts[op] = (counts[op] ?? 0) + 1);
    if (op === 'lstat' && args[0] === plan.out && plan.swap?.atCheck !== undefined) {
      const check = (counts.check = (counts.check ?? 0) + 1);
      if (check === plan.swap.atCheck) swap();
    }
    if (plan.fail?.some(fault => fault.op === op && fault.nth === nth)) {
      throw Object.assign(new Error(`injected ${op} failure (call ${nth})`), { code: 'EIO' });
    }
    if (swapped && CHANGES.has(op)) changesAfterSwap.push(`${op} ${args[0]}`);
    const result = call(...args);
    if (op === 'mkdir' && plan.readOnlyStaging && basename(args[0]).startsWith('.stackledger-tmp-')) chmodSync(args[0], 0o555);
    if (plan.swap?.after?.op === op && plan.swap.after.nth === nth) swap();
    return result;
  };

  const ops = Object.fromEntries(Object.entries(base).map(([op, call]) => [op, wrap(op, call)]));
  return { ops, changesAfterSwap, swapped: () => swapped };
}
