/** Source `npm`: global packages of the `npm` found on PATH, from one sandboxed run of
 * `npm ls --global --depth=0 --json --offline` (mac-discovery spec, npm).
 *
 * Why the sandbox matters here most: outside it every npm run writes a debug log, and `--logs-max=0`
 * deletes old ones (spike of 2026-10-21). npm exits non-zero for problems such as an extraneous
 * package while still printing the list, so a non-zero exit whose stdout is a JSON object with
 * `dependencies` is still read; any other non-zero exit fails the source.
 */
import type { Host } from '../host.js';
import { failureReason } from '../run.js';
import { failed, ok, skipped, type NpmItem, type SourceResult } from '../types.js';
import { isRecord, nonEmptyString } from './common.js';

export const NPM_ARGS = ['ls', '--global', '--depth=0', '--json', '--offline'];

export async function readNpm(host: Host): Promise<SourceResult> {
  const result = await host.run('npm', NPM_ARGS);
  if (result.kind === 'not found') return skipped('npm');
  if (result.kind !== 'exited') return failed('npm', result.kind);
  let parsed: unknown;
  try { parsed = JSON.parse(result.stdout); } catch { parsed = undefined; }
  const listed = isRecord(parsed) && isRecord(parsed.dependencies);
  if (result.code !== 0 && !listed) return failed('npm', failureReason(result)!);
  if (!isRecord(parsed)) return failed('npm', 'unreadable output');
  const dependencies = isRecord(parsed.dependencies) ? parsed.dependencies : {};
  const items: NpmItem[] = [];
  let ignored = 0;
  for (const [name, entry] of Object.entries(dependencies)) {
    if (name !== '' && isRecord(entry) && nonEmptyString(entry.version)) items.push({ source: 'npm', id: name, versions: [entry.version] });
    else ignored++;
  }
  return ok('npm', items, ignored);
}
