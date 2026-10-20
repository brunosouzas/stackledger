/** Test-only entry point: runs `stackledger build` from the built package with injected faults.
 *
 * Why: the shipped CLI reads no test variable, so a user can never trigger a fault; the build tests
 * still need a real child process (Astro changes the current directory) failing at a chosen point.
 * They call this script instead of dist/cli.js; it is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/build-with-faults.mjs '<faults JSON>' build <folder> --out <dir> [--date D]
 * The JSON is a BuildFaults object (src/site/command.ts), for example {"step": 3}, plus
 * {"swap": {"at": "<CheckPoint>", "to": "<folder>"}}: at that point the output folder is renamed to
 * `<out>-moved` and replaced by a symbolic link to `<folder>`. Failures are reported as src/cli.ts
 * reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { renameSync, symlinkSync } from 'node:fs';
import { buildCommand } from '../../dist/site/command.js';
import { reportFailure } from '../../dist/errors.js';

/** The `at` hook that swaps the output folder for a link at the chosen point. */
function swapper({ at, to }) {
  return (point, target) => {
    if (point !== at) return;
    renameSync(target, `${target}-moved`);
    symlinkSync(to, target);
  };
}

const [json, ...args] = process.argv.slice(2);
const { swap, ...faults } = JSON.parse(json ?? '{}');
try {
  await buildCommand(args, swap ? { ...faults, at: swapper(swap) } : faults);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, 'Usage: build-with-faults.mjs <faults JSON> build <folder> --out <dir>\n');
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
