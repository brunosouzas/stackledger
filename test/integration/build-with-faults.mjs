/** Test-only entry point: runs `stackledger build` from the built package with a wrapped FsOps.
 *
 * Why: the shipped CLI has no test hook, so a user can never trigger a fault; the build tests still
 * need a real child process (Astro changes the current directory) that fails, or sees its output
 * folder swapped, at a chosen filesystem call. This script passes test/fs-wrapper.mjs's wrapper as
 * the `ops` argument of buildCommand. It lives under test/ and is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/build-with-faults.mjs '<plan JSON>' build <folder> --out <dir> [--date D]
 * The plan is the one wrapOps documents, for example {"out": "/tmp/x", "fail": [{"op": "rename", "nth": 3}]}.
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 * When a swap happened, a last stderr line lists any change made after it ("changes after the swap: none").
 */
import { buildCommand } from '../../dist/site/command.js';
import { NODE_FS } from '../../dist/site/fs-ops.js';
import { reportFailure } from '../../dist/errors.js';
import { wrapOps } from '../fs-wrapper.mjs';

const [json, ...args] = process.argv.slice(2);
const wrapper = wrapOps(NODE_FS, JSON.parse(json ?? '{}'));
try {
  await buildCommand(args, wrapper.ops);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, 'Usage: build-with-faults.mjs <plan JSON> build <folder> --out <dir>\n');
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
if (wrapper.swapped()) process.stderr.write(`changes after the swap: ${wrapper.changesAfterSwap.join(', ') || 'none'}\n`);
