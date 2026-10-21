/** Test-only entry point: runs `stackledger discover` from the built package with a host built from a
 * JSON file (design D7).
 *
 * Why: the shipped CLI always reads the real machine; the discover tests need a real child process
 * that reads a fictitious machine instead: fake programs on a temporary PATH, fake /Applications and
 * /Library roots, a temporary HOME and snapshot root, and on Linux a stand-in for sandbox-exec. The
 * JSON holds createHost options (src/discovery/host.ts). It lives under test/ and is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/discover-entry.mjs <host.json> discover [args…]
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { readFileSync } from 'node:fs';
import { discoverCommand, DISCOVER_USAGE } from '../../dist/discover-command.js';
import { createHost } from '../../dist/discovery/host.js';
import { reportFailure } from '../../dist/errors.js';

const [file, ...args] = process.argv.slice(2);
try {
  await discoverCommand(args, createHost(JSON.parse(readFileSync(file, 'utf8'))));
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, DISCOVER_USAGE);
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
