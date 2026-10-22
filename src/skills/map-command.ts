/** `stackledger skills map [folder...] --out <folder> [--check]` (skills-map-command spec). Called by
 * src/skills/command.ts; run `node dist/cli.js skills map . --out docs/skills-map` in a skills repository.
 *
 * Reads one skill set exactly as `skills validate` does (src/skills/source.ts), turns it into a graph
 * (graph.ts) and pages (mermaid.ts), and writes them into the map folder, or with `--check` only
 * compares them with it. This module does all the I/O; graph.ts and mermaid.ts are pure.
 *
 * Order, so that a refusal never changes anything:
 * 1. Options (exit 2): `--out` is required; unknown options are refused by parseArgs.
 * 2. The skill set; a given folder that is missing, not a folder or cannot be listed is exit 2.
 * 3. The map folder, after resolving links (exit 2): not, and not holding, a given folder or the real
 *    path of any skill folder or agent file the walk found (rejected ones included: a tool folder's
 *    link can point into the map, and cleaning would delete the source); not inside such a skill
 *    folder; not the top-level `agents/` of a given folder nor inside it (its README.md would be read
 *    as an agent); no segment below the current folder starting with `.` (tool folders such as
 *    `.claude/commands` load Markdown as instructions) or named `openspec`. An existing folder is
 *    empty or holds a valid marker, and the marker, `.gitattributes`, README.md and the kind folders
 *    are not symbolic links.
 * 4. A given folder with nothing found in it (a wrong path, or an ignore file hiding everything) is
 *    exit 1 with nothing changed, so a mistake cannot empty the map.
 * 5. The difference between the wanted files and the owned entries: create, update, remove. With
 *    `--check`, one stderr line each and exit 1 when there is any; nothing is written. CRLF is read
 *    as LF there, for checkouts made before `.gitattributes` existed.
 * 6. Writes: the device and inode of the map folder and of each kind folder are compared with those
 *    recorded in step 3 right before the first change (and before every later one); a difference
 *    is exit 1, naming the folder. Each file is written to a new temporary file in its own folder and
 *    renamed into place, so a symbolic or hard link at a page path is replaced, never written
 *    through, and a page is never half-written. Stale entries below a kind folder are removed
 *    without following links. The marker goes first, so an interrupted first run leaves a folder
 *    the next run accepts; there is no atomic swap of the whole folder (run the command again).
 *
 * stdout stays empty. stderr gives the pages created, updated and removed and, with problems, their
 * counts and the `skills validate` hint. A write failure is exit 1 naming the file. No network.
 *
 * Every filesystem call on the map folder goes through `ops`. src/skills/command.ts passes none, so the
 * CLI uses node:fs; test/integration/skills-map-with-faults.mjs passes a wrapper that swaps the folder.
 */
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, type Stats } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { withoutControls } from '../control.js';
import { internal, InternalError } from '../errors.js';
import { within } from '../site/paths.js';
import { buildGraph } from './graph.js';
import { INDEX_PAGE, KIND_FOLDERS, renderMap } from './mermaid.js';
import { NOTHING_FOUND, readSkillSet, type SkillSet } from './source.js';
import { SkillsFolderError } from './walk.js';

export const MARKER_NAME = '.stackledger-skills-map';
export const MARKER = 'stackledger skills map\n';
export const ATTRIBUTES_NAME = '.gitattributes';
/** Keeps LF in every checkout, so the pages stay byte for byte what the command writes. */
export const ATTRIBUTES = '* text eol=lf\n';
const KIND_NAMES = Object.values(KIND_FOLDERS);
/** Owned top-level files; a link or a non-file there is refused rather than replaced. */
const OWNED_FILES = [MARKER_NAME, ATTRIBUTES_NAME, INDEX_PAGE];
const TEMPORARY_PREFIX = '.stackledger-skills-map-';
const COMMAND = 'stackledger skills map';

/** The filesystem calls the command makes on the map folder; each throws the error node:fs throws. */
export interface MapFsOps {
  /** The entry's own status; a symbolic link is not followed. */
  lstat(path: string): Stats;
  /** The path with every symbolic link resolved. */
  realpath(path: string): string;
  readdir(path: string): string[];
  /** A regular file read as UTF-8. */
  readFile(path: string): string;
  mkdir(path: string, options?: { recursive: boolean }): void;
  /** Create a new file with this text; fails when anything, a link included, is already at the path. */
  writeNew(path: string, text: string): void;
  /** Rename within one folder (atomic; replaces a file or link at the target, never writing through it). */
  rename(from: string, to: string): void;
  /** Remove an entry and, for a folder, everything in it; links are removed, not followed. */
  rm(path: string): void;
}
export const NODE_MAP_FS: MapFsOps = {
  lstat: path => lstatSync(path),
  realpath: path => realpathSync.native(path),
  readdir: path => readdirSync(path),
  readFile: path => readFileSync(path, 'utf8'),
  mkdir: (path, options) => { mkdirSync(path, options); },
  writeNew: (path, text) => writeFileSync(path, text, { flag: 'wx' }),
  rename: (from, to) => renameSync(from, to),
  rm: path => rmSync(path, { recursive: true, force: true }),
};

function lstatOrUndefined(path: string, ops: MapFsOps): Stats | undefined {
  try { return ops.lstat(path); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
}

/** The real path of `path`, or of its nearest existing ancestor joined with the missing rest. */
function realTarget(path: string, ops: MapFsOps): string {
  const missing: string[] = [];
  let current = path;
  for (;;) {
    try { return join(ops.realpath(current), ...missing.reverse()); } catch (error) {
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

/** A folder's identity, compared again before the first change. */
interface Identity { path: string; label: string; dev: number; ino: number }
interface CheckedOutput {
  target: string;
  /** False when the map folder does not exist yet. */
  exists: boolean;
  identities: Identity[];
}

/** Step 3: refuse a map folder that would touch an input or is not stackledger's (usage errors, exit 2). */
function checkOutput(out: string, given: string[], set: SkillSet, current: string, ops: MapFsOps): CheckedOutput {
  const target = realTarget(out, ops);
  for (const folder of given) {
    if (within(folder, target)) throw new Error('Output folder must not be a given folder or contain one');
    let agents = join(folder, 'agents');
    try { agents = ops.realpath(agents); } catch { /* No agents folder (or a broken link): its plain path is checked. */ }
    if (within(target, agents)) throw new Error('Output folder must not be the agents folder of a given folder or inside it');
  }
  for (const found of set.found) {
    if (within(found, target)) throw new Error(`Output folder must not hold a skill folder or agent file of the set: ${found}`);
    if (within(target, found)) throw new Error(`Output folder must not be inside a skill folder of the set: ${found}`);
  }
  const below = relative(current, target);
  if (within(target, current) && below) {
    const segment = below.split(sep).find(name => name.startsWith('.') || name === 'openspec');
    if (segment !== undefined) throw new Error(`Output folder must not be inside a folder named ${segment} (tool folders load Markdown as instructions)`);
  }

  let stats: Stats;
  try { stats = ops.lstat(target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { target, exists: false, identities: [] };
    throw new Error('Output folder cannot be read');
  }
  if (!stats.isDirectory()) throw new Error('Output path is not a folder');
  let entries: string[];
  try { entries = ops.readdir(target); } catch { throw new Error('Output folder cannot be read'); }
  if (entries.length && !isMarker(join(target, MARKER_NAME), ops)) {
    throw new Error(`Output folder is not empty and was not written by ${COMMAND} (no ${MARKER_NAME} file holding "${MARKER.trim()}")`);
  }
  const identities: Identity[] = [{ path: target, label: 'the output folder', dev: stats.dev, ino: stats.ino }];
  for (const name of [...OWNED_FILES, ...KIND_NAMES]) {
    const entry = lstatOrUndefined(join(target, name), ops);
    if (!entry) continue;
    if (entry.isSymbolicLink()) throw new Error(`Output folder entry ${name} is a symbolic link; ${COMMAND} does not write through links`);
    const folder = KIND_NAMES.includes(name);
    if (folder && !entry.isDirectory()) throw new Error(`Output folder entry ${name} is not a folder`);
    if (!folder && !entry.isFile()) throw new Error(`Output folder entry ${name} is not a regular file`);
    if (folder) identities.push({ path: join(target, name), label: `the folder ${name} of the output folder`, dev: entry.dev, ino: entry.ino });
  }
  return { target, exists: true, identities };
}

/** True when `path` is a regular file (not a link, not a folder) holding exactly the marker text. */
function isMarker(path: string, ops: MapFsOps): boolean {
  const stats = lstatOrUndefined(path, ops);
  if (!stats?.isFile() || stats.size !== Buffer.byteLength(MARKER)) return false;
  return ops.readFile(path) === MARKER;
}

interface Change {
  action: 'create' | 'update' | 'remove';
  /** Path inside the map folder, `/`-separated; a folder to remove ends with `/`. */
  path: string;
  absolute: string;
  /** The text to write (create, update). */
  text?: string;
}

const absoluteIn = (target: string, path: string) => join(target, ...path.split('/'));
const lf = (text: string) => text.replaceAll('\r\n', '\n');

/** Step 5: what would change. `check` reads CRLF as LF; a run compares bytes, so it also rewrites CRLF. */
function differences(checked: CheckedOutput, wanted: Map<string, string>, check: boolean, ops: MapFsOps): Change[] {
  const { target } = checked;
  const changes: Change[] = [];
  for (const [path, text] of wanted) {
    const absolute = absoluteIn(target, path);
    const stats = checked.exists ? lstatOrUndefined(absolute, ops) : undefined;
    if (!stats) { changes.push({ action: 'create', path, absolute, text }); continue; }
    // A link, a folder or anything else at a page path is replaced by the page.
    const current = stats.isFile() ? ops.readFile(absolute) : undefined;
    const same = current !== undefined && (check ? lf(current) === text : current === text);
    if (!same) changes.push({ action: 'update', path, absolute, text });
  }
  if (!checked.exists) return changes;
  for (const kind of KIND_NAMES) {
    const folder = join(target, kind);
    if (!lstatOrUndefined(folder, ops)) continue;
    for (const name of ops.readdir(folder)) {
      const path = `${kind}/${name}`;
      if (wanted.has(path)) continue;
      const stats = ops.lstat(join(folder, name));
      changes.push({ action: 'remove', path: stats.isDirectory() ? `${path}/` : path, absolute: join(folder, name) });
    }
  }
  return changes.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

/** Thrown when a recorded folder is no longer the same one: nothing more is changed. */
function assertSame(identities: Identity[], ops: MapFsOps): void {
  for (const identity of identities) {
    const now = lstatOrUndefined(identity.path, ops);
    if (!now?.isDirectory() || now.dev !== identity.dev || now.ino !== identity.ino) {
      throw new InternalError(`${COMMAND}: ${identity.label} ${identity.path} was moved or replaced during the run; stopped before changing anything more`);
    }
  }
}

/** Run one change, wrapping a failure as exit 1 naming the path. */
function attempt(path: string, verb: string, action: () => void): void {
  try { action(); } catch (error) {
    if (error instanceof InternalError) throw error;
    const code = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
    throw new InternalError(`${COMMAND}: cannot ${verb} ${path} in the output folder (${code})`);
  }
}

/** Step 6: apply the changes; returns nothing, throws InternalError (exit 1) on a failure. */
function apply(checked: CheckedOutput, changes: Change[], ops: MapFsOps): void {
  const { target } = checked;
  const identities = [...checked.identities];
  if (checked.exists) assertSame(identities, ops);
  else {
    attempt('.', 'create', () => ops.mkdir(target, { recursive: true }));
    const stats = ops.lstat(target);
    identities.push({ path: target, label: 'the output folder', dev: stats.dev, ino: stats.ino });
  }
  // The marker first: an interrupted first run then leaves a folder the next run accepts.
  const ordered = [...changes.filter(change => change.path === MARKER_NAME), ...changes.filter(change => change.path !== MARKER_NAME && change.action !== 'remove'),
    ...changes.filter(change => change.action === 'remove')];
  for (const change of ordered) {
    assertSame(identities, ops);
    if (change.action === 'remove') { attempt(change.path, 'remove', () => ops.rm(change.absolute)); continue; }
    const folder = dirname(change.absolute);
    if (folder !== target && !lstatOrUndefined(folder, ops)) {
      attempt(relative(target, folder), 'create', () => ops.mkdir(folder));
      const stats = ops.lstat(folder);
      identities.push({ path: folder, label: `the folder ${basename(folder)} of the output folder`, dev: stats.dev, ino: stats.ino });
    }
    attempt(change.path, 'write', () => {
      const existing = lstatOrUndefined(change.absolute, ops);
      // rename() cannot replace a folder: a folder at a page path is removed first (without following links).
      if (existing?.isDirectory()) ops.rm(change.absolute);
      const temporary = join(folder, `${TEMPORARY_PREFIX}${randomBytes(8).toString('hex')}.tmp`);
      try {
        ops.writeNew(temporary, change.text!);
        ops.rename(temporary, change.absolute);
      } catch (error) {
        try { ops.rm(temporary); } catch { /* The write failure below is what the person needs to see. */ }
        throw error;
      }
    });
  }
  // A kind folder left empty is removed, as Git would not keep it either.
  for (const kind of KIND_NAMES) {
    const folder = join(target, kind);
    const stats = lstatOrUndefined(folder, ops);
    if (!stats?.isDirectory() || ops.readdir(folder).length) continue;
    assertSame(identities, ops);
    attempt(`${kind}/`, 'remove', () => ops.rm(folder));
    // The removed folder is no longer one to compare.
    identities.splice(identities.findIndex(identity => identity.path === folder), 1);
  }
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;
function problemLine(set: SkillSet): string[] {
  const { errors, warnings } = set.summary;
  if (!errors && !warnings) return [];
  return [`${COMMAND}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}; run stackledger skills validate for details`];
}

/** Run `stackledger skills map …` with the whole argument list (`skills map` first). */
export async function skillsMapCommand(args: string[], ops: MapFsOps = NODE_MAP_FS): Promise<void> {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true, options: { out: { type: 'string' }, check: { type: 'boolean' } } });
  const folders = positionals.slice(2);
  if (values.out === undefined || values.out === '') throw new Error('--out is required');
  const cwd = process.cwd();
  let set: SkillSet;
  try { set = await readSkillSet(folders); } catch (error) {
    if (error instanceof SkillsFolderError) throw new Error(error.message);
    throw internal('skills map', error);
  }
  const current = ops.realpath(cwd);
  const given = (folders.length ? folders : ['.']).map(folder => ops.realpath(resolve(cwd, folder)));
  const checked = checkOutput(resolve(cwd, values.out), given, set, current, ops);
  const display = withoutControls(values.out);

  const empty = set.problems.find(problem => problem.message.startsWith(NOTHING_FOUND));
  if (empty) throw new InternalError(`${COMMAND}: ${withoutControls(empty.path)}: ${NOTHING_FOUND}; the map in ${display} is not changed`);

  const pages = renderMap(buildGraph(set), set.summary, { current, out: checked.target });
  const wanted = new Map([[MARKER_NAME, MARKER], [ATTRIBUTES_NAME, ATTRIBUTES], ...pages]);
  const changes = differences(checked, wanted, values.check === true, ops);
  const lines = problemLine(set);
  if (values.check) {
    const report = changes.map(change => `${change.action} ${withoutControls(change.path)}`);
    report.push(changes.length ? `The skills map in ${display} is out of date: run ${COMMAND} without --check` : `The skills map in ${display} is up to date`);
    process.stderr.write([...report, ...lines].join('\n') + '\n');
    process.exitCode = changes.length ? 1 : 0;
    return;
  }
  if (changes.length) apply(checked, changes, ops);
  const count = (action: Change['action']) => changes.filter(change => change.action === action).length;
  const summary = changes.length
    ? `Wrote the skills map in ${display}: ${count('create')} created, ${count('update')} updated, ${count('remove')} removed`
    : `The skills map in ${display} is up to date; nothing changed`;
  process.stderr.write([summary, ...lines].join('\n') + '\n');
}
