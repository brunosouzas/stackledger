/** `stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` (build-command spec). Called by
 * src/cli.ts; run node dist/cli.js build examples/northwind --out ./public.
 *
 * Order, so that a usage error never creates or changes anything: parse the options, load the
 * catalogue folder, check the output folder (after resolving symbolic links: not the catalogue, not
 * inside it, not containing it, empty or marked by an earlier build with a regular marker file
 * holding the marker text, and no published entry that is a symbolic link). Only then is the output folder
 * created, stale `.stackledger-tmp-*` folders removed, a new staging folder made, both sites
 * prepared in it (build.ts) and published by renames (publish.ts).
 *
 * Exit codes: usage and folder errors throw a plain Error (exit 2, with usage, from src/cli.ts); a
 * failure while building or publishing throws InternalError (exit 1) after the output folder is
 * restored and the staging folder removed. A failure to remove the staging folder after the commit
 * is a warning, with exit 0. stderr holds the build report only; stdout stays empty.
 *
 * Tests inject failures through the optional `faults` argument of buildCommand (BuildFaults), from
 * test/integration/build-with-faults.mjs; src/cli.ts never passes it, and the command reads no
 * environment variable, so a user cannot trigger a fault.
 */
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { isDate, localDate } from '../graph.js';
import { loadFolder } from '../source.js';
import { internal, InternalError } from '../errors.js';
import { problemCounts } from '../map/command.js';
import { prepareBuild, type PreparedBuild } from './build.js';
import { MARKER, MARKER_NAME } from './policy.js';
import { ENTRIES, publish, removeStaleStaging, STAGING_PREFIX } from './publish.js';

const PROXY_REMINDER = 'Serve both folders only behind an identity-aware proxy: full/ for the people allowed to see costs, staff/ for everyone else.';

/** True when `child` is `parent` or inside it (both real, absolute paths). Only a `..` segment
 * leaves `parent`: a child named `..review-probe` is inside it. */
function within(child: string, parent: string): boolean {
  const path = relative(parent, child);
  const outside = path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
  return !outside;
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
  if (entries.length && !isMarker(join(target, MARKER_NAME))) {
    throw new Error(`Output folder is not empty and was not written by stackledger build (no ${MARKER_NAME} file with the marker text)`);
  }
  // A rename or removal through a link would act outside the output folder: refuse it up front.
  const linked = ENTRIES.find(entry => lstatOrUndefined(join(target, entry.name))?.isSymbolicLink());
  if (linked) throw new Error(`Output folder entry ${linked.name} is a symbolic link; stackledger build does not replace links`);
  return target;
}

/** True when `path` is a regular file (not a link, not a folder) holding exactly the marker text. */
function isMarker(path: string): boolean {
  const stats = lstatOrUndefined(path);
  if (!stats?.isFile() || stats.size !== Buffer.byteLength(MARKER)) return false;
  return readFileSync(path, 'utf8') === MARKER;
}

/** Failures a test can inject into one build, to prove the undo and the cleanup. The CLI passes none. */
export interface BuildFaults {
  /** Throw while preparing the sites, before anything is published. */
  prepare?: boolean;
  /** Make the n-th publication rename (1-based) throw instead of renaming. */
  step?: number;
  /** Throw when removing the staging folder after the commit. */
  cleanup?: boolean;
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

export async function buildCommand(args: string[], faults: BuildFaults = {}): Promise<void> {
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

  mkdirSync(target, { recursive: true });
  removeStaleStaging(target);
  const staging = join(target, `${STAGING_PREFIX}${randomBytes(8).toString('hex')}`);
  mkdirSync(staging);
  let prepared: PreparedBuild;
  try {
    if (faults.prepare) throw new Error('injected failure while preparing');
    prepared = await prepareBuild(loaded, staging, date);
    publish(target, staging, faults.step);
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
    if (faults.cleanup) throw new Error('injected failure while removing the staging folder');
    rmSync(staging, { recursive: true, force: true });
  } catch (error) {
    warnings.push(`Warning: the build is published, but ${staging} could not be removed (${(error as Error).message}); the next build removes it`);
  }
  process.stderr.write(report(prepared, out, warnings));
}
