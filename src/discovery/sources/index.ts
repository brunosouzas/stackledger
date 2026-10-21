/** All eight discovery sources, read in source order (mac-discovery spec, Sources).
 *
 * A skipped or failed source never stops the others. The results are raw: the snapshot step
 * (src/discovery/snapshot.ts) applies the secret guard, merges and sorts them.
 */
import type { Host } from '../host.js';
import type { SourceResult } from '../types.js';
import { readApps } from './apps.js';
import { readBrew } from './brew.js';
import { readLaunchd } from './launchd.js';
import { readMas } from './mas.js';
import { readMise } from './mise.js';
import { readNpm } from './npm.js';
import { readPipx } from './pipx.js';

export async function readSources(host: Host): Promise<SourceResult[]> {
  const { brew, cask } = await readBrew(host);
  return [brew, cask, await readMas(host), await readApps(host), await readLaunchd(host), await readMise(host), await readNpm(host), await readPipx(host)];
}
