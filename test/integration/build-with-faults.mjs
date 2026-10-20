/** Test-only entry point: runs `stackledger build` from the built package with injected faults.
 *
 * Why: the shipped CLI reads no test variable, so a user can never trigger a fault; the build tests
 * still need a real child process (Astro changes the current directory) failing at a chosen point.
 * They call this script instead of dist/cli.js; it is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/build-with-faults.mjs '<faults JSON>' build <folder> --out <dir> [--date D]
 * The JSON is a BuildFaults object (src/site/command.ts), for example {"step": 3}. Failures are
 * reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { buildCommand } from '../../dist/site/command.js';
import { reportFailure } from '../../dist/errors.js';

const [faults, ...args] = process.argv.slice(2);
try {
  await buildCommand(args, JSON.parse(faults ?? '{}'));
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, 'Usage: build-with-faults.mjs <faults JSON> build <folder> --out <dir>\n');
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
