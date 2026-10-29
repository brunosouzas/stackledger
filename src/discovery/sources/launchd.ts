/** Source `launchd`: the job files in ~/Library/LaunchAgents, /Library/LaunchAgents and
 * /Library/LaunchDaemons (mac-discovery spec, launchd jobs, launchd privacy; design D2).
 *
 * Privacy: a job's arguments and environment may hold tokens, so a file is never converted whole.
 * Only `Label`, `Program` and, when Program is absent, `ProgramArguments.0` are read, one sandboxed
 * `plutil -extract <key> raw` run per key. When the program is an interpreter, `ProgramArguments.1`
 * is read once more and kept as `script` only if it is the path of an existing regular file, so a
 * flag, inline code or a token (even one starting with `/`) never reaches the snapshot (launchd
 * script, launchd script reading; design D1 of the launchd-script change). Node first opens the file for reading (and closes it unread)
 * to tell an unreadable file from a missing key. Links are not followed and count as ignored (a linked
 * job folder once, a linked job file once), like an unreadable file, a listed file lstat cannot
 * examine, or one without a Label. `launchctl` is not used: it fails inside the sandbox.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type LaunchdItem, type LaunchdScope, type SourceResult } from '../types.js';
import { entryKind, extractString, listRoot, pool, PLUTIL_POOL } from './common.js';

/** Interpreters whose first argument is the script they run: compared exactly with the text after the
 * program's last `/`, plus `python3.` followed by digits only (launchd script). */
const INTERPRETERS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'python', 'python3', 'node', 'ruby', 'perl', 'osascript']);
export const isInterpreter = (program: string): boolean => {
  const name = program.slice(program.lastIndexOf('/') + 1);
  return INTERPRETERS.has(name) || /^python3\.[0-9]+$/.test(name);
};

/** The script of an interpreter job: `ProgramArguments.1` when it is an absolute path that sandboxed
 * `test -f` finds to be a regular file (links followed), else null; `no plutil` keeps the source rule
 * (Program limits), while a check that cannot run or is stopped only gives null. */
async function readScript(host: Host, path: string, program: string | null): Promise<string | null | 'no plutil'> {
  if (program === null || !isInterpreter(program)) return null;
  const first = await extractString(host, path, 'ProgramArguments.1');
  if (!first.ok) return first.reason === 'no plutil' ? 'no plutil' : null;
  if (!first.value.startsWith('/')) return null;
  // The path comes from plist data and may point anywhere (a stale network mount), so it is checked by
  // `test -f` in the sandbox, with its time and network limits, never by a stat in this process.
  const check = await host.run('test', ['-f', first.value]);
  return check.kind === 'exited' && check.code === 0 ? first.value : null;
}

/** One job file: its item, or a tagged reason (never a bare string, which a Label could equal). */
type JobRead = { item: LaunchdItem } | { item: null; reason: 'ignored' | 'no plutil' };

async function readJob(host: Host, path: string, scope: LaunchdScope): Promise<JobRead> {
  if (!(await host.canRead(path))) return { item: null, reason: 'ignored' };
  const label = await extractString(host, path, 'Label');
  if (!label.ok) return { item: null, reason: label.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  let program = await extractString(host, path, 'Program');
  if (!program.ok && program.reason !== 'no plutil') program = await extractString(host, path, 'ProgramArguments.0');
  if (!program.ok && program.reason === 'no plutil') return { item: null, reason: 'no plutil' };
  const value = program.ok ? program.value : null;
  const script = await readScript(host, path, value);
  if (script === 'no plutil') return { item: null, reason: 'no plutil' };
  return { item: { source: 'launchd', id: label.value, versions: [], scope, path, program: value, script } };
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
    const names = await listRoot(host, folder);
    if (names === 'absent') continue;
    if (names === 'unreadable') return failed('launchd', 'cannot be read');
    present++;
    // A linked job folder exists but is not followed: one ignored entry, so drift marks a missing label incomplete.
    if (names === 'link') { ignored++; continue; }
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
