/** Source `mise`: tools installed by mise, read from its `installs` folder without running mise
 * (mac-discovery spec, mise; design D2).
 *
 * The data folder is $MISE_DATA_DIR, else $XDG_DATA_HOME/mise, else ~/.local/share/mise. Each tool
 * folder is one item; its versions are the version folders inside, leaving out symbolic links such as
 * `latest` or `22`. A tool folder that cannot be listed or holds no version is counted as ignored.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type MiseItem, type SourceResult } from '../types.js';
import { entryKind, listFolder } from './common.js';

export function miseInstalls(host: Host): string {
  const { MISE_DATA_DIR, XDG_DATA_HOME } = host.env;
  const data = MISE_DATA_DIR || (XDG_DATA_HOME ? join(XDG_DATA_HOME, 'mise') : join(host.home, '.local', 'share', 'mise'));
  return join(data, 'installs');
}

export async function readMise(host: Host): Promise<SourceResult> {
  const installs = miseInstalls(host);
  const tools = await listFolder(host, installs);
  if (tools === 'absent') return skipped('mise');
  if (tools === 'unreadable') return failed('mise', 'cannot be read');
  const items: MiseItem[] = [];
  let ignored = 0;
  for (const tool of tools) {
    const path = join(installs, tool);
    if (await entryKind(host, path) !== 'dir') continue;
    const names = await listFolder(host, path);
    const versions: string[] = [];
    if (Array.isArray(names)) for (const name of names) if (await entryKind(host, join(path, name)) === 'dir') versions.push(name);
    if (versions.length) items.push({ source: 'mise', id: tool, versions });
    else ignored++;
  }
  return ok('mise', items, ignored);
}
