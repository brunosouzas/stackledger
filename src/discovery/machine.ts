/** The machine name (design D5, mac-discovery spec, Machine name).
 *
 * Why folded: the name becomes a folder under ~/.stackledger, so it must be one safe, readable path
 * segment (`username - MacBook Air` → `username-macbook-air`). `fold` is also used by
 * `stackledger drift --scaffold` to make catalogue names. `machineName` asks the sandboxed `scutil` for
 * ComputerName, then LocalHostName, and falls back to `mac`; a failed or stopped run counts as empty.
 */
import type { Run } from './run.js';

export const MAX_NAME_LENGTH = 63;
export const FALLBACK_NAME = 'mac';

/** NFKD, combining marks removed, lower case, each run of other than a–z and 0–9 as one `-`,
 * `-` trimmed, cut to 63 characters and trimmed again. May return ''. */
export function fold(text: string): string {
  const trim = (value: string) => value.replace(/^-+|-+$/g, '');
  const folded = trim(text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return trim(folded.slice(0, MAX_NAME_LENGTH));
}

async function scutilName(run: Run, key: string): Promise<string> {
  const result = await run('scutil', ['--get', key]);
  return result.kind === 'exited' && result.code === 0 ? fold(result.stdout) : '';
}

export async function machineName(run: Run): Promise<string> {
  return (await scutilName(run, 'ComputerName')) || (await scutilName(run, 'LocalHostName')) || FALLBACK_NAME;
}
