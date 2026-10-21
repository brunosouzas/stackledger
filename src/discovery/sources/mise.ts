/** Source `mise`: tools installed by mise, read from its `installs` folder without running mise
 * (mac-discovery spec, mise; design D2).
 *
 * The data folder is $MISE_DATA_DIR, else $XDG_DATA_HOME/mise, else ~/.local/share/mise. Each tool
 * folder is one item; its versions are the version folders inside, leaving out symbolic links such as
 * `latest` or `22`. A tool folder that cannot be listed or holds no version is counted as ignored. Links
 * are not followed: a linked data folder, `installs` folder or tool folder counts as one ignored entry.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type MiseItem, type SourceResult } from '../types.js';
import { entryKind, listFolder, listRoot, rootKind } from './common.js';

export function miseData(host: Host): string {
  const { MISE_DATA_DIR, XDG_DATA_HOME } = host.env;
  return MISE_DATA_DIR || (XDG_DATA_HOME ? join(XDG_DATA_HOME, 'mise') : join(host.home, '.local', 'share', 'mise'));
}

export function miseInstalls(host: Host): string {
  return join(miseData(host), 'installs');
}

export async function readMise(host: Host): Promise<SourceResult> {
  // The data folder and its installs folder are lstat'd before installs is listed: a link to either
  // is not followed and counts as one ignored entry, so drift marks a missing tool incomplete.
  const data = await rootKind(host, miseData(host));
  if (data === 'absent') return skipped('mise');
  if (data === 'unreadable') return failed('mise', 'cannot be read');
  if (data === 'link') return ok('mise', [], 1);
  const installs = miseInstalls(host);
  const tools = await listRoot(host, installs);
  if (tools === 'absent') return skipped('mise');
  if (tools === 'unreadable') return failed('mise', 'cannot be read');
  if (tools === 'link') return ok('mise', [], 1);
  const items: MiseItem[] = [];
  let ignored = 0;
  for (const tool of tools) {
    const path = join(installs, tool), kind = await entryKind(host, path);
    // A linked tool folder is not followed and counts as ignored; a version link such as `latest` is
    // an alias of a version folder beside it and is only left out (below).
    if (kind === 'link') { ignored++; continue; }
    if (kind !== 'dir') continue;
    const names = await listFolder(host, path);
    const versions: string[] = [];
    if (Array.isArray(names)) for (const name of names) if (await entryKind(host, join(path, name)) === 'dir') versions.push(name);
    if (versions.length) items.push({ source: 'mise', id: tool, versions });
    else ignored++;
  }
  return ok('mise', items, ignored);
}
