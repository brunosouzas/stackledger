/** Test-only entry point: runs `stackledger drift` from the built package with a host built from a
 * JSON file (design D7) and optional faults in the `--scaffold` writes, like discover-entry.mjs and
 * build-with-faults.mjs.
 *
 * Why: the shipped CLI always reads this machine's name through the real sandboxed `scutil` when
 * `--snapshot` is absent, and writes the scaffold through node:fs; the tests need a real child process
 * that reads a fictitious machine instead (fake programs on a temporary PATH, a temporary snapshot
 * root) or meets a fault at a chosen call. It lives under test/ and is not part of the package.
 *
 * The JSON is `{ "host": <createHost options>, "faults": { … } }`, every fault optional:
 * - `failWrite: n` makes the n-th scaffold file write fail with EIO after creating the file and writing
 *   part of it;
 * - `createBeforeWrite: n` creates the n-th scaffold file just before the command's exclusive create;
 * - `createBeforeMkdir: true` creates the scaffold folder just before the command does;
 * - `replaceFolderAfterWrite: n`, after the n-th file is written, moves the scaffold folder to
 *   `<dir>-moved` and puts a symbolic link to a new empty folder `<dir>-elsewhere` in its place;
 * - `parentUid: n` makes the lstat of the scaffold folder's parent report owner n;
 * - `ancestorUid: n` makes the lstat of the folder above that parent report owner n;
 * - `parentToLinkBeforeMkdir: "<folder>"`, just before the command creates the scaffold folder, moves
 *   its parent to `<parent>-moved` and puts a symbolic link to `<folder>` in its place;
 * - `replaceFileAfterWrite: n`, after the n-th file is written, puts a new file of another process in
 *   its place (written beside it, then renamed over it, so it is a different inode);
 * - `failCreate: n` makes the n-th exclusive create fail with EIO before creating anything;
 * - `replaceFolderAfterUnlink: n`, after the rollback's n-th file removal, moves the scaffold folder to
 *   `<dir>-moved` and creates a new empty folder of another process at `<dir>`;
 * each as another process or user could.
 *
 * Run (after npm run build):
 *   node test/integration/drift-entry.mjs <config.json> drift <folder> [args…]
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 */
import { mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { driftCommand, DRIFT_USAGE, NODE_SCAFFOLD_OPS } from '../../dist/drift-command.js';
import { createHost } from '../../dist/discovery/host.js';
import { reportFailure } from '../../dist/errors.js';

const [file, ...args] = process.argv.slice(2);
const config = JSON.parse(readFileSync(file, 'utf8'));
const faults = config.faults ?? {};
const scaffold = args.includes('--scaffold') ? resolve(args[args.indexOf('--scaffold') + 1]) : undefined;
const parent = scaffold === undefined ? undefined : realpathSync(dirname(scaffold));
const ownerAs = (status, uid) => Object.assign(Object.create(Object.getPrototypeOf(status)), status, { uid });
let creates = 0, writes = 0, unlinks = 0, lastPath;
const ops = {
  ...NODE_SCAFFOLD_OPS,
  lstat: path => {
    const status = NODE_SCAFFOLD_OPS.lstat(path);
    if (faults.parentUid !== undefined && path === parent) return ownerAs(status, faults.parentUid);
    if (faults.ancestorUid !== undefined && path === dirname(parent)) return ownerAs(status, faults.ancestorUid);
    return status;
  },
  mkdir: path => {
    if (faults.createBeforeMkdir) mkdirSync(path);
    if (faults.parentToLinkBeforeMkdir !== undefined) {
      renameSync(parent, `${parent}-moved`);
      symlinkSync(faults.parentToLinkBeforeMkdir, parent);
    }
    NODE_SCAFFOLD_OPS.mkdir(path);
  },
  create: path => {
    creates++;
    if (creates === faults.createBeforeWrite) writeFileSync(path, 'written by another process\n');
    if (creates === faults.failCreate) throw Object.assign(new Error('injected create failure'), { code: 'EIO' });
    lastPath = path;
    return NODE_SCAFFOLD_OPS.create(path);
  },
  unlink: path => {
    NODE_SCAFFOLD_OPS.unlink(path);
    unlinks++;
    if (unlinks === faults.replaceFolderAfterUnlink) {
      renameSync(scaffold, `${scaffold}-moved`);
      mkdirSync(scaffold);
    }
  },
  write: (fd, text) => {
    writes++;
    if (writes === faults.failWrite) {
      NODE_SCAFFOLD_OPS.write(fd, text.slice(0, 10));
      throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
    }
    NODE_SCAFFOLD_OPS.write(fd, text);
    if (writes === faults.replaceFileAfterWrite) {
      writeFileSync(`${lastPath}.other`, 'written by another process\n');
      renameSync(`${lastPath}.other`, lastPath);
    }
    if (writes === faults.replaceFolderAfterWrite) {
      renameSync(scaffold, `${scaffold}-moved`);
      mkdirSync(`${scaffold}-elsewhere`);
      symlinkSync(`${scaffold}-elsewhere`, scaffold);
    }
  },
};
try {
  await driftCommand(args, createHost(config.host ?? {}), ops);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, DRIFT_USAGE);
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
