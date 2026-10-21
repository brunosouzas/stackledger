/** Helpers shared by the discovery sources: folder listing, the plutil pool and value checks.
 *
 * Why here: `app` and `launchd` both list folders without following links and read plists through
 * sandboxed `plutil`, one run per key or file, at most 8 at a time (design D2); `mise` and `pipx`
 * list folders too. Results are sorted later (src/discovery/snapshot.ts), so the pool's completion
 * order never changes the snapshot.
 */
import type { Host } from '../host.js';

export const PLUTIL_POOL = 8;

/** The names in a folder; `absent` when it does not exist, `unreadable` when it exists but cannot be listed. */
export async function listFolder(host: Host, path: string): Promise<string[] | 'absent' | 'unreadable'> {
  try { return await host.readdir(path); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? 'absent' : 'unreadable';
  }
}

/** The entry's kind, never following a link; `missing` when lstat fails. */
export async function entryKind(host: Host, path: string): Promise<'dir' | 'file' | 'link' | 'other' | 'missing'> {
  try {
    const status = await host.lstat(path);
    return status.isSymbolicLink() ? 'link' : status.isDirectory() ? 'dir' : status.isFile() ? 'file' : 'other';
  } catch { return 'missing'; }
}

/** Run `task` on every value, at most `limit` at a time; results in input order. */
export async function pool<T, R>(values: readonly T[], limit: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  const worker = async () => { while (next < values.length) { const index = next++; results[index] = await task(values[index]!); } };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

/** Why a plist key gave no value: `absent` (missing, not a string, empty, unreadable file), `stopped`
 * (a time or output limit) or `no plutil`. */
export type NoValue = 'absent' | 'stopped' | 'no plutil';
/** One string key of a plist, tagged: a value is plist data and may read like any reason (a job may be
 * labelled `absent`), so a value and a reason never share one string type. */
export type Extracted = { ok: true; value: string } | { ok: false; reason: NoValue };
const noValue = (reason: NoValue): Extracted => ({ ok: false, reason });

/** Raw output ends with one line feed, which is not part of the value. */
export async function extractString(host: Host, file: string, key: string): Promise<Extracted> {
  const result = await host.run('plutil', ['-extract', key, 'raw', '-expect', 'string', '-o', '-', file]);
  if (result.kind === 'not found') return noValue('no plutil');
  if (result.kind !== 'exited') return noValue('stopped');
  if (result.code !== 0) return noValue('absent');
  const value = result.stdout.endsWith('\n') ? result.stdout.slice(0, -1) : result.stdout;
  return value === '' ? noValue('absent') : { ok: true, value };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}
