/** Source `pipx`: packages installed with pipx, read from each venv's `pipx_metadata.json` without
 * running pipx, which writes a log on every run and crashes when writes are denied (mac-discovery
 * spec, pipx; design D2).
 *
 * The pipx home is $PIPX_HOME, else ~/.local/pipx when it exists, else ~/Library/Application Support/pipx.
 * A metadata file that cannot be read, is too large, is not JSON, or lacks `main_package.package` or
 * `main_package.package_version` as a non-empty string is counted as ignored, like a linked venv.
 * Links are not followed: a linked pipx home or `venvs` folder also counts as one ignored entry.
 */
import { join } from 'node:path';
import type { Host } from '../host.js';
import { failed, ok, skipped, type PipxItem, type SourceResult } from '../types.js';
import { entryKind, isRecord, listRoot, nonEmptyString, rootKind } from './common.js';

/** pipx writes a few kilobytes; anything far larger is not its metadata. */
const MAX_METADATA_BYTES = 1024 * 1024;

export async function pipxHome(host: Host): Promise<string> {
  if (host.env.PIPX_HOME) return host.env.PIPX_HOME;
  const local = join(host.home, '.local', 'pipx');
  return await entryKind(host, local) !== 'missing' ? local : join(host.home, 'Library', 'Application Support', 'pipx');
}

async function readVenv(host: Host, venv: string): Promise<PipxItem | 'ignored'> {
  const file = join(venv, 'pipx_metadata.json');
  try {
    const status = await host.lstat(file);
    if (!status.isFile() || status.size > MAX_METADATA_BYTES) return 'ignored';
    const metadata: unknown = JSON.parse(await host.readFile(file));
    const main = isRecord(metadata) ? metadata.main_package : undefined;
    if (!isRecord(main) || !nonEmptyString(main.package) || !nonEmptyString(main.package_version)) return 'ignored';
    return { source: 'pipx', id: main.package, versions: [main.package_version] };
  } catch { return 'ignored'; }
}

export async function readPipx(host: Host): Promise<SourceResult> {
  // The pipx home and its venvs folder are lstat'd before venvs is listed: a link to either is not
  // followed and counts as one ignored entry, so drift marks a missing package incomplete.
  const home = await pipxHome(host), homeKind = await rootKind(host, home);
  if (homeKind === 'absent') return skipped('pipx');
  if (homeKind === 'unreadable') return failed('pipx', 'cannot be read');
  if (homeKind === 'link') return ok('pipx', [], 1);
  const venvs = join(home, 'venvs');
  const names = await listRoot(host, venvs);
  if (names === 'absent') return skipped('pipx');
  if (names === 'unreadable') return failed('pipx', 'cannot be read');
  if (names === 'link') return ok('pipx', [], 1);
  const items: PipxItem[] = [];
  let ignored = 0;
  for (const name of names) {
    const kind = await entryKind(host, join(venvs, name));
    if (kind === 'link') { ignored++; continue; }
    if (kind !== 'dir') continue;
    const read = await readVenv(host, join(venvs, name));
    if (read === 'ignored') ignored++;
    else items.push(read);
  }
  return ok('pipx', items, ignored);
}
