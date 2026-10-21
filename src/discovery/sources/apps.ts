/** Source `app`: application bundles in /Applications and ~/Applications (mac-discovery spec,
 * Applications found, Application fields; design D2).
 *
 * Node lists the folders itself with readdir/lstat, never following a symbolic link (a linked `.app`,
 * such as Apple's Safari into the system cryptex, is counted as ignored) and never looking inside an
 * `.app`; other folders are searched one level down. An `.app` entry lstat cannot examine and a
 * subfolder that cannot be listed are each counted as ignored: they may hide an app, so drift marks a
 * missing app `incomplete`. Each bundle's `Contents/Info.plist` goes to sandboxed
 * `plutil -convert json`; when that fails (a date or data value cannot become JSON) each of
 * the four keys is extracted on its own. The title is the display name, else the bundle name, else the
 * folder name, else (a bundle named `.app`) the identifier. A bundle without an identifier, or whose
 * plutil run hit a limit, is ignored. No `plutil` means the source is skipped.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type AppItem, type SourceResult } from '../types.js';
import { entryKind, extractString, isRecord, listFolder, nonEmptyString, pool, PLUTIL_POOL } from './common.js';

const KEYS = ['CFBundleIdentifier', 'CFBundleDisplayName', 'CFBundleName', 'CFBundleShortVersionString'] as const;
type Fields = Partial<Record<typeof KEYS[number], string>>;
type Found = { kind: 'app'; path: string } | { kind: 'ignored' };

/** The `.app` folders in one root and its subfolders, plus the ignored entries (linked or unexaminable
 * `.app` entries, unlistable subfolders). */
async function bundlesIn(host: Host, root: string, depth: number): Promise<Found[] | 'absent' | 'unreadable'> {
  const names = await listFolder(host, root);
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
  const read = await readFields(host, join(path, 'Contents', 'Info.plist'));
  if (!read.ok) return { item: null, reason: read.reason === 'no plutil' ? 'no plutil' : 'ignored' };
  const fields = read.fields;
  if (!fields.CFBundleIdentifier) return { item: null, reason: 'ignored' };
  const folderName = path.split('/').at(-1)!.slice(0, -'.app'.length);
  const receipt = await entryKind(host, join(path, 'Contents', '_MASReceipt'));
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
    found.push(...bundles);
  }
  if (!present) return skipped('app');
  const paths = found.flatMap(entry => entry.kind === 'app' ? [entry.path] : []);
  const read = await pool(paths, PLUTIL_POOL, path => readBundle(host, path));
  if (read.some(entry => entry.item === null && entry.reason === 'no plutil')) return skipped('app');
  const items = read.flatMap(entry => entry.item === null ? [] : [entry.item]);
  return ok('app', items, found.length - items.length);
}
