/** Find the skill folders and agent files of a skill set (skill-source spec: Finding skill folders,
 * Files and links, Symbolic links to folders, One read per item, Folders that cannot be read).
 * Used by src/skills/source.ts; only lists folders and stats entries, never reads file contents.
 *
 * Why the walk is shaped this way:
 * - Folders are walked depth first, entries in code-point order, at most MAX_DEPTH levels below each
 *   given folder, so the result does not depend on the order the file system lists entries in.
 * - A symbolic link to a folder is read only when that folder holds a SKILL.md, and is never walked
 *   into; any other link gets one warning. So the walk cannot loop, and nothing outside the given
 *   folders is read except linked skill folders and linked files.
 * - Items (skill folders, agent files) are identified by the device and inode numbers of their
 *   targets, so an item reached through a link, a second spelling of a folder or two given folders is
 *   read once, at its first path. Problems about one entry are deduplicated the same way.
 *
 * A given folder that is missing, not a folder or cannot be listed throws SkillsFolderError (the
 * command turns it into exit 2); every other failure is a problem on its path and the walk goes on.
 */
import { lstat, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { compareText } from '../identity.js';
import { fileProblem, type Problem } from '../source.js';

/** How many folder levels below a given folder are looked at: `a/b/c/d/e/SKILL.md` is read, `a/b/c/d/e/f/SKILL.md` is not. */
export const MAX_DEPTH = 5;
export const SKILL_FILE = 'SKILL.md';
export const RULES_FILE = 'rules.md';
const AGENTS_FOLDER = 'agents';

/** Lists the entry names of a folder; injectable so tests can return them in another order. */
export type ListFolder = (path: string) => Promise<string[]>;
const listFolder: ListFolder = path => readdir(path);

/** A given folder that cannot be checked at all: a command failure, not a problem. */
export class SkillsFolderError extends Error {
  override name = 'SkillsFolderError';
}

export interface FoundSkill {
  type: 'skill';
  /** Display path of the skill folder (the argument prefix, then `/`-separated names). */
  folder: string;
  /** Name of the folder or link where the skill was found: the name the tool sees. */
  folderName: string;
  /** Absolute path of the skill folder, at the path where it was found (through a link if any). */
  absolute: string;
  /** Whether the folder holds an entry named exactly `rules.md`. */
  hasRules: boolean;
}
export interface FoundAgent {
  type: 'agent';
  /** Display path of the agent file. */
  path: string;
  absolute: string;
}
export type Found = FoundSkill | FoundAgent;
export interface Walked {
  /** Every item in walk order, each one once. */
  items: Found[];
  problems: Problem[];
  /** Per given folder, in argument order: its display name and how many items were found in it,
   * counting those already found through an earlier folder. */
  folders: { path: string; found: number }[];
}
export interface WalkOptions { cwd?: string; list?: ListFolder }

/** Remove trailing separators from a folder argument: `repo/` and `repo//` both display as `repo`. */
function trimSeparators(argument: string): string {
  const trimmed = argument.replace(process.platform === 'win32' ? /[\\/]+$/ : /\/+$/, '');
  // The root folder is only separators: keep one, or every path would print as relative.
  return trimmed || argument.slice(0, 1);
}
function below(prefix: string, relative: string): string {
  if (!prefix) return relative;
  return prefix.endsWith('/') ? prefix + relative : `${prefix}/${relative}`;
}
function identity(info: { dev: bigint; ino: bigint }): string {
  return `${info.dev}:${info.ino}`;
}
async function isRegularFile(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); } catch { return false; }
}
function hidden(name: string): boolean {
  return name === 'node_modules' || name.startsWith('.');
}

/** Walk the given folders (none: the current folder) in argument order. */
export async function walkSkillFolders(folders: string[], options: WalkOptions = {}): Promise<Walked> {
  const cwd = options.cwd ?? process.cwd();
  const list = options.list ?? listFolder;
  const walked: Walked = { items: [], problems: [], folders: [] };
  const seenItems = new Set<string>();
  const seenProblems = new Set<string>();
  let found = 0;

  function problemOnce(key: string, problem: Problem): void {
    if (seenProblems.has(key)) return;
    seenProblems.add(key); walked.problems.push(problem);
  }
  /** Record an item reached at `key`; it counts as found for the given folder even when already read. */
  function addItem(key: string, item: Found): void {
    found++;
    if (seenItems.has(key)) return;
    seenItems.add(key); walked.items.push(item);
  }
  async function listOrProblem(absolute: string, display: string, entryKey: string, message: string): Promise<string[] | undefined> {
    try { return await list(absolute); } catch {
      problemOnce(`unlisted:${entryKey}`, fileProblem(display, message)); return undefined;
    }
  }
  /** The item key of a target, or undefined (with an error on its path) when it vanished after listing. */
  async function itemKey(absolute: string, display: string): Promise<string | undefined> {
    try { return identity(await stat(absolute, { bigint: true })); } catch {
      problemOnce(`entry:${absolute}`, fileProblem(display, 'Entry cannot be read')); return undefined;
    }
  }
  async function addSkill(absolute: string, folder: string, folderName: string, names: string[]): Promise<void> {
    const key = await itemKey(absolute, folder || '.');
    if (key) addItem(`skill:${key}`, { type: 'skill', folder, folderName, absolute, hasRules: names.includes(RULES_FILE) });
  }
  async function addAgent(absolute: string, path: string): Promise<void> {
    const key = await itemKey(absolute, path);
    if (key) addItem(`agent:${key}`, { type: 'agent', path, absolute });
  }
  async function holdsSkill(absolute: string, names: string[]): Promise<boolean> {
    return names.includes(SKILL_FILE) && await isRegularFile(join(absolute, SKILL_FILE));
  }

  /** Walk the entries of a listed folder that is not a skill folder, `depth` levels below the given folder. */
  async function walkEntries(absolute: string, relative: string, depth: number, names: string[], prefix: string): Promise<void> {
    if (depth >= MAX_DEPTH) return;
    const agents = depth === 1 && relative === AGENTS_FOLDER;
    for (const name of [...names].sort(compareText)) {
      // Hidden entries and dependencies are skipped before any other check, links included.
      if (hidden(name)) continue;
      const childAbsolute = join(absolute, name);
      const childRelative = relative ? `${relative}/${name}` : name;
      const display = below(prefix, childRelative);
      let entry;
      try { entry = await lstat(childAbsolute, { bigint: true }); } catch {
        problemOnce(`entry:${childAbsolute}`, fileProblem(display, 'Entry cannot be read')); continue;
      }
      const entryKey = identity(entry);
      if (entry.isSymbolicLink()) {
        let target;
        try { target = await stat(childAbsolute, { bigint: true }); } catch (error) {
          // A loop of links (ELOOP) is not a missing target (ENOENT): say which one it is.
          const message = (error as NodeJS.ErrnoException).code === 'ELOOP'
            ? 'Symbolic link cannot be resolved (it loops); not followed' : 'Symbolic link is broken; not followed';
          problemOnce(`link:${entryKey}`, fileProblem(display, message, 'warning')); continue;
        }
        if (target.isFile()) {
          // A file link is read where a file is expected (an agent file); elsewhere it is ignored like any file.
          if (agents && name.endsWith('.md')) await addAgent(childAbsolute, display);
          continue;
        }
        if (!target.isDirectory()) {
          problemOnce(`link:${entryKey}`, fileProblem(display, 'Symbolic link leads to neither a file nor a folder; not followed', 'warning')); continue;
        }
        const linkedNames = await listOrProblem(childAbsolute, display, entryKey, 'Linked folder cannot be read');
        if (!linkedNames) continue;
        // A linked folder is read only as a skill folder and never walked into, so the walk cannot loop.
        if (await holdsSkill(childAbsolute, linkedNames)) await addSkill(childAbsolute, display, name, linkedNames);
        else problemOnce(`link:${entryKey}`, fileProblem(display, 'Symbolic link does not lead to a skill folder; not followed', 'warning'));
        continue;
      }
      if (entry.isDirectory()) {
        const childNames = await listOrProblem(childAbsolute, display, entryKey, 'Folder cannot be read');
        if (!childNames) continue;
        if (await holdsSkill(childAbsolute, childNames)) await addSkill(childAbsolute, display, name, childNames);
        else await walkEntries(childAbsolute, childRelative, depth + 1, childNames, prefix);
        continue;
      }
      if (entry.isFile() && agents && name.endsWith('.md')) await addAgent(childAbsolute, display);
    }
  }

  for (const argument of folders.length ? folders : [undefined]) {
    const prefix = argument === undefined ? '' : trimSeparators(argument);
    // How the given folder itself is named in problems and failures.
    const self = argument === undefined || argument === '' ? '.' : prefix || argument;
    const absolute = resolve(cwd, argument ?? '.');
    let info;
    try { info = await stat(absolute); } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      throw new SkillsFolderError(code === 'ENOENT' || code === 'ENOTDIR' ? `Skills folder was not found: ${self}` : `Skills folder cannot be read: ${self}`);
    }
    if (!info.isDirectory()) throw new SkillsFolderError(`Skills path is not a folder: ${self}`);
    let names;
    try { names = await list(absolute); } catch { throw new SkillsFolderError(`Skills folder cannot be read: ${self}`); }
    found = 0;
    // A given folder that is a skill folder gives that one skill, and no agents.
    if (await holdsSkill(absolute, names)) await addSkill(absolute, prefix, basename(absolute), names);
    else await walkEntries(absolute, '', 0, names, prefix);
    walked.folders.push({ path: self, found });
  }
  return walked;
}
