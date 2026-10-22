/** Read the `.stackledgerignore` file at the top of a given folder (skill-source spec: Ignore file,
 * Ignore file syntax, Ignore file text, Ignore file limits, Ignore file problems). Used by
 * src/skills/walk.ts, which tests entries against the matcher this returns. Only reads.
 *
 * Why it is shaped this way:
 * - The patterns are `.gitignore` lines, matched by the `ignore` package (pinned at 7.0.13), which
 *   follows Git; writing our own matcher would get an edge case wrong and hide a skill silently.
 *   Matching is case-sensitive (`ignorecase: false`) so macOS and Linux give the same set.
 * - The file is an input a fork's pull request can change, so its cost is bounded: 64 KiB, at most 100
 *   pattern lines, 200 characters and 16 wildcard characters per line. Each line is also compiled on
 *   its own when the file is read, so a line the matcher cannot handle is an error before any entry is
 *   tested. Measured worst case at these limits: about 1.3 s against 5,000 deep paths.
 * - Any problem means no pattern of the file is used: reading too much is loud (the run shows the extra
 *   items' problems), hiding too much would be silent.
 * - Messages are fixed texts naming at most a line number: the file's text never reaches the output.
 *
 * What can go wrong: a problem with the file is returned as problems on its display path, with the key
 * (device and inode) that reports them once per run. Only a matcher that throws after the file was
 * accepted throws, as IgnoreMatcherError, which the command reports as an internal failure.
 */
import { lstat, stat } from 'node:fs/promises';
import { join } from 'node:path';
import ignore from 'ignore';
import { fileProblem, type Problem } from '../source.js';
import { readBounded, secretProblems } from './read.js';

export const IGNORE_FILE = '.stackledgerignore';
export const MAX_IGNORE_BYTES = 64 * 1024;
export const MAX_PATTERN_LINES = 100;
export const MAX_PATTERN_CHARACTERS = 200;
export const MAX_PATTERN_WILDCARDS = 16;
const NO_PATTERNS = 'no pattern of this file is used';
const BYTE_ORDER_MARK = '\uFEFF';

/** What the walk needs from a matcher: whether a path relative to the given folder is ignored. */
export interface Matcher { ignores(path: string): boolean }
/** Builds the matcher of one file's pattern lines; injectable so a test can make matching fail. */
export type CreateMatcher = (patterns: string[]) => Matcher;
export const createMatcher: CreateMatcher = patterns => ignore({ ignorecase: false }).add(patterns);

export type IgnoreFile =
  | { status: 'read'; matcher: Matcher }
  /** `key` identifies the file (its target, or the entry itself when that cannot be resolved). */
  | { status: 'problem'; key: string; problems: Problem[] };

function identity(info: { dev: bigint; ino: bigint }): string {
  return `${info.dev}:${info.ino}`;
}
/** A line that adds a rule, as Git reads it: not a `#` comment and not empty once trailing spaces are dropped.
 * Only these count towards the limits, so comments and blank lines cost nothing. */
function isPatternLine(line: string): boolean {
  return !line.startsWith('#') && line.replace(/ +$/, '') !== '';
}
function wildcards(line: string): number {
  // Escaped wildcards count too: the limit is on the line as written, the simplest bound to explain.
  return [...line].filter(character => character === '*' || character === '?' || character === '[').length;
}
/** Whether the `ignore` package can compile the line. Rules compile lazily, on their first test, so
 * the probe tests one path; `test` (not `ignores`) also runs negative rules. */
function compiles(line: string): boolean {
  try { ignore({ ignorecase: false }).add(line).test('x'); return true; } catch { return false; }
}

/** The patterns of a text read from an ignore file, or the problem with its lines. */
function patternsOf(path: string, text: string): { patterns: string[] } | { problem: Problem } {
  const lines = (text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text).split(/\r?\n/);
  let patternLines = 0;
  for (const [index, line] of lines.entries()) {
    if (!isPatternLine(line)) continue;
    const number = index + 1;
    if (++patternLines > MAX_PATTERN_LINES) {
      return { problem: fileProblem(path, `Ignore file has more than ${MAX_PATTERN_LINES} pattern lines (line ${number}); ${NO_PATTERNS}`) };
    }
    if ([...line].length > MAX_PATTERN_CHARACTERS) {
      return { problem: fileProblem(path, `Pattern at line ${number} is longer than ${MAX_PATTERN_CHARACTERS} characters; ${NO_PATTERNS}`) };
    }
    if (wildcards(line) > MAX_PATTERN_WILDCARDS) {
      return { problem: fileProblem(path, `Pattern at line ${number} has more than ${MAX_PATTERN_WILDCARDS} wildcard characters; ${NO_PATTERNS}`) };
    }
    if (!compiles(line)) return { problem: fileProblem(path, `Pattern at line ${number} cannot be compiled; ${NO_PATTERNS}`) };
  }
  return { patterns: lines };
}

/** Read the ignore file of the given folder `folder` (absolute), known to hold an entry with that name;
 * `path` is its display path. */
export async function readIgnoreFile(folder: string, path: string, create: CreateMatcher = createMatcher): Promise<IgnoreFile> {
  const absolute = join(folder, IGNORE_FILE);
  const problem = (key: string, message: string): IgnoreFile => ({ status: 'problem', key, problems: [fileProblem(path, `${message}; ${NO_PATTERNS}`)] });
  let entry;
  // Vanished since the listing, or not even stat-able: no device and inode, so the absolute path is the key.
  try { entry = await lstat(absolute, { bigint: true }); } catch { return problem(`path:${absolute}`, 'Ignore file cannot be read'); }
  let target = entry;
  if (entry.isSymbolicLink()) {
    try { target = await stat(absolute, { bigint: true }); } catch {
      return problem(identity(entry), 'Ignore file is a symbolic link that is broken or loops');
    }
  }
  const key = identity(target);
  if (!target.isFile()) return problem(key, 'Ignore file is not a regular file');
  const read = await readBounded(absolute, path, { bytes: MAX_IGNORE_BYTES,
    tooLarge: `Ignore file is larger than 64 KiB; ${NO_PATTERNS}`, unreadable: `Ignore file cannot be read; ${NO_PATTERNS}` });
  if ('problem' in read) return { status: 'problem', key, problems: [read.problem] };
  const secrets = secretProblems(path, [read.text]);
  if (secrets.length) return { status: 'problem', key, problems: secrets };
  const parsed = patternsOf(path, read.text);
  if ('problem' in parsed) return { status: 'problem', key, problems: [parsed.problem] };
  let matcher;
  try { matcher = create(parsed.patterns); } catch { throw new IgnoreMatcherError(); }
  return { status: 'read', matcher };
}

/** The matcher failed after its file was read: a bug, so an internal failure. The message is fixed, because
 * the matcher's own message can repeat a pattern or the tested path. */
export class IgnoreMatcherError extends Error {
  override name = 'IgnoreMatcherError';
  constructor() { super('the ignore file matcher failed'); }
}
/** Whether `matcher` ignores `path`, turning any exception into an IgnoreMatcherError. */
export function ignores(matcher: Matcher, path: string): boolean {
  try { return matcher.ignores(path); } catch { throw new IgnoreMatcherError(); }
}
