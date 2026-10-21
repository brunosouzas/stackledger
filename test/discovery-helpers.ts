/** Fake programs and folders for discovery tests. Run through npm test.
 *
 * Why: discovery tests never run the real brew, npm or mas, and never read the real /Applications.
 * A fake program is a small shell script in a temporary folder; `passThroughSandbox` stands in for
 * /usr/bin/sandbox-exec on any platform (it drops `-p <profile>` and runs the program unsandboxed),
 * so runner and source tests run on Linux too. Only the darwin-only tests use the real sandbox.
 * Every folder comes from folder() in test/helpers.ts and is removed after each test.
 */
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from './helpers.js';

/** Write an executable `#!/bin/sh` script `name` into `dir` and return its path. */
export function fakeProgram(dir: string, name: string, body: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** A stand-in for sandbox-exec: `sandbox -p <profile> <program> <args…>` runs `<program> <args…>`. */
export function passThroughSandbox(): string {
  return fakeProgram(folder(), 'sandbox-exec', 'shift 2\nexec "$@"');
}

/** The real sandbox, for the darwin-only tests. */
export const REAL_SANDBOX = '/usr/bin/sandbox-exec';
export const onMac = process.platform === 'darwin';
