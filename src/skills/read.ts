/** Bounded file reading and the secret check shared by the files of a skill set: SKILL.md, rules.md,
 * agent files (src/skills/source.ts) and the `.stackledgerignore` file (src/skills/ignore.ts).
 * Only reads; nothing is written.
 *
 * Why one reader: every file a skill set is read from comes from outside (a fork's pull request can
 * change it), so each one is opened once, non-blocking, and checked through its handle. A file swapped
 * for a FIFO or grown after the walk's check can then neither hang the run nor be read past its limit.
 *
 * What can go wrong: nothing throws; a file that is too large or cannot be read gives one problem at
 * `1:1` with a fixed message.
 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { fileProblem, type Problem } from '../source.js';
import { secretRules } from '../secrets.js';

export interface ReadLimit {
  /** Largest size in bytes that is read. */
  bytes: number;
  /** The fixed message for a file over the limit. */
  tooLarge: string;
  /** The fixed message for a file that cannot be read or is not a regular file. */
  unreadable: string;
}

/** A file's text, or the problem that stops its checks (too large, unreadable, not a regular file). */
export async function readBounded(absolute: string, path: string, limit: ReadLimit): Promise<{ text: string } | { problem: Problem }> {
  let handle;
  try {
    handle = await open(absolute, constants.O_RDONLY | constants.O_NONBLOCK);
    const info = await handle.stat();
    if (!info.isFile()) return { problem: fileProblem(path, limit.unreadable) };
    if (info.size > limit.bytes) return { problem: fileProblem(path, limit.tooLarge) };
    // One byte more than the limit, so a file that grew after the stat is still caught.
    const buffer = Buffer.alloc(limit.bytes + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
      if (length > limit.bytes) return { problem: fileProblem(path, limit.tooLarge) };
    }
    return { text: buffer.subarray(0, length).toString('utf8') };
  } catch {
    return { problem: fileProblem(path, limit.unreadable) };
  } finally {
    await handle?.close();
  }
}

/** One error at `1:1` per secret rule the texts break, with the rule's fixed message. */
export function secretProblems(path: string, texts: Iterable<string>): Problem[] {
  const rules = new Set<string>();
  for (const text of texts) for (const rule of secretRules(text)) rules.add(rule);
  return [...rules].map(rule => fileProblem(path, rule));
}
