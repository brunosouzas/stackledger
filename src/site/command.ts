/** `stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` (build-command spec). Called by
 * src/cli.ts; run node dist/cli.js build examples/northwind --out ./public.
 *
 * Order, so that a usage error never creates or changes anything: parse the options, load the
 * catalogue folder, check the output folder (after resolving symbolic links: not the catalogue, not
 * inside it, not containing it, empty or marked by an earlier build). Only then is the output folder
 * created, stale `.stackledger-tmp-*` folders removed, a new staging folder made, both sites
 * prepared in it (build.ts) and published by renames (publish.ts).
 *
 * Exit codes: usage and folder errors throw a plain Error (exit 2, with usage, from src/cli.ts); a
 * failure while building or publishing throws InternalError (exit 1) after the output folder is
 * restored and the staging folder removed. A failure to remove the staging folder after the commit
 * is a warning, with exit 0. stderr holds the build report only; stdout stays empty.
 *
 * Test-only hook: STACKLEDGER_TEST_FAIL=prepare | step:<n> | cleanup injects a failure while
 * preparing, at the n-th publication rename, or when removing the staging folder after the commit.
 * test/integration/build.test.ts uses it to prove the rollback; it is not a user option.
 */
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isDate, localDate } from '../graph.js';
import { loadFolder } from '../source.js';
import { internal, InternalError } from '../errors.js';
import { problemCounts } from '../map/command.js';
import { prepareBuild, type PreparedBuild } from './build.js';
import { MARKER_NAME } from './policy.js';
import { publish, removeStaleStaging, STAGING_PREFIX } from './publish.js';

const TEST_HOOK = 'STACKLEDGER_TEST_FAIL';
const PROXY_REMINDER = 'Serve both folders only behind an identity-aware proxy: full/ for the people allowed to see costs, staff/ for everyone else.';

/** True when `child` is `parent` or inside it (both real, absolute paths). */
function within(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

/** The real path of `path`, or of its nearest existing ancestor joined with the missing rest. */
function realTarget(path: string): string {
  const missing: string[] = [];
  let current = path;
  for (;;) {
    try {
      return join(realpathSync.native(current), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Output folder cannot be read: ${current}`);
      // A dangling symbolic link exists but cannot be resolved: refuse it rather than write through it.
      if (lstatOrUndefined(current)) throw new Error('Output folder is a broken symbolic link');
      const parent = dirname(current);
      if (parent === current) throw new Error('Output folder cannot be resolved');
      missing.push(basename(current));
      current = parent;
    }
  }
}

function lstatOrUndefined(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

/** Check the output folder and return its real path; throws a usage error when it must be refused. */
function checkOutput(out: string, catalogue: string): string {
  const target = realTarget(out);
  if (within(target, catalogue)) throw new Error('Output folder must not be the catalogue folder or inside it');
  if (within(catalogue, target)) throw new Error('Output folder must not contain the catalogue folder');
  let entries: string[];
  try {
    if (!statSync(target).isDirectory()) throw new Error('Output path is not a folder');
    entries = readdirSync(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return target;
    if (code === undefined) throw error;
    throw new Error('Output folder cannot be read');
  }
  if (entries.length && !entries.includes(MARKER_NAME)) {
    throw new Error(`Output folder is not empty and was not written by stackledger build (no ${MARKER_NAME})`);
  }
  return target;
}

/** The test-only failure hook, read once per build. */
function testHook(): { prepare: boolean; step?: number; cleanup: boolean } {
  const value = process.env[TEST_HOOK] ?? '';
  const step = /^step:(\d+)$/.exec(value)?.[1];
  return { prepare: value === 'prepare', ...(step === undefined ? {} : { step: Number(step) }), cleanup: value === 'cleanup' };
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

function report(prepared: PreparedBuild, out: string, warnings: string[]): string {
  const lines = [
    ...problemCounts('build', prepared.catalogue),
    ...prepared.notes,
    ...warnings,
    `Built the staff site in ${join(out, 'staff')} (${plural(prepared.staff.pages, 'page')})`,
    `Built the full site in ${join(out, 'full')} (${plural(prepared.full.pages, 'page')})`,
    PROXY_REMINDER,
  ];
  return lines.join('\n') + '\n';
}

export async function buildCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: { out: { type: 'string' }, date: { type: 'string' } },
  });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  if (values.out === undefined || values.out === '') throw new Error('--out is required');
  const date = values.date ?? localDate();
  if (!isDate(date)) throw new Error('Map date must be a real YYYY-MM-DD date');

  // Usage checks first: loading the folder throws a usage error for a missing or unreadable folder.
  const loaded = await loadFolder(resolve(folder));
  const catalogue = realpathSync.native(resolve(folder));
  const out = resolve(values.out);
  const target = checkOutput(out, catalogue);

  const hook = testHook();
  mkdirSync(target, { recursive: true });
  removeStaleStaging(target);
  const staging = join(target, `${STAGING_PREFIX}${randomBytes(8).toString('hex')}`);
  mkdirSync(staging);
  let prepared: PreparedBuild;
  try {
    if (hook.prepare) throw new Error('injected failure while preparing');
    prepared = await prepareBuild(loaded, staging, date);
    publish(target, staging, hook.step);
  } catch (error) {
    // An undo that failed keeps the staging folder: it holds the previous entries.
    if (error instanceof InternalError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    try {
      rmSync(staging, { recursive: true, force: true });
    } catch (cleanupError) {
      throw internal('build', `${reason}; the staging folder ${staging} could not be removed (${(cleanupError as Error).message})`);
    }
    throw internal('build', error);
  }

  // Committed: the new sites are in place. Removing the old entries is best effort.
  const warnings: string[] = [];
  try {
    if (hook.cleanup) throw new Error('injected failure while removing the staging folder');
    rmSync(staging, { recursive: true, force: true });
  } catch (error) {
    warnings.push(`Warning: the build is published, but ${staging} could not be removed (${(error as Error).message}); the next build removes it`);
  }
  process.stderr.write(report(prepared, out, warnings));
}
