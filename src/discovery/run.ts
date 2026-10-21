/** The sandboxed program runner of discovery (design D1, mac-discovery spec).
 *
 * Every program discovery starts goes through here: it is looked up on PATH, then in the Homebrew
 * folders, and run as `<sandbox> -p <PROFILE> <program> <args…>` without a shell. The profile denies
 * every network access and every file write except to /dev/null, so read-only is enforced by macOS,
 * not only intended: the 2026-10-21 spike showed plain npm and pipx runs write logs.
 *
 * The program gets a fixed environment (PATH, HOME, USER, TMPDIR from the caller plus settings that
 * turn off Homebrew's update, analytics and hints, npm's update check and colour); nothing else of the
 * caller's environment, such as a token, reaches it. A run is stopped after the time limit or once its
 * stdout passes the output limit; stderr is read and dropped, so no program text ever reaches a
 * reason, the snapshot or the terminal. The result says only how the run ended.
 *
 * What can go wrong: a missing program is `not found`; a stopped run is `time limit` or `output limit`.
 * The runner itself never throws for a program's behaviour.
 */
import { spawn } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { constants as osConstants } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const PROFILE = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write* (require-not (literal "/dev/null")))\n';
export const SANDBOX = '/usr/bin/sandbox-exec';
/** Folders searched after PATH (mac-discovery spec, Programs found). */
export const PROGRAM_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
export const TIME_LIMIT_MS = 60_000;
export const OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

const CALLER_KEYS = ['PATH', 'HOME', 'USER', 'TMPDIR'] as const;
const FIXED_ENV: Record<string, string> = {
  HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_ANALYTICS: '1', HOMEBREW_NO_ENV_HINTS: '1', HOMEBREW_NO_INSTALL_CLEANUP: '1',
  npm_config_update_notifier: 'false', NO_COLOR: '1', LC_ALL: 'C',
};
/** Shell convention for a program that was found but could not be started. */
const CANNOT_START = 126;
const SIGNAL_BASE = 128;

export type RunResult =
  | { kind: 'exited'; code: number; stdout: string }
  | { kind: 'not found' }
  | { kind: 'time limit' }
  | { kind: 'output limit' };
export type Run = (program: string, args: string[]) => Promise<RunResult>;

/** The fixed reasons a source may record (mac-discovery spec, Source reasons and counts). */
export type Reason = 'not found' | `exited with code ${number}` | 'time limit' | 'output limit' | 'unreadable output' | 'cannot be read';

/** The reason for a run that did not end with exit code 0; null for a successful run. */
export function failureReason(result: RunResult): Reason | null {
  if (result.kind !== 'exited') return result.kind;
  return result.code === 0 ? null : `exited with code ${result.code}`;
}

export interface RunnerOptions {
  /** The caller's environment: only PATH, HOME, USER and TMPDIR are passed on. */
  env: Readonly<Record<string, string | undefined>>;
  sandbox?: string;
  programDirs?: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
}

/** The environment a program gets. */
export function programEnv(env: RunnerOptions['env']): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of CALLER_KEYS) { const value = env[key]; if (value !== undefined) result[key] = value; }
  return { ...result, ...FIXED_ENV };
}

function executable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch { return false; }
}

/** The first executable regular file (or link to one) named `name` on PATH, then in `programDirs`.
 * Empty and relative PATH entries are skipped: resolved against the current folder, they would let
 * whatever folder the user happens to be in choose which `brew` or `npm` runs (mac-discovery spec,
 * Programs found, scenario Relative PATH entry). */
export function findProgram(name: string, path: string | undefined, programDirs: readonly string[]): string | undefined {
  const dirs = [...(path ?? '').split(':'), ...programDirs].filter(dir => dir !== '' && isAbsolute(dir));
  for (const dir of dirs) {
    const candidate = join(dir, name);
    if (executable(candidate)) return candidate;
  }
  return undefined;
}

/** Run one already-found program inside the sandbox. */
function runSandboxed(sandbox: string, program: string, args: string[], env: Record<string, string>, timeoutMs: number, maxBytes: number): Promise<RunResult> {
  return new Promise(resolve => {
    // Own process group, so stopping the run also stops anything the program started.
    const child = spawn(sandbox, ['-p', PROFILE, program, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const chunks: Buffer[] = [];
    let bytes = 0, stopped: 'time limit' | 'output limit' | undefined;
    const stop = (why: 'time limit' | 'output limit') => {
      if (stopped) return;
      stopped = why;
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    };
    const timer = setTimeout(() => stop('time limit'), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop('output limit');
      else chunks.push(chunk);
    });
    // stderr is drained and dropped: it never reaches a reason or the terminal.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); resolve({ kind: 'exited', code: CANNOT_START, stdout: '' }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (stopped) { resolve({ kind: stopped }); return; }
      // A program killed by a signal reports 128 + the signal number, as a shell does.
      const exit = code ?? SIGNAL_BASE + (signal ? osConstants.signals[signal] : 0);
      resolve({ kind: 'exited', code: exit, stdout: Buffer.concat(chunks).toString('utf8') });
    });
  });
}

/** A Run: look the program up, then run it in the sandbox with the fixed environment and limits. */
export function createRunner(options: RunnerOptions): Run {
  const sandbox = options.sandbox ?? SANDBOX;
  const programDirs = options.programDirs ?? PROGRAM_DIRS;
  const env = programEnv(options.env);
  const timeoutMs = options.timeoutMs ?? TIME_LIMIT_MS;
  const maxBytes = options.maxBytes ?? OUTPUT_LIMIT_BYTES;
  return async (name, args) => {
    const program = findProgram(name, options.env.PATH, programDirs);
    if (!program) return { kind: 'not found' };
    return runSandboxed(sandbox, program, args, env, timeoutMs, maxBytes);
  };
}
