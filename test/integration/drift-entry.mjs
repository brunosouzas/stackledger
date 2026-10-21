/** Test-only entry point: runs `stackledger drift` from the built package with a host built from a
 * JSON file (design D7), like discover-entry.mjs.
 *
 * Why: the shipped CLI always reads this machine's name through the real sandboxed `scutil` when
 * `--snapshot` is absent; the default-snapshot tests need a real child process that reads a
 * fictitious machine instead (fake programs on a temporary PATH, a temporary snapshot root). The
 * JSON is `{ "host": <createHost options> }`. It lives under test/ and is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/drift-entry.mjs <config.json> drift <folder> [args…]
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { readFileSync } from 'node:fs';
import { driftCommand, DRIFT_USAGE } from '../../dist/drift-command.js';
import { createHost } from '../../dist/discovery/host.js';
import { reportFailure } from '../../dist/errors.js';

const [file, ...args] = process.argv.slice(2);
const config = JSON.parse(readFileSync(file, 'utf8'));
try {
  await driftCommand(args, createHost(config.host ?? {}));
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, DRIFT_USAGE);
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
