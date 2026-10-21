/** Test-only entry point: runs `stackledger drift` from the built package with a host built from a
 * JSON file (design D7) and optional faults in the `--scaffold` writes, like discover-entry.mjs and
 * build-with-faults.mjs.
 *
 * Why: the shipped CLI always reads this machine's name through the real sandboxed `scutil` when
 * `--snapshot` is absent, and writes the scaffold through node:fs; the tests need a real child process
 * that reads a fictitious machine instead (fake programs on a temporary PATH, a temporary snapshot
 * root) or meets a fault at a chosen call. It lives under test/ and is not part of the package.
 *
 * The JSON is `{ "host": <createHost options>, "faults": { "failWrite": <n>, "createBeforeMkdir": true } }`:
 * `failWrite` makes the n-th scaffold file write fail with EIO after creating the file, and
 * `createBeforeMkdir` creates the scaffold folder just before the command does, as another process could.
 *
 * Run (after npm run build):
 *   node test/integration/drift-entry.mjs <config.json> drift <folder> [args…]
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { driftCommand, DRIFT_USAGE, NODE_SCAFFOLD_OPS } from '../../dist/drift-command.js';
import { createHost } from '../../dist/discovery/host.js';
import { reportFailure } from '../../dist/errors.js';

const [file, ...args] = process.argv.slice(2);
const config = JSON.parse(readFileSync(file, 'utf8'));
const faults = config.faults ?? {};
let writes = 0;
const ops = {
  ...NODE_SCAFFOLD_OPS,
  mkdir: path => {
    if (faults.createBeforeMkdir) mkdirSync(path);
    NODE_SCAFFOLD_OPS.mkdir(path);
  },
  writeFile: (path, text) => {
    writes++;
    if (writes === faults.failWrite) {
      NODE_SCAFFOLD_OPS.writeFile(path, text.slice(0, 10));
      throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
    }
    NODE_SCAFFOLD_OPS.writeFile(path, text);
  },
};
try {
  await driftCommand(args, createHost(config.host ?? {}), ops);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, DRIFT_USAGE);
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
