/** `stackledger discover` (discover-command spec): read this Mac, read-only, and write its snapshot to
 * ~/.stackledger/<machine>/snapshot.json. Called by src/cli.ts; run node dist/cli.js discover.
 *
 * The command takes no folder and no option: any argument is a usage error (exit 2, nothing run).
 * Off macOS, or without /usr/bin/sandbox-exec, it exits 1 with one line before any program runs.
 * Otherwise it runs discovery (src/discovery/index.ts), writes the file (src/discovery/write.ts, the
 * only write) and prints the snapshot path and one line per source: status, items, ignored and the
 * fixed reason. Skipped and failed sources still exit 0. Control characters are removed from the
 * summary; program output never reaches stdout or stderr (the runner drops it).
 *
 * `host` and `ops` exist for the tests (test/integration/discover-entry.mjs, test/unit); src/cli.ts
 * passes nothing, so the shipped command always reads the real machine.
 */
import { parseArgs } from 'node:util';
import { InternalError } from './errors.js';
import { discover } from './discovery/index.js';
import { createHost, type Host } from './discovery/host.js';
import type { Snapshot } from './discovery/snapshot.js';
import { NODE_WRITE_OPS, writeSnapshot, type WriteOps } from './discovery/write.js';
import { writeStdout } from './stdout.js';

export const DISCOVER_USAGE = 'Usage: stackledger discover\n';
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

function checkArgs(args: string[]): void {
  const { positionals, tokens } = parseArgs({ args, strict: false, allowPositionals: true, tokens: true });
  // The first positional is the command name itself.
  if (positionals.length > 1) throw new Error('stackledger discover takes no folder');
  if (tokens.some(token => token.kind === 'option')) throw new Error('stackledger discover takes no options');
}

/** The summary: the snapshot path, then one line per source in source order. */
export function summary(path: string, snapshot: Snapshot): string {
  const lines = [path.replace(CONTROL, '')];
  for (const source of snapshot.sources) {
    const columns = [source.source.padEnd(8), source.status.padEnd(8), `items ${source.items}`.padEnd(11), `ignored ${source.ignored}`];
    if (source.reason) columns[3] = columns[3]!.padEnd(11) + source.reason;
    lines.push(columns.join(' ').trimEnd());
  }
  return `${lines.join('\n')}\n`;
}

export async function discoverCommand(args: string[], host: Host = createHost(), ops: WriteOps = NODE_WRITE_OPS): Promise<void> {
  if (args.includes('--help')) { await writeStdout(DISCOVER_USAGE, 'stackledger discover: cannot write to stdout'); return; }
  checkArgs(args);
  if (host.platform !== 'darwin') throw new InternalError('stackledger discover: discovery runs only on macOS');
  const snapshot = await discover(host);
  const path = writeSnapshot(snapshot, { home: host.home, root: host.snapshotRoot }, ops);
  await writeStdout(summary(path, snapshot), 'stackledger discover: cannot write the summary to stdout');
}
