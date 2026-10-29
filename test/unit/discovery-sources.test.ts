/** Discovery sources, the program runner and the left-out items (mac-discovery spec). Run npm test.
 * Fictitious Northwind outputs from test/fixtures/discovery/, fake programs and fake folders in
 * temporary directories; the real machine is never read. Runs on every platform: the runner is given
 * a pass-through stand-in for sandbox-exec (the real sandbox is tested in discover-sandbox.test.ts).
 */
import { test, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { fakeProgram, passThroughSandbox } from '../discovery-helpers.js';
import { createRunner } from '../../src/discovery/run.js';
import { readSources } from '../../src/discovery/sources/index.js';
import { discover } from '../../src/discovery/index.js';
import { readBrew } from '../../src/discovery/sources/brew.js';
import { readMas } from '../../src/discovery/sources/mas.js';
import { readApps } from '../../src/discovery/sources/apps.js';
import { readLaunchd } from '../../src/discovery/sources/launchd.js';
import { readMise } from '../../src/discovery/sources/mise.js';
import { readNpm } from '../../src/discovery/sources/npm.js';
import { readPipx } from '../../src/discovery/sources/pipx.js';
import { defaultPrograms, fixture, machineFiles, virtualHost, type Entry } from '../virtual-host.js';
import type { Item, SourceResult } from '../../src/discovery/types.js';

const exited = (stdout: string, code = 0) => ({ kind: 'exited' as const, code, stdout });
const machine = (extra: Record<string, Entry>) => ({ ...machineFiles(), ...extra });
const item = (result: SourceResult, id: string) => result.items.find(entry => entry.id === id);
const ids = (result: SourceResult) => result.items.map(entry => entry.id);
const statuses = (results: SourceResult[]) => Object.fromEntries(results.map(r => [r.source, r.status]));

test('Homebrew outside PATH', async () => {
  const path = folder(), homebrew = join(folder(), 'opt', 'homebrew', 'bin');
  fakeProgram(homebrew, 'brew', 'echo from-homebrew-bin');
  const run = createRunner({ sandbox: passThroughSandbox(), env: { PATH: path }, programDirs: [homebrew, join(folder(), 'usr', 'local', 'bin')] });
  expect(await run('brew', ['info'])).toEqual({ kind: 'exited', code: 0, stdout: 'from-homebrew-bin\n' });
  expect(await run('mas', ['list'])).toEqual({ kind: 'not found' });
});

test('Relative PATH entry', async () => {
  // PATH `bin:<absolute>` while the current folder holds ./bin/brew: resolving `bin` against the
  // current folder would run it (and it would leave a marker file), so the lookup must skip it.
  const work = folder(), absolute = folder(), marker = join(work, 'ran');
  fakeProgram(join(work, 'bin'), 'brew', `touch '${marker}'\necho from-relative-bin`);
  const run = createRunner({ sandbox: passThroughSandbox(), env: { PATH: `bin:${absolute}` }, programDirs: [join(folder(), 'opt', 'homebrew', 'bin'), join(folder(), 'usr', 'local', 'bin')] });
  const previous = process.cwd();
  process.chdir(work);
  try {
    const { brew } = await readBrew({ ...virtualHost(), run });
    expect(brew).toEqual({ source: 'brew', status: 'skipped', reason: 'not found', items: [], ignored: 0 });
  } finally { process.chdir(previous); }
  expect(existsSync(marker)).toBe(false);
});

test('Missing source', async () => {
  const results = await readSources(virtualHost({ programs: { mas: undefined } }));
  expect(statuses(results)).toEqual({ brew: 'ok', cask: 'ok', mas: 'skipped', app: 'ok', launchd: 'ok', mise: 'ok', npm: 'ok', pipx: 'ok' });
  expect(results[2]).toEqual({ source: 'mas', status: 'skipped', reason: 'not found', items: [], ignored: 0 });
});

test('Failing source', async () => {
  const results = await readSources(virtualHost({ programs: { brew: () => exited('', 1) } }));
  expect(statuses(results)).toEqual({ brew: 'failed', cask: 'failed', mas: 'ok', app: 'ok', launchd: 'ok', mise: 'ok', npm: 'ok', pipx: 'ok' });
  expect(results.slice(0, 2).map(r => [r.items.length, r.reason])).toEqual([[0, 'exited with code 1'], [0, 'exited with code 1']]);
  expect(results.slice(2).every(r => r.items.length > 0)).toBe(true);
});

test('Reason without program output', async () => {
  const bin = folder();
  fakeProgram(bin, 'brew', "printf 'Error: northwind\\nsecond line\\033[2J' >&2\nexit 1");
  const host = { ...virtualHost(), run: createRunner({ sandbox: passThroughSandbox(), env: { PATH: bin }, programDirs: [] }) };
  const { brew, cask } = await readBrew(host);
  expect(brew.reason).toBe('exited with code 1');
  expect(cask.reason).toBe('exited with code 1');
  expect(JSON.stringify([brew, cask])).not.toContain('northwind');
});

test('Formula with a dependency', async () => {
  const { brew } = await readBrew(virtualHost());
  expect(item(brew, 'forge')).toEqual({ source: 'brew', id: 'forge', versions: ['2.1.0'], onRequest: true, dependsOn: ['libnorth'] });
});

test('Formula from a tap', async () => {
  const { brew } = await readBrew(virtualHost());
  expect(ids(brew)).toContain('northwind/tools/ledger');
  expect(ids(brew)).not.toContain('ledger');
});

test('Cask with an app', async () => {
  const { cask } = await readBrew(virtualHost());
  expect(item(cask, 'northwind-editor')).toEqual({ source: 'cask', id: 'northwind-editor', versions: ['5.0.1'], apps: ['Northwind Editor.app'] });
});

test('Unreadable Homebrew output', async () => {
  const { brew, cask } = await readBrew(virtualHost({ programs: { brew: () => exited('Warning: not JSON\n') } }));
  for (const result of [brew, cask]) expect(result).toMatchObject({ status: 'failed', reason: 'unreadable output', items: [] });
});

test('Formula with a numeric version', async () => {
  const info = JSON.parse(fixture('brew-info.json'));
  info.formulae[1].installed[0].version = 1.4;
  const { brew } = await readBrew(virtualHost({ programs: { brew: () => exited(JSON.stringify(info)) } }));
  expect(brew).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(brew)).toEqual(['forge', 'northwind/tools/ledger']);
});

test('App Store list', async () => {
  const mas = await readMas(virtualHost({ programs: { mas: () => exited('1234567890  Northwind Notes  (4.2)\n') } }));
  expect(mas).toEqual({ source: 'mas', status: 'ok', reason: null, ignored: 0, items: [{ source: 'mas', id: '1234567890', title: 'Northwind Notes', versions: ['4.2'] }] });
});

test('Line in another shape', async () => {
  const mas = await readMas(virtualHost({ programs: { mas: () => exited('1234567890  Northwind Notes  (4.2)\n2345678901  Northwind Chart\n\n') } }));
  expect(mas).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(mas)).toEqual(['1234567890']);
});

test('App in a subfolder', async () => {
  const apps = await readApps(virtualHost());
  expect(apps.items.find(app => app.id === 'com.northwind.monitor')).toEqual({ source: 'app', id: 'com.northwind.monitor', versions: ['1.1'], title: 'Northwind Monitor', path: '/Applications/Utilities/Northwind Monitor.app', appStore: false });
});

test('Linked app', async () => {
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Viewer.app': { link: '/Volumes/Northwind/Northwind Viewer.app' } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items.map(app => (app as { path: string }).path)).not.toContain('/Applications/Northwind Viewer.app');
});

test('Unreadable app entry', async () => {
  // lstat of the entry fails (EACCES): it may be an app, so drift must see the source as incomplete.
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Vault.app': { dir: true, unstatable: true } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
});

test('Unreadable subfolder', async () => {
  // The subfolder exists but cannot be listed: it may hide apps, so it counts as one ignored entry.
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Suite': { dir: true, unreadable: true } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
});

test('Unexaminable entry in Applications', async () => {
  // A top-level entry not named .app whose lstat fails (EACCES) may be a subfolder hiding apps: one ignored.
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Tools': { dir: true, unstatable: true } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
});

test('App Store receipt', async () => {
  const apps = await readApps(virtualHost());
  expect(item(apps, 'com.northwind.notes')).toMatchObject({ appStore: true });
  expect(item(apps, 'com.northwind.editor')).toMatchObject({ appStore: false });
});

test('App without identifier', async () => {
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Blank.app/Contents/Info.plist': { CFBundleName: 'Northwind Blank' } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
});

test('App with an empty name', async () => {
  // A bundle named `.app` with an identifier and no name keys: the folder name is empty too, so the
  // title is the identifier (an empty title would break the snapshot's own shape check).
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/.app/Contents/Info.plist': { CFBundleIdentifier: 'com.northwind.blank' } }) }));
  expect(item(apps, 'com.northwind.blank')).toEqual({ source: 'app', id: 'com.northwind.blank', versions: [], title: 'com.northwind.blank', path: '/Applications/.app', appStore: false });
});

test('App in the home folder', async () => {
  const apps = await readApps(virtualHost());
  expect(item(apps, 'com.northwind.draw')).toEqual({ source: 'app', id: 'com.northwind.draw', versions: [], title: 'Northwind Draw', path: '/Users/username/Applications/Northwind Draw.app', appStore: false });
});

test('Agent of the user', async () => {
  const launchd = await readLaunchd(virtualHost());
  expect(item(launchd, 'com.northwind.sync')).toEqual({ source: 'launchd', id: 'com.northwind.sync', versions: [], scope: 'user-agent',
    path: '/Users/username/Library/LaunchAgents/com.northwind.sync.plist', program: '/Applications/Northwind Sync.app/Contents/MacOS/sync', script: null });
});

test('Unreadable daemon', async () => {
  const launchd = await readLaunchd(virtualHost({ files: machine({ '/Library/LaunchDaemons/com.northwind.root.plist': { file: '{"Label":"com.northwind.root"}', unreadable: true } }) }));
  expect(launchd).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(launchd).sort()).toEqual(['com.northwind.backup', 'com.northwind.sync', 'com.northwind.updater']);
});

test('Unexaminable launchd file', async () => {
  // The file is listed but lstat fails (EACCES): its label is unknown, so it counts as ignored and
  // drift marks a missing job `incomplete` instead of certain.
  const launchd = await readLaunchd(virtualHost({ files: machine({ '/Library/LaunchDaemons/com.northwind.root.plist': { file: '{"Label":"com.northwind.root"}', unstatable: true } }) }));
  expect(launchd).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(launchd).sort()).toEqual(['com.northwind.backup', 'com.northwind.sync', 'com.northwind.updater']);
});

test('Arguments are not recorded', async () => {
  const path = '/Library/LaunchAgents/com.northwind.agent.plist';
  const host = virtualHost({ files: machine({ [path]: { Label: 'com.northwind.agent', ProgramArguments: ['/usr/local/bin/northwind-agent', '--token', 'nw-example-value'], EnvironmentVariables: { NORTHWIND_TOKEN: 'nw-example-other' } } }) });
  const results = await readSources(host);
  const text = JSON.stringify(results);
  expect(text).not.toContain('nw-example');
  expect(text).not.toContain('NORTHWIND_TOKEN');
  expect(text).toContain('/usr/local/bin/northwind-agent');
  const runs = host.calls.filter(call => call.args.at(-1) === path);
  expect(runs.length).toBeGreaterThan(0);
  for (const run of runs) expect(run).toEqual({ program: 'plutil', args: ['-extract', expect.stringMatching(/^(Label|Program|ProgramArguments\.0)$/), 'raw', '-expect', 'string', '-o', '-', path] });
});

// launchd script (launchd-script change): the first argument of an interpreter job, when it is an existing file.
const job = (name: string, plist: object, extra: Record<string, Entry> = {}) =>
  virtualHost({ files: machine({ [`/Users/username/Library/LaunchAgents/com.northwind.${name}.plist`]: { Label: `com.northwind.${name}`, ...plist }, ...extra }) });
const scriptOf = async (host: ReturnType<typeof virtualHost>, name: string) => (item(await readLaunchd(host), `com.northwind.${name}`) as { script: string | null }).script;

test('Interpreter job', async () => {
  const host = job('server', { ProgramArguments: ['/Users/username/.venvs/northwind/bin/python3.12', '/Users/username/northwind/server.py', '--port', '8800'] }, { '/Users/username/northwind/server.py': 'print()' });
  expect(item(await readLaunchd(host), 'com.northwind.server')).toMatchObject({ program: '/Users/username/.venvs/northwind/bin/python3.12', script: '/Users/username/northwind/server.py' });
});

test('Interpreter set through Program', async () => {
  const host = job('backup-sh', { Program: '/bin/zsh', ProgramArguments: ['zsh', '/Users/username/bin/northwind-backup.sh'] }, { '/Users/username/bin/northwind-backup.sh': 'true' });
  expect(item(await readLaunchd(host), 'com.northwind.backup-sh')).toMatchObject({ program: '/bin/zsh', script: '/Users/username/bin/northwind-backup.sh' });
});

test('Interpreter with a flag first', async () => {
  expect(await scriptOf(job('inline', { ProgramArguments: ['/bin/bash', '-c', 'northwind-sync --all'] }), 'inline')).toBeNull();
});

test('Not an interpreter name', async () => {
  const script = { '/Users/username/northwind/tool.py': 'print()' };
  for (const program of ['/usr/local/bin/python3.12-intel64', '/usr/bin/Python3', '/usr/bin/perl5.34', '/usr/bin/python3.']) {
    expect(await scriptOf(job('tool', { ProgramArguments: [program, '/Users/username/northwind/tool.py'] }, script), 'tool')).toBeNull();
  }
  for (const program of ['python3', '/usr/bin/python3.9', '/opt/homebrew/bin/node', '/usr/bin/osascript']) {
    expect(await scriptOf(job('tool', { ProgramArguments: [program, '/Users/username/northwind/tool.py'] }, script), 'tool')).toBe('/Users/username/northwind/tool.py');
  }
});

test('Script is a folder', async () => {
  expect(await scriptOf(job('folder', { ProgramArguments: ['/usr/bin/python3', '/Users/username/northwind'] }, { '/Users/username/northwind': { dir: true } }), 'folder')).toBeNull();
});

test('Interpreter with no argument', async () => {
  const launchd = await readLaunchd(job('bare', { ProgramArguments: ['/usr/bin/python3'] }));
  expect(item(launchd, 'com.northwind.bare')).toMatchObject({ program: '/usr/bin/python3', script: null });
  expect(launchd).toMatchObject({ status: 'ok', ignored: 0 });
});

test('Plist reader that hangs on the script key', async () => {
  const plutil = defaultPrograms().plutil!;
  const files = machine({ '/Users/username/Library/LaunchAgents/com.northwind.slow.plist': { Label: 'com.northwind.slow', ProgramArguments: ['/usr/bin/python3', '/Users/username/northwind/slow.py'] }, '/Users/username/northwind/slow.py': '' });
  const host = virtualHost({ files, programs: { plutil: (args, h) => args[1] === 'ProgramArguments.1' ? { kind: 'time limit' } : plutil(args, h) } });
  const launchd = await readLaunchd(host);
  expect(item(launchd, 'com.northwind.slow')).toMatchObject({ program: '/usr/bin/python3', script: null });
  expect(launchd).toMatchObject({ status: 'ok', ignored: 0 });
});

test('File check that hangs', async () => {
  const files = machine({ '/Users/username/Library/LaunchAgents/com.northwind.mount.plist': { Label: 'com.northwind.mount', ProgramArguments: ['/usr/bin/python3', '/Volumes/northwind/agent.py'] }, '/Volumes/northwind/agent.py': '' });
  const host = virtualHost({ files, programs: { test: () => ({ kind: 'time limit' }) } });
  const launchd = await readLaunchd(host);
  expect(item(launchd, 'com.northwind.mount')).toMatchObject({ script: null });
  expect(launchd).toMatchObject({ status: 'ok', ignored: 0 });
  // The check ran as a program (sandboxed on a real Mac), not as a stat in the process.
  expect(host.calls).toContainEqual({ program: 'test', args: ['-f', '/Volumes/northwind/agent.py'] });
});

test('Script through a link', async () => {
  const host = job('linked', { ProgramArguments: ['/bin/sh', '/Users/username/bin/northwind-run'] },
    { '/Users/username/bin/northwind-run': { link: '/Users/username/northwind/run.sh' }, '/Users/username/northwind/run.sh': 'true' });
  expect(await scriptOf(host, 'linked')).toBe('/Users/username/bin/northwind-run');
});

test('Non-string script value', async () => {
  const launchd = await readLaunchd(job('dict', { ProgramArguments: ['/usr/bin/python3', { path: '/Users/username/northwind/agent.py' }] }));
  expect(item(launchd, 'com.northwind.dict')).toMatchObject({ script: null });
  expect(launchd).toMatchObject({ status: 'ok', ignored: 0 });
});

test('No plutil on the script key', async () => {
  const plutil = defaultPrograms().plutil!;
  const host = virtualHost({ files: machine({ '/Users/username/Library/LaunchAgents/com.northwind.gone.plist': { Label: 'com.northwind.gone', ProgramArguments: ['/usr/bin/python3', '/Users/username/northwind/gone.py'] } }),
    programs: { plutil: (args, h) => args[1] === 'ProgramArguments.1' ? { kind: 'not found' } : plutil(args, h) } });
  expect(await readLaunchd(host)).toMatchObject({ status: 'skipped' });
});

test('Later arguments of an interpreter job', async () => {
  const path = '/Library/LaunchAgents/com.northwind.agent.plist';
  const host = virtualHost({ files: machine({ [path]: { Label: 'com.northwind.agent', ProgramArguments: ['/usr/bin/python3', '/Users/username/northwind/agent.py', '--token', 'nw-example-value'] }, '/Users/username/northwind/agent.py': '' }) });
  const results = await readSources(host);
  const text = JSON.stringify(results);
  expect(text).toContain('/Users/username/northwind/agent.py');
  expect(text).not.toContain('nw-example-value');
  const keys = host.calls.filter(call => call.args.at(-1) === path).map(call => call.args[1]);
  for (const key of keys) expect(key).toMatch(/^(Label|Program|ProgramArguments\.[01])$/);
  expect(keys.filter(key => key === 'ProgramArguments.1')).toHaveLength(1);
});

test('Token as first argument', async () => {
  const host = job('token', { ProgramArguments: ['/usr/bin/python3', 'nw-example-value'] });
  expect(await scriptOf(host, 'token')).toBeNull();
  expect(JSON.stringify(await readSources(host))).not.toContain('nw-example-value');
});

test('Token that looks like a path', async () => {
  const host = job('slash', { ProgramArguments: ['/usr/bin/python3', '/nwExampleValue+9a/Q='] });
  expect(await scriptOf(host, 'slash')).toBeNull();
  expect(JSON.stringify(await readSources(host))).not.toContain('nwExampleValue');
});

test('Card number in a script path', async () => {
  const host = job('pay', { ProgramArguments: ['/usr/bin/python3', '/Users/username/4111111111111111.py'] }, { '/Users/username/4111111111111111.py': '' });
  const snapshot = await discover(host);
  expect(snapshot.items.map(entry => entry.id)).not.toContain('com.northwind.pay');
  expect(snapshot.sources.find(entry => entry.source === 'launchd')).toMatchObject({ status: 'ok', ignored: 1 });
});

// Plist values are data: a value that reads like a reader status is recorded like any other.
test('Jobs labelled like reader statuses', async () => {
  const jobs = { absent: { Label: 'absent', Program: 'stopped' }, stopped: { Label: 'stopped', ProgramArguments: ['absent'] }, plutil: { Label: 'no plutil', Program: 'no plutil' } };
  const launchd = await readLaunchd(virtualHost({ files: machine(Object.fromEntries(Object.entries(jobs).map(([name, job]) => [`/Library/LaunchAgents/com.northwind.${name}.plist`, job]))) }));
  expect(launchd).toMatchObject({ status: 'ok', ignored: 0 });
  expect(item(launchd, 'absent')).toMatchObject({ program: 'stopped' });
  expect(item(launchd, 'stopped')).toMatchObject({ program: 'absent' });
  expect(item(launchd, 'no plutil')).toMatchObject({ program: 'no plutil' });
});

test('App fields that read like reader statuses', async () => {
  // A failing `plutil -convert` sends every bundle through one `-extract` run per key.
  const plutil = defaultPrograms().plutil!;
  const host = virtualHost({
    files: machine({ '/Applications/Northwind Odd.app/Contents/Info.plist': { CFBundleIdentifier: 'no plutil', CFBundleDisplayName: 'stopped', CFBundleShortVersionString: 'absent' } }),
    programs: { plutil: (args, self) => args[0] === '-convert' ? exited('', 1) : plutil(args, self) },
  });
  const apps = await readApps(host);
  expect(apps).toMatchObject({ status: 'ok', ignored: 0 });
  expect(item(apps, 'no plutil')).toMatchObject({ title: 'stopped', versions: ['absent'] });
});

test('Tool with an alias link', async () => {
  const mise = await readMise(virtualHost({ files: machine({ '/Users/username/.local/share/mise/installs/node/22': { link: '22.12.0' } }) }));
  expect(item(mise, 'node')).toEqual({ source: 'mise', id: 'node', versions: ['22.12.0', '24.1.0'] });
});

test('npm reports a problem but lists packages', async () => {
  const npm = await readNpm(virtualHost({ programs: { npm: () => exited(fixture('npm-ls.json'), 1) } }));
  expect(npm).toMatchObject({ status: 'ok', reason: null });
  expect(item(npm, 'northwind-cli')).toEqual({ source: 'npm', id: 'northwind-cli', versions: ['3.0.0'] });
});

test('pipx package', async () => {
  const pipx = await readPipx(virtualHost());
  expect(pipx.items).toEqual([{ source: 'pipx', id: 'northwind-docs', versions: ['1.6.0'] }]);
});

test('Broken pipx metadata', async () => {
  const pipx = await readPipx(virtualHost({ files: machine({ '/Users/username/.local/pipx/venvs/northwind-tables/pipx_metadata.json': { main_package: { package: 'northwind-tables', package_version: 2 } } }) }));
  expect(pipx).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(pipx)).toEqual(['northwind-docs']);
});

test('Plist reader that hangs', async () => {
  const apps = await readApps(virtualHost({ files: machine({ '/Applications/Northwind Slow.app/Contents/Info.plist': { file: '{"CFBundleIdentifier":"com.northwind.slow"}', hang: true } }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
  expect(ids(apps)).not.toContain('com.northwind.slow');
});

test('No sandbox', async () => {
  const host = virtualHost({ sandbox: false });
  await expect(discover(host)).rejects.toThrow(/sandbox/);
  expect(host.calls).toEqual([]);
});

test('Card number in a title', async () => {
  const host = virtualHost({ files: machine({ '/Applications/Northwind Pay.app/Contents/Info.plist': { CFBundleIdentifier: 'com.northwind.pay', CFBundleDisplayName: 'Northwind Pay 4111 1111 1111 1111' } }) });
  const snapshot = await discover(host);
  expect(snapshot.items.map(entry => entry.id)).not.toContain('com.northwind.pay');
  expect(snapshot.sources.find(entry => entry.source === 'app')).toMatchObject({ status: 'ok', items: 5, ignored: 1 });
});

test('Private key in a version', async () => {
  const listing = { dependencies: { 'northwind-cli': { version: '3.0.0' }, 'northwind-keys': { version: '1.0.0 -----BEGIN RSA PRIVATE KEY-----' } } };
  const snapshot = await discover(virtualHost({ programs: { npm: () => exited(JSON.stringify(listing)) } }));
  expect(snapshot.items.filter(entry => entry.source === 'npm').map(entry => entry.id)).toEqual(['northwind-cli']);
  expect(snapshot.sources.find(entry => entry.source === 'npm')).toMatchObject({ items: 1, ignored: 1 });
});

test('Same package in two pipx folders', async () => {
  const snapshot = await discover(virtualHost({ files: machine({ '/Users/username/.local/pipx/venvs/northwind-docs-next/pipx_metadata.json': { main_package: { package: 'northwind-docs', package_version: '2.0.0' } } }) }));
  expect(snapshot.items.filter(entry => entry.source === 'pipx')).toEqual([{ source: 'pipx', id: 'northwind-docs', versions: ['1.6.0', '2.0.0'] }]);
  expect(snapshot.sources.find(entry => entry.source === 'pipx')).toMatchObject({ items: 1 });
});

test('Two App Store lines for one app', async () => {
  for (const lines of [['Northwind Notes', 'Northwind Notes Pro'], ['Northwind Notes Pro', 'Northwind Notes']]) {
    const list = lines.map(title => `1234567890  ${title}  (4.2)\n`).join('');
    const snapshot = await discover(virtualHost({ programs: { mas: () => exited(list) } }));
    expect(snapshot.items.filter(entry => entry.source === 'mas')).toEqual([{ source: 'mas', id: '1234567890', versions: ['4.2'], title: 'Northwind Notes' }]);
  }
});

/** The fictitious machine without the entries under `prefix`, plus `extra`: room for a link in their place. */
const machineWithout = (prefix: string, extra: Record<string, Entry>) => ({
  ...Object.fromEntries(Object.entries(machineFiles()).filter(([path]) => !path.startsWith(prefix))), ...extra });

test('Linked Applications folder', async () => {
  // /Applications itself is a link: it is not followed, so the app behind it is not recorded, and it
  // counts as one ignored entry, so drift marks a missing app incomplete. ~/Applications is still read.
  const apps = await readApps(virtualHost({ files: machineWithout('/Applications/', {
    '/Applications': { link: '/Volumes/Northwind/Apps' },
    '/Volumes/Northwind/Apps/Northwind Hidden.app/Contents/Info.plist': { CFBundleIdentifier: 'com.northwind.hidden' },
  }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(apps)).toEqual(['com.northwind.draw']);
});

test('Linked subfolder', async () => {
  const apps = await readApps(virtualHost({ files: machine({
    '/Applications/Northwind Suite': { link: '/Volumes/Northwind/Suite' },
    '/Volumes/Northwind/Suite/Northwind Calc.app/Contents/Info.plist': { CFBundleIdentifier: 'com.northwind.calc' },
  }) }));
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(apps.items).toHaveLength(5);
  expect(ids(apps)).not.toContain('com.northwind.calc');
});

test('Linked bundle contents', async () => {
  // The bundle is a real folder but its Contents is a link: plutil would read through it, so it is not read.
  const host = virtualHost({ files: machine({
    '/Applications/Northwind Shadow.app/Contents': { link: '/Volumes/Northwind/Contents' },
    '/Volumes/Northwind/Contents/Info.plist': { CFBundleIdentifier: 'com.northwind.shadow' },
  }) });
  const apps = await readApps(host);
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(apps)).not.toContain('com.northwind.shadow');
  expect(apps.items).toHaveLength(5);
  expect(host.calls.some(call => call.args.some(arg => arg.startsWith('/Applications/Northwind Shadow.app') || arg.startsWith('/Volumes/Northwind')))).toBe(false);
});

test('Linked Info.plist', async () => {
  const host = virtualHost({ files: machine({
    '/Applications/Northwind Mirror.app/Contents/Info.plist': { link: '/Volumes/Northwind/Info.plist' },
    '/Volumes/Northwind/Info.plist': { CFBundleIdentifier: 'com.northwind.mirror' },
  }) });
  const apps = await readApps(host);
  expect(apps).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(apps)).not.toContain('com.northwind.mirror');
  expect(host.calls.some(call => call.args.at(-1)!.startsWith('/Applications/Northwind Mirror.app'))).toBe(false);
});

test('Linked launchd folder', async () => {
  const launchd = await readLaunchd(virtualHost({ files: machineWithout('/Library/LaunchDaemons/', {
    '/Library/LaunchDaemons': { link: '/Volumes/Northwind/Daemons' },
    '/Volumes/Northwind/Daemons/com.northwind.hidden.plist': { Label: 'com.northwind.hidden' },
  }) }));
  expect(launchd).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(launchd).sort()).toEqual(['com.northwind.sync', 'com.northwind.updater']);
});

test('Linked mise data folder', async () => {
  const mise = await readMise(virtualHost({ env: { PATH: '/usr/bin:/bin', HOME: '/Users/username', MISE_DATA_DIR: '/Users/username/mise' }, files: machine({
    '/Users/username/mise': { link: '/Volumes/Northwind/mise' },
    '/Volumes/Northwind/mise/installs/deno/2.0.0/bin/deno': 'fictitious',
  }) }));
  expect(mise).toMatchObject({ status: 'ok', items: [], ignored: 1 });
});

test('Linked mise installs folder', async () => {
  const mise = await readMise(virtualHost({ files: machineWithout('/Users/username/.local/share/mise/installs/', {
    '/Users/username/.local/share/mise/installs': { link: '/Volumes/Northwind/installs' },
    '/Volumes/Northwind/installs/deno/2.0.0/bin/deno': 'fictitious',
  }) }));
  expect(mise).toMatchObject({ status: 'ok', items: [], ignored: 1 });
});

test('Linked tool folder', async () => {
  const mise = await readMise(virtualHost({ files: machine({
    '/Users/username/.local/share/mise/installs/deno': { link: '/Volumes/Northwind/deno' },
    '/Volumes/Northwind/deno/2.0.0/bin/deno': 'fictitious',
  }) }));
  expect(mise).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(mise).sort()).toEqual(['node', 'python']);
});

test('Linked pipx home', async () => {
  const pipx = await readPipx(virtualHost({ files: machineWithout('/Users/username/.local/pipx/', {
    '/Users/username/.local/pipx': { link: '/Volumes/Northwind/pipx' },
    '/Volumes/Northwind/pipx/venvs/northwind-docs/pipx_metadata.json': { main_package: { package: 'northwind-docs', package_version: '1.6.0' } },
  }) }));
  expect(pipx).toMatchObject({ status: 'ok', items: [], ignored: 1 });
});

test('Linked pipx venvs folder', async () => {
  const pipx = await readPipx(virtualHost({ files: machineWithout('/Users/username/.local/pipx/', {
    '/Users/username/.local/pipx/venvs': { link: '/Volumes/Northwind/venvs' },
    '/Volumes/Northwind/venvs/northwind-docs/pipx_metadata.json': { main_package: { package: 'northwind-docs', package_version: '1.6.0' } },
  }) }));
  expect(pipx).toMatchObject({ status: 'ok', items: [], ignored: 1 });
});

test('Unexaminable tool folder', async () => {
  const mise = await readMise(virtualHost({ files: machine({
    '/Users/username/.local/share/mise/installs/deno': { dir: true, unstatable: true },
  }) }));
  expect(mise).toMatchObject({ status: 'ok', ignored: 1 });
  expect(ids(mise).sort()).toEqual(['node', 'python']);
});

test('Unexaminable venv', async () => {
  const pipx = await readPipx(virtualHost({ files: machine({
    '/Users/username/.local/pipx/venvs/northwind-hidden': { dir: true, unstatable: true },
  }) }));
  expect(pipx).toMatchObject({ status: 'ok', ignored: 1 });
});

test('Unreadable pipx home', async () => {
  const pipx = await readPipx(virtualHost({ files: machine({
    '/Users/username/.local/pipx': { dir: true, unstatable: true },
  }) }));
  expect(pipx).toMatchObject({ status: 'failed', reason: 'cannot be read', items: [] });
});
