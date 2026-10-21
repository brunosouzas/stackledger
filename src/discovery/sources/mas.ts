/** Source `mas`: App Store apps from one sandboxed run of `mas list` (mac-discovery spec, App Store).
 *
 * Each non-empty line is `<digits>  <name>  (<version>)`; a non-empty line in another shape is counted
 * as ignored, so a format change in a new `mas` release shows up as ignored lines, not wrong items.
 * No `mas` program means the source is skipped.
 */
import type { Host } from '../host.js';
import { failureReason } from '../run.js';
import { failed, ok, skipped, type MasItem, type SourceResult } from '../types.js';

const LINE = /^\s*(\d+)\s+(.*\S)\s+\(([^()]*\S[^()]*)\)\s*$/;

export async function readMas(host: Host): Promise<SourceResult> {
  const result = await host.run('mas', ['list']);
  if (result.kind === 'not found') return skipped('mas');
  const reason = failureReason(result);
  if (reason || result.kind !== 'exited') return failed('mas', reason ?? 'unreadable output');
  const items: MasItem[] = [];
  let ignored = 0;
  for (const line of result.stdout.split('\n')) {
    if (line.trim() === '') continue;
    const match = LINE.exec(line);
    if (!match) { ignored++; continue; }
    items.push({ source: 'mas', id: match[1]!, versions: [match[3]!.trim()], title: match[2]! });
  }
  return ok('mas', items, ignored);
}
