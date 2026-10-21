/** A fictitious Northwind Mac on disk for the discover integration tests. Build first (npm run build).
 *
 * Lays out test/fixtures/discovery/machine.json under a temporary root (/Applications → <root>/Applications,
 * /Library → <root>/Library, /Users/username → <root>/home), writes fake programs (brew, mas, npm, plutil,
 * scutil, sw_vers) into <root>/bin, and a host JSON for test/integration/discover-entry.mjs. The sandbox is
 * the pass-through stand-in unless `sandbox` says otherwise (the darwin-only tests pass the real one).
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folder } from '../helpers.js';
import { fakeProgram, passThroughSandbox } from '../discovery-helpers.js';
import { fixtures, machineFiles } from '../virtual-host.js';

export const entry = fileURLToPath(new URL('./discover-entry.mjs', import.meta.url));

const PLUTIL = `const fs = process.getBuiltinModule('node:fs');
const args = process.argv.slice(2), file = args.at(-1);
let text, value;
try { text = fs.readFileSync(file, 'utf8'); value = JSON.parse(text); } catch { process.exit(1); }
if (args[0] === '-convert') { process.stdout.write(text); process.exit(0); }
for (const part of args[1].split('.')) value = value !== null && typeof value === 'object' ? value[part] : undefined;
if (typeof value !== 'string') process.exit(1);
process.stdout.write(value + '\\n');
`;

export interface DiskMachine { root: string; home: string; bin: string; snapshotRoot: string; hostFile: string }

export function diskMachine(options: { programs?: Record<string, string | null>; host?: Record<string, unknown>; sandbox?: string } = {}): DiskMachine {
  const root = folder(), home = join(root, 'home'), bin = join(root, 'bin');
  mkdirSync(home, { mode: 0o700 });
  for (const [path, entry] of Object.entries(machineFiles())) {
    const local = path.startsWith('/Users/username/') ? join(home, path.slice('/Users/username/'.length)) : join(root, path);
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, typeof entry === 'string' ? entry : JSON.stringify(entry));
  }
  const programs: Record<string, string | null> = {
    brew: `/bin/cat '${fixtures}brew-info.json'`,
    mas: `/bin/cat '${fixtures}mas-list.txt'`,
    npm: `/bin/cat '${fixtures}npm-ls.json'`,
    scutil: 'if [ "$2" = ComputerName ]; then echo "username - MacBook Air"; else echo "username---MacBook-Air"; fi',
    sw_vers: 'echo 27.2',
    ...options.programs,
  };
  for (const [name, body] of Object.entries(programs)) if (body !== null) fakeProgram(bin, name, body);
  // plutil is a small Node program: it answers from the JSON plists of the fixture.
  writeFileSync(join(bin, 'plutil'), `#!${process.execPath}\n${PLUTIL}`, { mode: 0o755 });
  const snapshotRoot = join(home, '.stackledger');
  const host = {
    platform: 'darwin', env: { PATH: bin, HOME: home, USER: 'username', TMPDIR: tmpdir() }, home, user: 'username',
    applications: join(root, 'Applications'), library: join(root, 'Library'),
    sandbox: options.sandbox ?? passThroughSandbox(), snapshotRoot, programDirs: [],
    ...options.host,
  };
  const hostFile = join(folder(), 'host.json');
  writeFileSync(hostFile, JSON.stringify(host));
  return { root, home, bin, snapshotRoot, hostFile };
}

export function discoverRun(machine: DiskMachine, args: string[] = [], flags: string[] = []) {
  const result = spawnSync(process.execPath, [...flags, entry, machine.hostFile, 'discover', ...args], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
  if (result.error) throw result.error;
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

export function discoverRunAsync(machine: DiskMachine): Promise<{ status: number | null }> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [entry, machine.hostFile, 'discover'], { stdio: 'ignore', env: { ...process.env, NODE_OPTIONS: '' } });
    child.on('error', fail);
    child.on('close', status => done({ status }));
  });
}
