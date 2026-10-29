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
 *
 * Helpers apps declare (app-helpers change): inside each `.app` the `app` walk finds, the plists in
 * `Contents/Library/LaunchAgents` and `LaunchDaemons` are read as jobs, with `BundleProgram` (what
 * launchd runs for them) before `ProgramArguments.0`, kept only inside the bundle; each `.app` in
 * `Contents/Library/LoginItems` gives its `CFBundleIdentifier` and `CFBundleExecutable` only. This is
 * what an app can run, not whether macOS enabled it: that list is root-only. Every entry the walk
 * ignores, and every link or unexaminable entry inside a bundle, counts once in `ignored`.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type LaunchdItem, type LaunchdScope, type SourceResult } from '../types.js';
import { entryKind, extractString, listRoot, pool, PLUTIL_POOL, rootKind } from './common.js';
import { walkApplications } from './apps.js';

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

/** A helper's `BundleProgram` joined to its app, only when it stays inside the bundle (design D4). */
const insideBundle = (app: string, value: string): string | null =>
  value.startsWith('/') || value.split('/').includes('..') ? null : join(app, value);

/** One job file; `app` is the bundle holding it for a helper plist. The program is `Program`, else,
 * for a helper with `BundleProgram`, that path inside the bundle (null when it leaves it: launchd runs
 * the bundle program, never argv[0]), else `ProgramArguments.0` (App helper programs). */
async function readJob(host: Host, path: string, scope: LaunchdScope, app: string | null): Promise<JobRead> {
  if (!(await host.canRead(path))) return { item: null, reason: 'ignored' };
  const label = await extractString(host, path, 'Label');
  if (!label.ok) return { item: null, reason: label.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  const keys = app === null ? ['Program', 'ProgramArguments.0'] : ['Program', 'BundleProgram', 'ProgramArguments.0'];
  let program: string | null = null;
  for (const key of keys) {
    const value = await extractString(host, path, key);
    if (!value.ok && value.reason === 'no plutil') return { item: null, reason: 'no plutil' };
    if (!value.ok) continue;
    program = key === 'BundleProgram' ? insideBundle(app!, value.value) : value.value;
    break;
  }
  return finish(host, path, scope, label.value, program);
}

async function finish(host: Host, path: string, scope: LaunchdScope, id: string, program: string | null): Promise<JobRead> {
  const script = await readScript(host, path, program);
  if (script === 'no plutil') return { item: null, reason: 'no plutil' };
  return { item: { source: 'launchd', id, versions: [], scope, path, program, script } };
}

/** A login item inside an app: its identifier and executable only; a linked Contents or Info.plist
 * is never read (plutil follows links), as `app` does for its own bundles. */
async function readLoginItem(host: Host, path: string): Promise<JobRead> {
  const contents = join(path, 'Contents'), plist = join(contents, 'Info.plist');
  if (await entryKind(host, contents) !== 'dir' || await entryKind(host, plist) !== 'file' || !(await host.canRead(plist))) return { item: null, reason: 'ignored' };
  const id = await extractString(host, plist, 'CFBundleIdentifier');
  if (!id.ok) return { item: null, reason: id.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  const executable = await extractString(host, plist, 'CFBundleExecutable');
  if (!executable.ok && executable.reason === 'no plutil') return { item: null, reason: 'no plutil' };
  const program = executable.ok && !executable.value.includes('/') ? join(contents, 'MacOS', executable.value) : null;
  return { item: { source: 'launchd', id: id.value, versions: [], scope: 'app-login-item', path, program, script: null } };
}

type Entry = { kind: 'job'; path: string; scope: LaunchdScope; app: string | null } | { kind: 'login'; path: string };

/** The helper entries one app declares, and how many entries inside it were ignored. */
async function helpersOf(host: Host, app: string): Promise<{ entries: Entry[]; ignored: number }> {
  const entries: Entry[] = [];
  let ignored = 0;
  // Each step is lstat'd: a link is never followed and counts once; a missing folder adds nothing.
  for (const step of [join(app, 'Contents'), join(app, 'Contents', 'Library')]) {
    const kind = await rootKind(host, step);
    if (kind === 'absent') return { entries, ignored };
    if (kind !== 'dir') return { entries, ignored: 1 };
  }
  const library = join(app, 'Contents', 'Library');
  const folders: [string, LaunchdScope][] = [['LaunchAgents', 'app-agent'], ['LaunchDaemons', 'app-daemon'], ['LoginItems', 'app-login-item']];
  for (const [name, scope] of folders) {
    const folder = join(library, name), names = await listRoot(host, folder);
    if (names === 'absent') continue;
    if (names === 'unreadable' || names === 'link') { ignored++; continue; }
    const login = scope === 'app-login-item';
    for (const entry of names.filter(found => found.endsWith(login ? '.app' : '.plist'))) {
      const path = join(folder, entry), kind = await entryKind(host, path);
      if (kind === (login ? 'dir' : 'file')) entries.push(login ? { kind: 'login', path } : { kind: 'job', path, scope, app });
      else if (kind === 'link' || kind === 'missing') ignored++;
    }
  }
  return { entries, ignored };
}

export async function readLaunchd(host: Host): Promise<SourceResult> {
  const folders: [string, LaunchdScope][] = [
    [join(host.home, 'Library', 'LaunchAgents'), 'user-agent'],
    [join(host.library, 'LaunchAgents'), 'agent'],
    [join(host.library, 'LaunchDaemons'), 'daemon'],
  ];
  const entries: Entry[] = [];
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
      if (kind === 'file') entries.push({ kind: 'job', path: join(folder, name), scope, app: null });
      // A link is not followed; a listed file lstat cannot examine may be a job. Both are counted, so
      // drift marks a missing label `incomplete` instead of certain.
      else if (kind === 'link' || kind === 'missing') ignored++;
    }
  }
  // The apps the `app` source sees: every entry it ignores (an unlistable root included) may hide
  // helpers, so it counts here too, since drift reads `incomplete` from this source's count only.
  const walk = await walkApplications(host);
  present += walk.present;
  ignored += walk.unreadable;
  for (const found of walk.found) {
    if (found.kind === 'ignored') { ignored++; continue; }
    const helpers = await helpersOf(host, found.path);
    entries.push(...helpers.entries);
    ignored += helpers.ignored;
  }
  if (!present) return skipped('launchd');
  const read = await pool(entries, PLUTIL_POOL, entry => entry.kind === 'login' ? readLoginItem(host, entry.path) : readJob(host, entry.path, entry.scope, entry.app));
  if (read.some(entry => entry.item === null && entry.reason === 'no plutil')) return skipped('launchd');
  const items = read.flatMap(entry => entry.item === null ? [] : [entry.item]);
  return ok('launchd', items, ignored + read.length - items.length);
}
