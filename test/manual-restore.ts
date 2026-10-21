/** The manual restore of docs/site.md ("Restoring after a failed publication"), step by step, so the
 * tests prove that following the documentation brings the previous build back byte for byte.
 * Used by test/unit/site-publish.test.ts and test/integration/build.test.ts.
 */
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Each published entry with the place of its new version in the staging folder (marker excluded:
 * its rename is the commit point, so before the commit the new marker is always still staged). */
const STAGED: readonly [string, string][] = [['staff', 'site-staff'], ['full', 'site-full'], ['_headers', 'root/_headers'], ['robots.txt', 'root/robots.txt'], ['_redirects', 'root/_redirects']];

export function manualRestore(out: string, staging: string): void {
  // Step 1: no staged marker means the publication had committed; only the staging folder goes.
  if (existsSync(join(staging, 'root', '.stackledger-build'))) {
    // Step 2: an entry whose new version left the staging folder belongs to the failed build. A
    // personal build (the full-only note) never had a staff site: its staff/ in <out> is the old one.
    const personal = existsSync(join(staging, 'full-only'));
    for (const [name, place] of STAGED) {
      if (personal && name === 'staff') continue;
      if (!existsSync(join(staging, place))) rmSync(join(out, name), { recursive: true, force: true });
    }
    // Step 3: move every entry of old/ back.
    for (const name of readdirSync(join(staging, 'old'))) renameSync(join(staging, 'old', name), join(out, name));
  }
  // Step 4: remove the staging folder.
  rmSync(staging, { recursive: true });
}
