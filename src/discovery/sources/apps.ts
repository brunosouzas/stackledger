/** Source `app`: application bundles in /Applications and ~/Applications (mac-discovery spec,
 * Applications found, Application fields; design D2).
 *
 * Node lists the folders itself with readdir/lstat, never following a symbolic link: a linked
 * Applications folder, a linked subfolder and a linked `.app` (such as Apple's Safari into the system
 * cryptex) are each counted as ignored. It never looks inside an `.app` beyond its Info.plist; other
 * folders are searched one level down. An `.app` entry lstat cannot examine, any other
 * top-level entry lstat cannot examine (it may be a subfolder) and a subfolder that cannot be listed
 * are each counted as ignored: they may hide an app, so drift marks a missing app `incomplete`. Each
 * bundle's `Contents/Info.plist`, when neither it nor `Contents` is a link, goes to sandboxed
 * `plutil -convert json`; when that fails (a date or data value cannot become JSON) each of
 * the four keys is extracted on its own. The title is the display name, else the bundle name, else the
 * folder name, else (a bundle named `.app`) the identifier. A bundle without an identifier, whose
 * plutil run hit a limit, or whose Contents or Info.plist is a link, is ignored. No `plutil` means the source is skipped.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type AppItem, type SourceResult } from '../types.js';
import { entryKind, extractString, isRecord, listFolder, listRoot, nonEmptyString, pool, PLUTIL_POOL } from './common.js';

const KEYS = ['CFBundleIdentifier', 'CFBundleDisplayName', 'CFBundleName', 'CFBundleShortVersionString'] as const;
type Fields = Partial<Record<typeof KEYS[number], string>>;
type Found = { kind: 'app'; path: string } | { kind: 'ignored' };

/** The `.app` folders in one root and its subfolders, plus the ignored entries (linked or unexaminable
 * `.app` entries, unexaminable top-level entries, unlistable subfolders). */
async function bundlesIn(host: Host, root: string, depth: number): Promise<Found[] | 'absent' | 'unreadable' | 'link'> {
  // A root is lstat'd first (a linked /Applications is not followed); a subfolder was lstat'd by its caller.
  const names = depth === 0 ? await listRoot(host, root) : await listFolder(host, root);
  if (typeof names === 'string') return names;
  const found: Found[] = [];
  for (const name of names) {
    const path = join(root, name), kind = await entryKind(host, path);
    if (name.endsWith('.app')) {
      if (kind === 'dir') found.push({ kind: 'app', path });
      // A link is not followed; an entry lstat cannot examine may be an app. Both are counted, so drift
      // marks a missing app `incomplete` instead of certain.
      else if (kind === 'link' || kind === 'missing') found.push({ kind: 'ignored' });
    } else if (kind === 'dir' && depth === 0) {
      const inner = await bundlesIn(host, path, 1);
      if (Array.isArray(inner)) found.push(...inner);
      // A subfolder that cannot be listed may hide apps: one ignored entry. One that vanished meanwhile hides nothing.
      else if (inner === 'unreadable') found.push({ kind: 'ignored' });
    } else if ((kind === 'missing' || kind === 'link') && depth === 0) {
      // A top-level entry lstat cannot examine may be a subfolder hiding apps, and a linked subfolder is
      // not followed: each is one ignored entry.
      found.push({ kind: 'ignored' });
    }
  }
  return found;
}

/** The four keys of an Info.plist, or why they could not be read (tagged: a field may read like a reason). */
type FieldsRead = { ok: true; fields: Fields } | { ok: false; reason: 'stopped' | 'no plutil' };
async function readFields(host: Host, plist: string): Promise<FieldsRead> {
  const converted = await host.run('plutil', ['-convert', 'json', '-o', '-', plist]);
  if (converted.kind === 'not found') return { ok: false, reason: 'no plutil' };
  if (converted.kind !== 'exited') return { ok: false, reason: 'stopped' };
  if (converted.code === 0) {
    let value: unknown;
    try { value = JSON.parse(converted.stdout); } catch { value = undefined; }
    if (isRecord(value)) {
      const fields: Fields = {};
      for (const key of KEYS) if (nonEmptyString(value[key])) fields[key] = value[key];
      return { ok: true, fields };
    }
  }
  const fields: Fields = {};
  for (const key of KEYS) {
    const extracted = await extractString(host, plist, key);
    if (extracted.ok) fields[key] = extracted.value;
    else if (extracted.reason === 'no plutil') return { ok: false, reason: 'no plutil' };
    else if (extracted.reason === 'stopped' && key === 'CFBundleIdentifier') return { ok: false, reason: 'stopped' };
  }
  return { ok: true, fields };
}

/** One bundle: its item, or a tagged reason (never a bare string, which an identifier could equal). */
type BundleRead = { item: AppItem } | { item: null; reason: 'ignored' | 'no plutil' };

async function readBundle(host: Host, path: string): Promise<BundleRead> {
  // plutil follows links: a linked Contents or Info.plist would make it read a file outside the bundle,
  // so both must be what lstat says they are (a folder, a file) or the bundle is ignored unread.
  const contents = join(path, 'Contents'), plist = join(contents, 'Info.plist');
  if (await entryKind(host, contents) !== 'dir' || await entryKind(host, plist) !== 'file') return { item: null, reason: 'ignored' };
  const read = await readFields(host, plist);
  if (!read.ok) return { item: null, reason: read.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  const fields = read.fields;
  if (!fields.CFBundleIdentifier) return { item: null, reason: 'ignored' };
  const folderName = path.split('/').at(-1)!.slice(0, -'.app'.length);
  const receipt = await entryKind(host, join(contents, '_MASReceipt'));
  return { item: {
    source: 'app', id: fields.CFBundleIdentifier,
    versions: fields.CFBundleShortVersionString ? [fields.CFBundleShortVersionString] : [],
    // A bundle named `.app` has an empty folder name; the identifier keeps the title non-empty.
    title: fields.CFBundleDisplayName || fields.CFBundleName || folderName || fields.CFBundleIdentifier,
    path, appStore: receipt !== 'missing',
  } };
}

export async function readApps(host: Host): Promise<SourceResult> {
  const roots = [host.applications, join(host.home, 'Applications')];
  const found: Found[] = [];
  let present = 0;
  for (const root of roots) {
    const bundles = await bundlesIn(host, root, 0);
    if (bundles === 'absent') continue;
    if (bundles === 'unreadable') return failed('app', 'cannot be read');
    present++;
    // A linked Applications folder exists but is not followed: one ignored entry.
    if (bundles === 'link') found.push({ kind: 'ignored' });
    else found.push(...bundles);
  }
  if (!present) return skipped('app');
  const paths = found.flatMap(entry => entry.kind === 'app' ? [entry.path] : []);
  const read = await pool(paths, PLUTIL_POOL, path => readBundle(host, path));
  if (read.some(entry => entry.item === null && entry.reason === 'no plutil')) return skipped('app');
  const items = read.flatMap(entry => entry.item === null ? [] : [entry.item]);
  return ok('app', items, found.length - items.length);
}
