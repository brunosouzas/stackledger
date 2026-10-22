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
 *    path of any skill folder, agent file, SKILL.md or rules.md the walk found (rejected ones
 *    included: a tool folder's link can point into the map, and cleaning would delete the source);
 *    not inside such a skill folder; not the top-level `agents/` of a given folder nor inside it (its
 *    README.md would be read as an agent); no segment below the current folder, nor from a given
 *    folder that holds it down (the given folder's own name included, so `~/.claude` given is a tool
 *    folder), starting with `.` (tool folders such as `.claude/commands` load Markdown as
 *    instructions) or named `openspec`. `agents` and `openspec` are compared ignoring case, as a
 *    case-insensitive disk would. An existing folder is empty or holds a valid marker (LF or CRLF),
 *    and the marker, `.gitattributes`, README.md and the kind folders are not symbolic links. The
 *    identity (device and inode) of the map folder and of each kind folder, or its absence, is
 *    recorded.
 * 4. A given folder with nothing found in it (a wrong path, or an ignore file hiding everything) is
 *    exit 1 with nothing changed, so a mistake cannot empty the map.
 * 5. The difference between the wanted files and the owned entries: create, update, remove. Folder
 *    listings are compared by exact name, so on a case-insensitive disk a stray `skills/Writer.md` is
 *    not taken for `skills/writer.md`. Leftover `.stackledger-skills-map-*.tmp` files at the top are
 *    owned and removed. With `--check`, one stderr line each and exit 1 when there is any; nothing is
 *    written. CRLF is read as LF there, for checkouts made before `.gitattributes` existed. An entry
 *    that vanishes while it is compared is exit 1 (the folder changed); a page that cannot be read is
 *    an update, which replaces it by rename.
 * 6. Writes: before each change, the identity of the map folder and of each kind folder is compared
 *    with the one recorded in step 3; a difference, a folder that appeared where there was none (a
 *    link to elsewhere, say) or one that vanished is exit 1, naming the folder. Each file is written
 *    to a new temporary file in its own folder and renamed into place, so a symbolic or hard link at a
 *    page path is replaced, never written through, and a page is never half-written; a page written
 *    over a stray spelling is renamed to its own spelling. Stale entries below a kind folder are
 *    removed without following links, after the writes, and one that is the page just written under
 *    another spelling is kept. The marker goes first, so an interrupted first run leaves a folder the
 *    next run accepts; there is no atomic swap of the whole folder (run the command again).
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
/** The marker as a checkout without `.gitattributes` may have written it on Windows. */
const MARKER_CRLF = MARKER.replace('\n', '\r\n');
export const ATTRIBUTES_NAME = '.gitattributes';
/** Keeps LF in every checkout, so the pages stay byte for byte what the command writes. */
export const ATTRIBUTES = '* text eol=lf\n';
const KIND_NAMES = Object.values(KIND_FOLDERS);
/** Owned top-level files; a link or a non-file there is refused rather than replaced. */
const OWNED_FILES = [MARKER_NAME, ATTRIBUTES_NAME, INDEX_PAGE];
const TEMPORARY_PREFIX = '.stackledger-skills-map-';
const TEMPORARY_SUFFIX = '.tmp';
const isTemporary = (name: string) => name.startsWith(TEMPORARY_PREFIX) && name.endsWith(TEMPORARY_SUFFIX);
/** Folder names that load Markdown as instructions or as agents, compared in lowercase. */
const OPENSPEC_FOLDER = 'openspec';
const AGENTS_FOLDER = 'agents';
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

/** ENOENT and ENOTDIR: nothing is at the path (any more). */
const isMissing = (error: unknown) => ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException).code ?? (error as Error).message;

function lstatOrUndefined(path: string, ops: MapFsOps): Stats | undefined {
  try { return ops.lstat(path); } catch (error) {
    if (isMissing(error)) return undefined;
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

/** A folder's identity, compared again before each change; no `dev` and `ino`: it did not exist. */
interface Identity { path: string; label: string; dev?: number; ino?: number }
const kindLabel = (name: string) => `the folder ${name} of the output folder`;
const OUTPUT_LABEL = 'the output folder';
/** Exit 1 (no usage text): the map folder is not the one checked any more. */
const folderChanged = (label: string, path: string, what: string) =>
  new InternalError(`${COMMAND}: ${label} ${path} ${what} during the run; stopped before changing anything more`);
interface CheckedOutput {
  target: string;
  /** False when the map folder does not exist yet. */
  exists: boolean;
  identities: Identity[];
}

/** Step 3: refuse a map folder that would touch an input or is not stackledger's (usage errors, exit 2). */
function checkOutput(out: string, given: string[], set: SkillSet, current: string, ops: MapFsOps): CheckedOutput {
  const target = realTarget(out, ops);
  const toolFolder = (segments: string[]) => {
    const segment = segments.find(name => name.startsWith('.') || name.toLowerCase() === OPENSPEC_FOLDER);
    if (segment !== undefined) throw new Error(`Output folder must not be inside a folder named ${segment} (tool folders load Markdown as instructions)`);
  };
  for (const folder of given) {
    if (within(folder, target)) throw new Error('Output folder must not be a given folder or contain one');
    let agents = join(folder, AGENTS_FOLDER);
    try { agents = ops.realpath(agents); } catch { /* No agents folder (or a broken link): its plain path is checked. */ }
    const segments = segmentsBelow(folder, target);
    if (within(target, agents) || segments?.[0]?.toLowerCase() === AGENTS_FOLDER) {
      throw new Error('Output folder must not be the agents folder of a given folder or inside it');
    }
    // The given folder's own name counts: with `~/.claude` given, `~/.claude/commands/map` is in a tool folder.
    if (segments) toolFolder([basename(folder), ...segments].filter(Boolean));
  }
  for (const found of set.found) {
    if (within(found, target)) throw new Error(`Output folder must not hold a skill folder or agent file of the set, or a file read from one: ${found}`);
    if (within(target, found)) throw new Error(`Output folder must not be inside a skill folder of the set: ${found}`);
  }
  toolFolder(segmentsBelow(current, target) ?? []);

  let stats: Stats;
  try { stats = ops.lstat(target); } catch (error) {
    if (isMissing(error)) {
      const absent = [{ path: target, label: OUTPUT_LABEL }, ...KIND_NAMES.map(name => ({ path: join(target, name), label: kindLabel(name) }))];
      return { target, exists: false, identities: absent };
    }
    throw new Error('Output folder cannot be read');
  }
  if (!stats.isDirectory()) throw new Error('Output path is not a folder');
  let entries: string[];
  try { entries = ops.readdir(target); } catch { throw new Error('Output folder cannot be read'); }
  if (entries.length && !isMarker(join(target, MARKER_NAME), ops)) {
    throw new Error(`Output folder is not empty and was not written by ${COMMAND} (no ${MARKER_NAME} file holding "${MARKER.trim()}")`);
  }
  const identities: Identity[] = [{ path: target, label: OUTPUT_LABEL, dev: stats.dev, ino: stats.ino }];
  for (const name of [...OWNED_FILES, ...KIND_NAMES]) {
    const folder = KIND_NAMES.includes(name);
    let entry: Stats | undefined;
    try { entry = lstatOrUndefined(join(target, name), ops); } catch { throw new Error(`Output folder entry ${name} cannot be read`); }
    // An absent kind folder is recorded too: one that appears before a write (a link to elsewhere) stops the run.
    if (!entry) { if (folder) identities.push({ path: join(target, name), label: kindLabel(name) }); continue; }
    if (entry.isSymbolicLink()) throw new Error(`Output folder entry ${name} is a symbolic link; ${COMMAND} does not write through links`);
    if (folder && !entry.isDirectory()) throw new Error(`Output folder entry ${name} is not a folder`);
    if (!folder && !entry.isFile()) throw new Error(`Output folder entry ${name} is not a regular file`);
    if (folder) identities.push({ path: join(target, name), label: kindLabel(name), dev: entry.dev, ino: entry.ino });
  }
  return { target, exists: true, identities };
}

/** The names of the path from `parent` down to `child`, or undefined when `child` is not inside it. */
function segmentsBelow(parent: string, child: string): string[] | undefined {
  if (!within(child, parent)) return undefined;
  return relative(parent, child).split(sep).filter(Boolean);
}

/** True when `path` is a regular file (not a link, not a folder) holding exactly the marker text, with
 * LF or CRLF. A marker that cannot be read is not valid (exit 2); one that vanished means the folder
 * changed (exit 1). */
function isMarker(path: string, ops: MapFsOps): boolean {
  let stats: Stats | undefined;
  try { stats = lstatOrUndefined(path, ops); } catch { return false; }
  const size = stats?.isFile() ? stats.size : -1;
  if (![MARKER, MARKER_CRLF].some(text => Buffer.byteLength(text) === size)) return false;
  let text: string;
  try { text = ops.readFile(path); } catch (error) {
    if (isMissing(error)) throw folderChanged(OUTPUT_LABEL, dirname(path), `lost its ${MARKER_NAME}`);
    return false;
  }
  return text === MARKER || text === MARKER_CRLF;
}

interface Change {
  action: 'create' | 'update' | 'remove';
  /** Path inside the map folder, `/`-separated; a folder to remove ends with `/`. */
  path: string;
  absolute: string;
  /** The text to write (create, update). */
  text?: string;
  /** A create where another spelling of the name answers (a case-insensitive disk): the page is
   * renamed to its own spelling once written. */
  respell?: boolean;
}

const absoluteIn = (target: string, path: string) => join(target, ...path.split('/'));
const lf = (text: string) => text.replaceAll('\r\n', '\n');

/** A read while comparing: an entry that vanished is exit 1 naming its folder; `fallback` decides any
 * other failure (undefined: exit 1 naming the entry). */
function comparing<T>(folder: { path: string; label: string }, entry: string, read: () => T, fallback?: () => T): T {
  try { return read(); } catch (error) {
    if (error instanceof InternalError) throw error;
    if (isMissing(error)) throw folderChanged(folder.label, folder.path, `changed (${entry} vanished)`);
    if (fallback) return fallback();
    throw new InternalError(`${COMMAND}: cannot read ${entry} in the output folder (${errorCode(error)})`);
  }
}

/** Step 5: what would change. `check` reads CRLF as LF; a run compares bytes, so it also rewrites CRLF. */
function differences(checked: CheckedOutput, wanted: Map<string, string>, check: boolean, ops: MapFsOps): Change[] {
  const { target } = checked;
  const changes: Change[] = [];
  // Each folder's entries by exact name ('' is the map folder); none when the folder does not exist.
  const listings = new Map<string, Set<string>>();
  if (checked.exists) {
    const top = { path: target, label: OUTPUT_LABEL };
    listings.set('', new Set(comparing(top, '.', () => ops.readdir(target))));
    for (const kind of KIND_NAMES) {
      const folder = { path: join(target, kind), label: kindLabel(kind) };
      if (!comparing(top, kind, () => lstatOrUndefined(folder.path, ops))) continue;
      listings.set(kind, new Set(comparing(folder, `${kind}/`, () => ops.readdir(folder.path))));
    }
  }
  for (const [path, text] of wanted) {
    const absolute = absoluteIn(target, path);
    const slash = path.indexOf('/');
    const kind = slash < 0 ? '' : path.slice(0, slash), name = path.slice(slash + 1);
    const listing = listings.get(kind);
    const folder = kind ? { path: join(target, kind), label: kindLabel(kind) } : { path: target, label: OUTPUT_LABEL };
    if (!listing?.has(name)) {
      // Not there under its own name; another spelling may answer for it (a case-insensitive disk).
      const respell = listing !== undefined && comparing(folder, path, () => lstatOrUndefined(absolute, ops)) !== undefined;
      changes.push({ action: 'create', path, absolute, text, ...(respell ? { respell } : {}) });
      continue;
    }
    const stats = comparing(folder, path, () => ops.lstat(absolute));
    // A link, a folder or anything else at a page path is replaced by the page; so is one that cannot be read.
    const current = stats.isFile() ? comparing(folder, path, () => ops.readFile(absolute), () => undefined) : undefined;
    const same = current !== undefined && (check ? lf(current) === text : current === text);
    if (!same) changes.push({ action: 'update', path, absolute, text });
  }
  for (const [kind, names] of listings) {
    const folder = kind ? { path: join(target, kind), label: kindLabel(kind) } : { path: target, label: OUTPUT_LABEL };
    for (const name of names) {
      const path = kind ? `${kind}/${name}` : name;
      if (wanted.has(path) || (!kind && !isTemporary(name))) continue;
      const stats = comparing(folder, path, () => ops.lstat(join(folder.path, name)));
      // At the top only leftover temporary files are owned; a folder of that name is left alone.
      if (!kind && stats.isDirectory()) continue;
      changes.push({ action: 'remove', path: stats.isDirectory() ? `${path}/` : path, absolute: join(folder.path, name) });
    }
  }
  return changes.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

/** Thrown when a recorded folder is no longer the same one, or appeared where there was none:
 * nothing more is changed. */
function assertSame(identities: Identity[], ops: MapFsOps): void {
  for (const identity of identities) {
    let now: Stats | undefined;
    try { now = lstatOrUndefined(identity.path, ops); } catch (error) {
      throw new InternalError(`${COMMAND}: ${identity.label} ${identity.path} cannot be checked (${errorCode(error)}); stopped before changing anything more`);
    }
    if (identity.dev === undefined) {
      if (now) throw folderChanged(identity.label, identity.path, 'appeared');
      continue;
    }
    if (!now?.isDirectory() || now.dev !== identity.dev || now.ino !== identity.ino) throw folderChanged(identity.label, identity.path, 'was moved or replaced');
  }
}
/** Record that the folder at `path` now exists, as created by this run. */
function recordCreated(identities: Identity[], path: string, ops: MapFsOps): void {
  const stats = ops.lstat(path);
  const identity = identities.find(known => known.path === path)!;
  identity.dev = stats.dev; identity.ino = stats.ino;
}

/** Run one change, wrapping a failure as exit 1 naming the path. */
function attempt(path: string, verb: string, action: () => void): void {
  try { action(); } catch (error) {
    if (error instanceof InternalError) throw error;
    throw new InternalError(`${COMMAND}: cannot ${verb} ${path} in the output folder (${errorCode(error)})`);
  }
}

/** Same file system entry: the same device and inode. */
const sameEntry = (left: Stats, right: Stats) => left.dev === right.dev && left.ino === right.ino;

/** After a page was renamed into place over another spelling of its name, give the entry its own
 * spelling (a case-insensitive disk keeps the old one on rename). */
function respell(change: Change, ops: MapFsOps): void {
  const folder = dirname(change.absolute), name = basename(change.absolute);
  const names = ops.readdir(folder);
  if (names.includes(name)) return;
  const written = ops.lstat(change.absolute);
  const alias = names.find(other => { const stats = lstatOrUndefined(join(folder, other), ops); return stats !== undefined && sameEntry(stats, written); });
  if (alias !== undefined) ops.rename(join(folder, alias), change.absolute);
}

/** True when a stale entry is, under another spelling, a page this run wants: removing it would remove
 * the page. One directory entry for the inode (or a name equal ignoring case) tells it from a hard link.
 * A stale entry that vanished means the folder changed (exit 1). */
function isWantedPage(change: Change, wanted: Set<string>, folder: Identity, ops: MapFsOps): boolean {
  const stale = lstatOrUndefined(change.absolute, ops);
  if (!stale) throw folderChanged(folder.label, folder.path, `changed (${change.path} vanished)`);
  if (!stale.isFile()) return false;
  const slash = change.path.lastIndexOf('/');
  const kind = change.path.slice(0, slash + 1), name = change.path.slice(slash + 1).toLowerCase();
  return [...wanted].some(path => {
    if (!path.startsWith(kind) || path.slice(kind.length).includes('/')) return false;
    const page = lstatOrUndefined(absoluteIn(dirname(change.absolute), path.slice(kind.length)), ops);
    return page !== undefined && sameEntry(page, stale) && (stale.nlink === 1 || path.slice(kind.length).toLowerCase() === name);
  });
}

/** Step 6: apply the changes; returns nothing, throws InternalError (exit 1) on a failure. */
function apply(checked: CheckedOutput, changes: Change[], wanted: Set<string>, ops: MapFsOps): void {
  const { target } = checked;
  const identities = checked.identities.map(identity => ({ ...identity }));
  assertSame(identities, ops);
  if (!checked.exists) {
    // The parents may be created; the map folder itself must be new (mkdir fails if anything appeared there).
    attempt('.', 'create', () => {
      if (!lstatOrUndefined(dirname(target), ops)) ops.mkdir(dirname(target), { recursive: true });
      ops.mkdir(target);
    });
    recordCreated(identities, target, ops);
  }
  // The marker first: an interrupted first run then leaves a folder the next run accepts.
  const ordered = [...changes.filter(change => change.path === MARKER_NAME), ...changes.filter(change => change.path !== MARKER_NAME && change.action !== 'remove'),
    ...changes.filter(change => change.action === 'remove')];
  for (const change of ordered) {
    assertSame(identities, ops);
    if (change.action === 'remove') {
      const folder = identities.find(identity => identity.path === dirname(change.absolute))!;
      attempt(change.path, 'remove', () => { if (!isWantedPage(change, wanted, folder, ops)) ops.rm(change.absolute); });
      continue;
    }
    const folder = dirname(change.absolute);
    const parent = identities.find(identity => identity.path === folder)!;
    if (parent.dev === undefined) {
      // Recorded as absent and checked just above: create it (mkdir fails if anything appeared since).
      attempt(relative(target, folder), 'create', () => ops.mkdir(folder));
      recordCreated(identities, folder, ops);
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
      if (change.respell) respell(change, ops);
    });
  }
  // A kind folder left empty is removed, as Git would not keep it either.
  for (const kind of KIND_NAMES) {
    const folder = join(target, kind);
    const stats = lstatOrUndefined(folder, ops);
    if (!stats?.isDirectory() || ops.readdir(folder).length) continue;
    assertSame(identities, ops);
    attempt(`${kind}/`, 'remove', () => ops.rm(folder));
    // The removed folder is now recorded as absent.
    const identity = identities.find(known => known.path === folder)!;
    delete identity.dev; delete identity.ino;
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
  if (changes.length) apply(checked, changes, new Set(wanted.keys()), ops);
  const count = (action: Change['action']) => changes.filter(change => change.action === action).length;
  const summary = changes.length
    ? `Wrote the skills map in ${display}: ${count('create')} created, ${count('update')} updated, ${count('remove')} removed`
    : `The skills map in ${display} is up to date; nothing changed`;
  process.stderr.write([summary, ...lines].join('\n') + '\n');
}
