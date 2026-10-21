/** discover(host): read this Mac and return its snapshot (mac-discovery spec). Writes nothing:
 * src/discovery/write.ts is the only writer, called by src/discover-command.ts.
 *
 * Fail closed: without the sandbox program (`host.sandbox`, /usr/bin/sandbox-exec) no program runs and
 * no source is read (owner question 5). Then the machine name and macOS version are read through the
 * sandboxed `scutil` and `sw_vers`, the eight sources in order, and the snapshot is built. A secret in
 * a machine field throws (InternalError, exit 1). No network, no telemetry, no AI.
 */
import { InternalError } from '../errors.js';
import type { Host } from './host.js';
import { machineName } from './machine.js';
import { buildSnapshot, type Snapshot } from './snapshot.js';
import { readSources } from './sources/index.js';

export class NoSandbox extends InternalError {
  constructor() { super('stackledger discover: the macOS sandbox (/usr/bin/sandbox-exec) was not found; nothing was run'); }
}

/** The macOS version from sandboxed `sw_vers -productVersion`; null when it cannot be read. */
async function macosVersion(host: Host): Promise<string | null> {
  const result = await host.run('sw_vers', ['-productVersion']);
  const version = result.kind === 'exited' && result.code === 0 ? result.stdout.trim() : '';
  return version === '' ? null : version;
}

export async function discover(host: Host, now: Date = new Date()): Promise<Snapshot> {
  if (!(await host.isFile(host.sandbox))) throw new NoSandbox();
  const name = await machineName(host.run);
  const macos = await macosVersion(host);
  const results = await readSources(host);
  return buildSnapshot({ now, machine: { name, user: host.user, macos }, results });
}
