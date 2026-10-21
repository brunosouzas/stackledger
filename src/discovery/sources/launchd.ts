/** Source `launchd`: the job files in ~/Library/LaunchAgents, /Library/LaunchAgents and
 * /Library/LaunchDaemons (mac-discovery spec, launchd jobs, launchd privacy; design D2).
 *
 * Privacy: a job's arguments and environment may hold tokens, so a file is never converted whole.
 * Only `Label`, `Program` and, when Program is absent, `ProgramArguments.0` are read, one sandboxed
 * `plutil -extract <key> raw` run per key. Node first opens the file for reading (and closes it unread)
 * to tell an unreadable file from a missing key. Links are not followed and count as ignored, like an
 * unreadable file, a listed file lstat cannot examine, or one without a Label. `launchctl` is not used: it fails inside the sandbox.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type LaunchdItem, type LaunchdScope, type SourceResult } from '../types.js';
import { entryKind, extractString, listFolder, pool, PLUTIL_POOL } from './common.js';

/** One job file: its item, or a tagged reason (never a bare string, which a Label could equal). */
type JobRead = { item: LaunchdItem } | { item: null; reason: 'ignored' | 'no plutil' };

async function readJob(host: Host, path: string, scope: LaunchdScope): Promise<JobRead> {
  if (!(await host.canRead(path))) return { item: null, reason: 'ignored' };
  const label = await extractString(host, path, 'Label');
  if (!label.ok) return { item: null, reason: label.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  let program = await extractString(host, path, 'Program');
  if (!program.ok && program.reason !== 'no plutil') program = await extractString(host, path, 'ProgramArguments.0');
  if (!program.ok && program.reason === 'no plutil') return { item: null, reason: 'no plutil' };
  return { item: { source: 'launchd', id: label.value, versions: [], scope, path, program: program.ok ? program.value : null } };
}

export async function readLaunchd(host: Host): Promise<SourceResult> {
  const folders: [string, LaunchdScope][] = [
    [join(host.home, 'Library', 'LaunchAgents'), 'user-agent'],
    [join(host.library, 'LaunchAgents'), 'agent'],
    [join(host.library, 'LaunchDaemons'), 'daemon'],
  ];
  const jobs: [string, LaunchdScope][] = [];
  let present = 0, ignored = 0;
  for (const [folder, scope] of folders) {
    const names = await listFolder(host, folder);
    if (names === 'absent') continue;
    if (names === 'unreadable') return failed('launchd', 'cannot be read');
    present++;
    for (const name of names.filter(entry => entry.endsWith('.plist'))) {
      const kind = await entryKind(host, join(folder, name));
      if (kind === 'file') jobs.push([join(folder, name), scope]);
      // A link is not followed; a listed file lstat cannot examine may be a job. Both are counted, so
      // drift marks a missing label `incomplete` instead of certain.
      else if (kind === 'link' || kind === 'missing') ignored++;
    }
  }
  if (!present) return skipped('launchd');
  const read = await pool(jobs, PLUTIL_POOL, ([path, scope]) => readJob(host, path, scope));
  if (read.some(entry => entry.item === null && entry.reason === 'no plutil')) return skipped('launchd');
  const items = read.flatMap(entry => entry.item === null ? [] : [entry.item]);
  return ok('launchd', items, ignored + read.length - items.length);
}
