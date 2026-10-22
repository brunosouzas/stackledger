/** Test-only entry point: runs `stackledger skills map` from the built package with a wrapped MapFsOps.
 *
 * Why: the shipped CLI has no test hook, so a user can never trigger a fault; the Folder swapped test
 * still needs a real child process whose output folder is replaced between the check and the first
 * change. This script passes test/fs-wrapper.mjs's wrapper as the `ops` argument of skillsMapCommand
 * (its `atCheck` counts the lstat calls on the output folder: the first records the identity, the
 * second is the check before the first change). It lives under test/ and is not part of the package.
 *
 * Run (after npm run build), in the folder the command should run in:
 *   node test/integration/skills-map-with-faults.mjs '<plan JSON>' skills map <folder...> --out <dir>
 * The plan is the one wrapOps documents, for example
 *   {"out": "/real/path/map", "swap": {"to": "/real/path/other", "kind": "folder", "atCheck": 2}}.
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { skillsMapCommand, NODE_MAP_FS } from '../../dist/skills/map-command.js';
import { reportFailure } from '../../dist/errors.js';
import { wrapOps } from '../fs-wrapper.mjs';

const [json, ...args] = process.argv.slice(2);
const wrapper = wrapOps(NODE_MAP_FS, JSON.parse(json ?? '{}'));
try {
  await skillsMapCommand(args, wrapper.ops);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, 'Usage: skills-map-with-faults.mjs <plan JSON> skills map <folder...> --out <dir>\n');
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
