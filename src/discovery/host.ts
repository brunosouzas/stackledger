/** The Host of discovery (design D7): everything discovery reads from the machine, in one object.
 *
 * Why: each source module takes a Host instead of calling node:fs, the environment or the runner
 * directly, so unit tests feed fictitious Northwind outputs and fake folders, and the test entry
 * script (test/integration/discover-entry.mjs) builds a host from a JSON file with fake roots, fake
 * programs on a temporary PATH and a temporary HOME. src/discover-command.ts uses createHost() with
 * no options: the real machine. There is no test-only branch in the shipped code.
 *
 * File access is read-only and never follows a link where the spec says so: `lstat` is the entry's
 * own status, `readdir` lists names, `canRead` opens a file for reading and closes it unread, and
 * `readFile` reads a small text file (pipx metadata). Programs only run through `run` (src/discovery/run.ts).
 */
import { constants, type Stats } from 'node:fs';
import { lstat, open, readdir, readFile, stat } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { createRunner, PROGRAM_DIRS, SANDBOX, type Run } from './run.js';

export interface Host {
  platform: NodeJS.Platform;
  /** The caller's environment (read for PATH and the mise and pipx folders; never passed whole to a program). */
  env: Readonly<Record<string, string | undefined>>;
  home: string;
  /** The macOS user name (`machine.user`). */
  user: string;
  /** Usually `/Applications`. */
  applications: string;
  /** Usually `/Library` (its LaunchAgents and LaunchDaemons). */
  library: string;
  /** Usually `/usr/bin/sandbox-exec`. */
  sandbox: string;
  /** Usually `~/.stackledger`: the folder that holds one folder per machine. */
  snapshotRoot: string;
  run: Run;
  readdir(path: string): Promise<string[]>;
  lstat(path: string): Promise<Stats>;
  readFile(path: string): Promise<string>;
  /** Whether the file can be opened for reading (it is opened and closed, nothing is read). */
  canRead(path: string): Promise<boolean>;
  /** Whether `path` is a file that exists (links followed): used for the sandbox program. */
  isFile(path: string): Promise<boolean>;
}

export interface HostOptions {
  platform?: NodeJS.Platform;
  env?: Readonly<Record<string, string | undefined>>;
  home?: string;
  user?: string;
  applications?: string;
  library?: string;
  sandbox?: string;
  snapshotRoot?: string;
  programDirs?: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
}

/** The real machine, or one with some parts replaced (the test entry script). */
export function createHost(options: HostOptions = {}): Host {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const sandbox = options.sandbox ?? SANDBOX;
  const runnerOptions = { env, sandbox, programDirs: options.programDirs ?? PROGRAM_DIRS,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }) };
  return {
    platform: options.platform ?? process.platform,
    env,
    home,
    user: options.user ?? userInfo().username,
    applications: options.applications ?? '/Applications',
    library: options.library ?? '/Library',
    sandbox,
    snapshotRoot: options.snapshotRoot ?? join(home, '.stackledger'),
    run: createRunner(runnerOptions),
    readdir: path => readdir(path),
    lstat: path => lstat(path),
    readFile: path => readFile(path, 'utf8'),
    canRead: async path => {
      try { await (await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)).close(); return true; } catch { return false; }
    },
    isFile: async path => { try { return (await stat(path)).isFile(); } catch { return false; } },
  };
}
