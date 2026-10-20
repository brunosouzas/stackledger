/** Write-ahead journal of one publication (build-command, Atomic replace; design D8).
 *
 * Why: publish.ts undoes its renames from memory. When that undo fails (a folder made read-only)
 * or the process dies, the previous entries stay under `<staging>/old/`, and only this file says
 * how to put them back. The next build reads it before it removes any staging folder, so an
 * interrupted publication is finished (publish.ts, recoverPublication), never deleted.
 *
 * Format: `<staging>/journal`, one JSON record per line, appended before the build goes on:
 *   {"kind":"move","index":n,"from":…,"to":…}  before the n-th rename (paths relative to the output folder)
 *   {"kind":"unmoved","index":n}               after the n-th rename was undone
 *   {"kind":"commit"}                          after the marker rename, the commit point
 *   {"kind":"undone"}                          after every rename was undone
 * A journal with records but neither `commit` nor `undone` is an interrupted publication.
 *
 * Records are not fsynced: the Node.js permission model, under which the build must run, disables
 * fsync. The journal covers a failed undo and a crashed process, not a power cut mid-publication.
 *
 * What can go wrong: a crash in the middle of an append leaves a partial last line; it is ignored,
 * because the rename it announced had not started. Any other unreadable line throws, and the build
 * then refuses to touch that staging folder.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const JOURNAL_NAME = 'journal';

export interface Move { index: number; from: string; to: string }

export type JournalRecord =
  | ({ kind: 'move' } & Move)
  | { kind: 'unmoved'; index: number }
  | { kind: 'commit' }
  | { kind: 'undone' };

/** Append one record to the staging folder's journal before the caller goes on. */
export function appendRecord(staging: string, record: JournalRecord): void {
  appendFileSync(join(staging, JOURNAL_NAME), JSON.stringify(record) + '\n');
}

const isIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

function parseRecord(line: string, number: number): JournalRecord {
  const record = JSON.parse(line) as Partial<Move> & { kind?: unknown };
  const valid = record.kind === 'commit' || record.kind === 'undone'
    || (record.kind === 'unmoved' && isIndex(record.index))
    || (record.kind === 'move' && isIndex(record.index) && typeof record.from === 'string' && typeof record.to === 'string');
  if (!valid) throw new Error(`line ${number} is not a journal record`);
  return record as JournalRecord;
}

/** The records of the journal in `staging`, or undefined when it has none. Throws when unreadable. */
export function readJournal(staging: string): JournalRecord[] | undefined {
  let text: string;
  try {
    text = readFileSync(join(staging, JOURNAL_NAME), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const lines = text.split('\n');
  // The last element is empty after a final newline, or a partial record cut by a crash: drop it.
  lines.pop();
  return lines.map((line, i) => parseRecord(line, i + 1));
}

/** True when the records describe a publication that neither committed nor was fully undone. */
export function interrupted(records: readonly JournalRecord[]): boolean {
  return records.length > 0 && !records.some(record => record.kind === 'commit' || record.kind === 'undone');
}

/** The announced renames that were not undone, latest first: what a recovery must put back. */
export function pendingMoves(records: readonly JournalRecord[]): Move[] {
  const undone = new Set(records.flatMap(record => (record.kind === 'unmoved' ? [record.index] : [])));
  return records
    .flatMap(record => (record.kind === 'move' && !undone.has(record.index) ? [{ index: record.index, from: record.from, to: record.to }] : []))
    .sort((a, b) => b.index - a.index);
}
