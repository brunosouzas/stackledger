/** Source `launchd`: the job files in ~/Library/LaunchAgents, /Library/LaunchAgents and
 * /Library/LaunchDaemons (mac-discovery spec, launchd jobs, launchd privacy; design D2).
 *
 * Privacy: a job's arguments and environment may hold tokens, so a file is never converted whole.
 * Only `Label`, `Program` and, when Program is absent, `ProgramArguments.0` are read, one sandboxed
 * `plutil -extract <key> raw` run per key. Node first opens the file for reading (and closes it unread)
 * to tell an unreadable file from a missing key. Links are not followed and count as ignored, like an
 * unreadable file or one without a Label. `launchctl` is not used: it fails inside the sandbox.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type LaunchdItem, type LaunchdScope, type SourceResult } from '../types.js';
import { entryKind, extractString, listFolder, pool, PLUTIL_POOL } from './common.js';

async function readJob(host: Host, path: string, scope: LaunchdScope): Promise<LaunchdItem | 'ignored' | 'no plutil'> {
  if (!(await host.canRead(path))) return 'ignored';
  const label = await extractString(host, path, 'Label');
  if (label === 'no plutil') return label;
  if (label === 'absent' || label === 'stopped') return 'ignored';
  let program = await extractString(host, path, 'Program');
  if (program === 'absent' || program === 'stopped') program = await extractString(host, path, 'ProgramArguments.0');
  if (program === 'no plutil') return program;
  return { source: 'launchd', id: label, versions: [], scope, path, program: program === 'absent' || program === 'stopped' ? null : program };
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
      else if (kind === 'link') ignored++;
    }
  }
  if (!present) return skipped('launchd');
  const read = await pool(jobs, PLUTIL_POOL, ([path, scope]) => readJob(host, path, scope));
  if (read.includes('no plutil')) return skipped('launchd');
  const items = read.filter((entry): entry is LaunchdItem => typeof entry !== 'string');
  return ok('launchd', items, ignored + read.length - items.length);
}
