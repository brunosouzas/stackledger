/** `stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` (build-command spec). Called by
 * src/cli.ts; run node dist/cli.js build examples/northwind --out ./public.
 *
 * Order, so that a refusal never creates or changes anything: parse the options, load the catalogue
 * folder, check the output folder (after resolving symbolic links: not the catalogue, not inside it,
 * not containing it; no staging folder holding `old/` and no `.stackledger-tmp-*` link or file
 * (staging.ts); then empty or marked by an earlier build with a regular marker file holding the
 * marker text, and no published entry that is a symbolic link). Only then is the output folder
 * created, stale staging folders removed, a new staging folder made, both sites prepared in it
 * (build.ts) and published by renames (publish.ts).
 *
 * The output folder's real path, device and inode are recorded when it is checked (or created) and
 * compared again immediately before every change (paths.ts); a mismatch stops with exit 1.
 *
 * Exit codes: usage and folder errors throw a plain Error (exit 2, with usage, from src/cli.ts). A
 * failure while building or publishing throws InternalError (exit 1) after the output folder is
 * restored and the staging folder removed. A failed undo, a staging folder left with `old/` and a
 * moved output folder are exit 1 too, and the staging folder is kept. After the commit, a failure to
 * remove the staging folder is a warning, with exit 0. stderr holds the build report only.
 *
 * Every filesystem call on the output folder goes through `ops` (fs-ops.ts). src/cli.ts passes none,
 * so the CLI uses node:fs; tests pass a wrapper that fails or swaps the folder at a chosen call.
 */
import { randomBytes } from 'node:crypto';
import type { Stats } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isDate, localDate } from '../graph.js';
import { LAST_WINDOW_DATE, windowFits } from '../reports.js';
import { REPORT_DAYS } from './data.js';
import { loadFolder } from '../source.js';
import { internal } from '../errors.js';
import { problemCounts } from '../map/command.js';
import { prepareBuild, packageVersion, type PreparedBuild } from './build.js';
import { validateLoaded } from '../validate.js';
import { refuseSkillsOutput, skillsInUse, skillsStops } from './skills-build.js';
import { NODE_FS, type FsOps } from './fs-ops.js';
import { MARKER, MARKER_NAME } from './policy.js';
import { assertSameFolder, FolderChanged, folderIdentity, lstatOrUndefined, within, type FolderIdentity } from './paths.js';
import { ENTRIES, publish, UndoFailed } from './publish.js';
import { OLD_NAME, removeStaging, STAGING_PREFIX, staleStaging } from './staging.js';

const PROXY_REMINDER = 'Serve both folders only behind an identity-aware proxy: full/ for the people allowed to see costs, staff/ for everyone else.';
const PERSONAL_PROXY_REMINDER = 'Serve full/ only behind an identity-aware proxy, for the people allowed to see costs.';

/** The real path of `path`, or of its nearest existing ancestor joined with the missing rest. */
function realTarget(path: string, ops: FsOps): string {
  const missing: string[] = [];
  let current = path;
  for (;;) {
    try {
      return join(ops.realpath(current), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Output folder cannot be read: ${current}`);
      // A dangling symbolic link exists but cannot be resolved: refuse it rather than write through it.
      if (lstatOrUndefined(current, ops)) throw new Error('Output folder is a broken symbolic link');
      const parent = dirname(current);
      if (parent === current) throw new Error('Output folder cannot be resolved');
      missing.push(basename(current));
      current = parent;
    }
  }
}

/** The checked output folder: its real path, its identity when it exists, the staging folders to remove. */
interface CheckedOutput { target: string; identity: FolderIdentity | undefined; stale: string[] }

/** The output folder's own status and entries, or undefined when it does not exist yet. */
function readOutput(target: string, ops: FsOps): { stats: Stats; entries: string[] } | undefined {
  try {
    const stats = ops.lstat(target);
    if (!stats.isDirectory()) throw new Error('Output path is not a folder');
    return { stats, entries: ops.readdir(target) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    if (code === undefined) throw error;
    throw new Error('Output folder cannot be read');
  }
}

/** Check the output folder; throws a usage error (exit 2) or InternalError (exit 1) to refuse it. */
function checkOutput(out: string, catalogue: string, ops: FsOps): CheckedOutput {
  const target = realTarget(out, ops);
  if (within(target, catalogue)) throw new Error('Output folder must not be the catalogue folder or inside it');
  if (within(catalogue, target)) throw new Error('Output folder must not contain the catalogue folder');
  const existing = readOutput(target, ops);
  if (!existing) return { target, identity: undefined, stale: [] };
  // Staging folders first: one left with old/ needs the manual restore, whatever else is there.
  const stale = staleStaging(target, existing.entries, ops);
  const others = existing.entries.filter(name => !name.startsWith(STAGING_PREFIX));
  if (others.length && !isMarker(join(target, MARKER_NAME), ops)) {
    throw new Error(`Output folder is not empty and was not written by stackledger build (no ${MARKER_NAME} file with the marker text)`);
  }
  // A rename or removal through a link would act outside the output folder: refuse it up front.
  const linked = ENTRIES.find(entry => lstatOrUndefined(join(target, entry.name), ops)?.isSymbolicLink());
  if (linked) throw new Error(`Output folder entry ${linked.name} is a symbolic link; stackledger build does not replace links`);
  const identity = { path: target, real: target, dev: existing.stats.dev, ino: existing.stats.ino };
  return { target, identity, stale };
}

/** True when `path` is a regular file (not a link, not a folder) holding exactly the marker text. */
function isMarker(path: string, ops: FsOps): boolean {
  const stats = lstatOrUndefined(path, ops);
  if (!stats?.isFile() || stats.size !== Buffer.byteLength(MARKER)) return false;
  return ops.readFile(path) === MARKER;
}

/** Create the missing output folder and record its identity. */
function createOutput(target: string, ops: FsOps): FolderIdentity {
  ops.mkdir(target, { recursive: true });
  return folderIdentity(target, ops);
}

/** The error to throw for a failure before the commit. The staging folder is removed, unless the
 * output folder moved (nothing may change) or the undo failed (it holds the previous entries). */
function failedBuild(error: unknown, staging: string, identity: FolderIdentity, ops: FsOps): Error {
  if (error instanceof FolderChanged || error instanceof UndoFailed) return error;
  const reason = error instanceof Error ? error.message : String(error);
  assertSameFolder(identity, ops);
  try {
    ops.rm(staging);
  } catch (cleanupError) {
    return internal('build', `${reason}; the staging folder ${staging} could not be removed (${(cleanupError as Error).message})`);
  }
  return internal('build', error);
}

/** After the commit: remove `old/` (the replaced build), then the staging folder. A failure is a
 * warning line; a moved output folder still throws (exit 1, nothing removed). */
function cleanUp(staging: string, identity: FolderIdentity, ops: FsOps): string[] {
  const steps: [string, string][] = [
    [join(staging, OLD_NAME), `it holds only the entries this build replaced: remove it by hand (until then stackledger build refuses this output folder)`],
    [staging, 'the next build removes it'],
  ];
  for (const [path, advice] of steps) {
    assertSameFolder(identity, ops);
    try {
      ops.rm(path);
    } catch (error) {
      return [`Warning: the build is published, but ${staging} could not be removed (${(error as Error).message}); ${advice}`];
    }
  }
  return [];
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

function report(prepared: PreparedBuild, out: string, warnings: string[]): string {
  const lines = [
    ...problemCounts('build', prepared.catalogue),
    ...prepared.notes,
    ...warnings,
    ...(prepared.staff ? [`Built the staff site in ${join(out, 'staff')} (${plural(prepared.staff.pages, 'page')})`] : []),
    `Built the full site in ${join(out, 'full')} (${plural(prepared.full.pages, 'page')})`,
    prepared.staff ? PROXY_REMINDER : PERSONAL_PROXY_REMINDER,
  ];
  return lines.join('\n') + '\n';
}

/** Parse the command's arguments; throws a usage error for anything the spec refuses. */
function parseBuildArgs(args: string[]): { folder: string; out: string; date: string; skills: string[] } {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: { out: { type: 'string' }, date: { type: 'string' }, skills: { type: 'string', multiple: true } },
  });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  if (values.out === undefined || values.out === '') throw new Error('--out is required');
  const skills = values.skills ?? [];
  if (skills.some(value => value === '')) throw new Error('--skills needs a folder');
  const date = values.date ?? localDate();
  if (!isDate(date)) throw new Error('Map date must be a real YYYY-MM-DD date');
  if (!windowFits(date, REPORT_DAYS)) throw new Error(`--date plus the ${REPORT_DAYS}-day report window must be no later than ${LAST_WINDOW_DATE}`);
  return { folder, out: values.out, date, skills };
}

export async function buildCommand(args: string[], ops: FsOps = NODE_FS): Promise<void> {
  const options = parseBuildArgs(args);
  // Usage checks first: loading the folder throws a usage error for a missing or unreadable folder.
  const loaded = await loadFolder(resolve(options.folder));
  const catalogue = ops.realpath(resolve(options.folder));
  const out = resolve(options.out);
  // The skill set (exit 2 for a folder that cannot be read), then the output folder against both inputs.
  const validated = validateLoaded(loaded);
  const skills = await skillsInUse(options.skills, loaded, validated, catalogue, ops);
  // The skill-set refusals (exit 2) come first: checkOutput can stop with exit 1 on a staging folder left with old/.
  refuseSkillsOutput(realTarget(out, ops), skills, ops);
  const checked = checkOutput(out, catalogue, ops);
  const { target } = checked;
  // Exit-1 stops come after every exit-2 check and before anything is created.
  skillsStops(skills);

  // From here on, every change first checks that the output folder is still the validated one.
  const identity = checked.identity ?? createOutput(target, ops);
  removeStaging(checked.stale, identity, ops);
  const staging = join(target, `${STAGING_PREFIX}${randomBytes(8).toString('hex')}`);
  assertSameFolder(identity, ops);
  ops.mkdir(staging);
  let prepared: PreparedBuild;
  try {
    prepared = await prepareBuild(loaded, staging, options.date, packageVersion(), skills.set);
    publish(target, staging, identity, ops);
  } catch (error) {
    throw failedBuild(error, staging, identity, ops);
  }

  // Committed: the new sites are in place. Removing the replaced entries is best effort.
  const warnings = cleanUp(staging, identity, ops);
  process.stderr.write(report(prepared, out, [...skills.notes, ...warnings]));
}
