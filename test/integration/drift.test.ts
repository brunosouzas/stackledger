/** `stackledger drift` end to end (drift-command spec): one test per scenario, named after it. Build
 * first: npm run build && npm test. Catalogues and snapshots are fictitious Northwind data in temporary
 * folders; runs without --snapshot go through test/integration/drift-entry.mjs with a fake host, so
 * the real ~/.stackledger is never read. 'Large drift' is timed alone in test/perf/drift.perf.test.ts.
 */
import { test, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cli, root, run } from './helpers.js';
import { catalogue, defaultSnapshot, driftEntryRun, driftRun, snapshotFile } from './drift-helpers.js';
import { diskMachine } from './discover-helpers.js';
import { folder } from '../helpers.js';
import { app, brew, cask, comp, launchd, mas, simple, snapshotOf } from '../drift-helpers.js';
import { buildDrift } from '../../src/drift.js';
import { formatDriftText } from '../../src/drift-formats.js';

const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
const oneLine = (stderr: string) => stderr.endsWith('\n') && stderr.trimEnd().split('\n').length === 1;

function hashes(path: string): Record<string, string> {
  return Object.fromEntries(readdirSync(path, { recursive: true }).map(String).filter(file => statSync(join(path, file)).isFile()).sort()
    .map(file => [file, createHash('sha256').update(readFileSync(join(path, file))).digest('hex')]));
}

/** A small Northwind machine and catalogue with something in every section. */
function northwind() {
  const snapshot = snapshotOf([
    brew('forge', { dependsOn: ['libnorth'] }), brew('libnorth', { onRequest: false }),
    cask('northwind-editor', ['Northwind Editor.app'], ['5.0.1']), cask('northwind-draw', ['Northwind Draw.app']),
    app('com.northwind.editor', '/Applications/Northwind Editor.app', { title: 'Northwind Editor', versions: ['5.0.1'] }),
    launchd('com.northwind.sync', null),
  ], { mas: { status: 'skipped' } });
  const components = [
    comp('editor', { 'stackledger/cask': 'northwind-editor' }), comp('editor-beta', { 'stackledger/cask': 'northwind-editor' }),
    comp('forge', { 'stackledger/brew': 'forge' }), comp('libnorth', { 'stackledger/brew': 'libnorth' }),
    comp('legacy', { 'stackledger/app': 'com.northwind.legacy' }), comp('notes', { 'stackledger/mas': '1234567890' }),
  ];
  return { snapshot, components, folder: catalogue(...components), file: snapshotFile(snapshot) };
}

test('Explicit snapshot', () => {
  const example = northwind();
  const result = driftRun([example.folder, '--snapshot', example.file]);
  expect(result.status).toBe(0);
  // validate warns that editor-beta lists the cask editor already lists.
  expect(result.stderr).toBe('stackledger drift: 0 errors, 1 warning; run stackledger validate for details\n');
  expect(result.stdout).toBe(formatDriftText(buildDrift(example.snapshot, example.components)));
  for (const section of ['Not declared', 'Missing', 'Not checked', 'Shared', 'Proposed relations']) expect(result.stdout).toContain(`\n${section}\n`);
  // The documented example: the Northwind catalogue and its fictitious machine show every section but
  // Shared, which always comes with a validate warning; the example stays without errors or warnings.
  const documented = run(['drift', 'examples/northwind', '--snapshot', 'examples/northwind-machine/snapshot.json']);
  expect(documented.status).toBe(0);
  expect(documented.stderr).toBe('');
  for (const section of ['Not declared', 'Missing', 'Not checked', 'Proposed relations']) expect(documented.stdout).toContain(`\n${section}\n`);
  expect(documented.stdout).toContain('(probably belongs to component:slack)');
  expect(documented.stdout).toContain('cannot be annotated');
  expect(documented.stdout).toContain('(incomplete source)');
  expect(documented.stdout).toContain('runs /usr/bin/python3 /Users/username/northwind/indexer.py  -> stackledger/launchd: com.northwind.indexer');
});

test('Default snapshot', () => {
  const machine = diskMachine();
  const host = JSON.parse(readFileSync(machine.hostFile, 'utf8'));
  defaultSnapshot(machine.snapshotRoot, 'username-macbook-air', snapshotOf([cask('northwind-default')]));
  const result = driftEntryRun({ host }, [catalogue(comp('editor'))]);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('cask  northwind-default 1.0.0  -> stackledger/cask: northwind-default');
});

test('Drift read-only', { timeout: 60_000 }, () => {
  const example = northwind(), before = hashes(example.folder);
  const flags = ['--permission', `--allow-fs-read=${join(root, 'dist')}`, `--allow-fs-read=${join(root, 'node_modules')}`,
    `--allow-fs-read=${example.folder}`, `--allow-fs-read=${dirname(example.file)}`];
  const plain = driftRun([example.folder, '--snapshot', example.file, '--format', 'json']);
  const restricted = driftRun([example.folder, '--snapshot', example.file, '--format', 'json'], flags);
  expect(restricted.status).toBe(0);
  expect(restricted).toEqual(plain);
  expect(hashes(example.folder)).toEqual(before);
});

test('Unknown drift format', () => {
  const example = northwind();
  const result = driftRun([example.folder, '--snapshot', example.file, '--format', 'csv']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('allowed formats: text, json');
});

test('No catalogue folder', () => {
  const result = driftRun([]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('A catalogue folder is required');
  expect(result.stderr).toContain('Usage:');
  // The other usage errors of the spec behave the same way.
  const example = northwind();
  for (const args of [[example.folder, example.folder, '--snapshot', example.file], [example.folder, '--fast'], [join(folder(), 'absent'), '--snapshot', example.file]]) {
    const other = driftRun(args);
    expect(other.status, args.join(' ')).toBe(2);
    expect(other.stdout).toBe('');
    expect(other.stderr).toMatch(/.+\nUsage:/);
  }
  expect(driftRun(['--format', 'csv', '--help']).status).toBe(0);
});

test('No snapshot yet', () => {
  const machine = diskMachine();
  const host = JSON.parse(readFileSync(machine.hostFile, 'utf8'));
  const result = driftEntryRun({ host }, [catalogue(comp('editor'))]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('run stackledger discover');
  expect(result.stderr).not.toContain(machine.snapshotRoot);
});

test('Snapshot in another format', () => {
  const file = snapshotFile(JSON.stringify({ ...snapshotOf([]), format: 'stackledger-snapshot/v9' }));
  const result = driftRun([catalogue(comp('editor')), '--snapshot', file]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('snapshot format is not supported');
  expect(result.stderr).not.toContain(file);
  // The other problems of the file have fixed reasons too, never its path or content.
  const cases: [string, string][] = [['{ "format": ', 'is not JSON'], [JSON.stringify({ ...snapshotOf([]), extra: 'nw-example-value' }), 'does not have the stackledger-snapshot/v1 shape']];
  for (const [text, reason] of cases) {
    const other = driftRun([catalogue(comp('editor')), '--snapshot', snapshotFile(text)]);
    expect(other.status).toBe(2);
    expect(other.stderr).toContain(reason);
    expect(other.stderr).not.toContain('nw-example-value');
  }
  const notFile = driftRun([catalogue(comp('editor')), '--snapshot', folder()]);
  expect(notFile.status).toBe(2);
  expect(notFile.stderr).toContain('not a regular file');
});

test('Inconsistent snapshot', () => {
  const snapshot = snapshotOf([mas('1234567890', 'Northwind Notes')]);
  snapshot.sources[2] = { source: 'mas', status: 'skipped', reason: 'not found', items: 1, ignored: 0 };
  const result = driftRun([catalogue(comp('editor')), '--snapshot', snapshotFile(snapshot)]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('snapshot is not consistent');
});

test('Secret in a snapshot', () => {
  const key = '-----BEGIN RSA PRIVATE KEY-----';
  const result = driftRun([catalogue(comp('editor')), '--snapshot', snapshotFile(snapshotOf([mas('1234567890', `Northwind ${key} nw-example-value`)]))]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Private key material is not allowed');
  expect(result.stderr).not.toContain('BEGIN');
  expect(result.stderr).not.toContain('nw-example-value');
});

test('Default snapshot on Linux', () => {
  const machine = diskMachine({ host: { platform: 'linux' } });
  const host = JSON.parse(readFileSync(machine.hostFile, 'utf8'));
  defaultSnapshot(machine.snapshotRoot, 'username-macbook-air', snapshotOf([]));
  const result = driftEntryRun({ host }, [catalogue(comp('editor'))]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('--snapshot');
  if (process.platform === 'linux') {
    const real = spawnSync(process.execPath, [cli, 'drift', catalogue(comp('editor'))], { encoding: 'utf8', env: { ...process.env, HOME: folder(), NODE_OPTIONS: '' } });
    expect(real.status).toBe(2);
    expect(real.stdout).toBe('');
    expect(real.stderr).toContain('--snapshot');
  }
});

test('Catalogue error', () => {
  const broken = comp('broken');
  delete (broken.spec as Record<string, unknown>).owner;
  const path = catalogue(comp('forge', { 'stackledger/brew': 'forge' }), broken);
  const result = driftRun([path, '--snapshot', snapshotFile(snapshotOf([brew('forge')])), '--format', 'json']);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('stackledger drift: 1 error, 0 warnings; run stackledger validate for details\n');
  expect(JSON.parse(result.stdout).matched).toEqual([{ source: 'brew', id: 'forge', path: null, components: ['component:forge'] }]);
});

test('Nothing differs', () => {
  const path = catalogue(comp('forge', { 'stackledger/brew': 'forge' }));
  const result = driftRun([path, '--snapshot', snapshotFile(snapshotOf([brew('forge'), brew('libnorth', { onRequest: false })]))]);
  expect(result.status).toBe(0);
  const lines = result.stdout.trimEnd().split('\n');
  expect(lines[0]).toBe('Drift of username-macbook-air (user username, macOS 27.2), snapshot taken 2026-10-21T07:30:00Z');
  expect(lines[1]).toMatch(/^Counts: items 2, matched 1, not declared 0, dependencies 1,/);
  expect(lines.at(-1)).toBe('No drift: every listed item is declared and every identifier is installed.');
  expect(lines).toHaveLength(4);
});

test('Control characters removed', () => {
  const snapshot = snapshotOf([app('com.northwind.term', '/Applications/Northwind Term.app', { title: 'Northwind\nTerm \u001b[2J\u001b]0;x\u0007' })]);
  const path = catalogue(comp('legacy', { 'stackledger/app': 'com.northwind.gone' }, { title: 'Legacy \u009b2J' }));
  const result = driftRun([path, '--snapshot', snapshotFile(snapshot)]);
  expect(result.status).toBe(0);
  for (const line of result.stdout.split('\n')) expect(line).not.toMatch(CONTROL);
  expect(result.stderr).not.toMatch(CONTROL);
  const appLine = result.stdout.split('\n').find(line => line.includes('com.northwind.term'))!;
  expect(appLine).toContain('NorthwindTerm [2J]0;x');
  expect(appLine).toContain('-> stackledger/app: com.northwind.term');
});

test('JSON lists', () => {
  const path = catalogue(comp('forge', { 'stackledger/brew': 'forge' }));
  const result = driftRun([path, '--snapshot', snapshotFile(snapshotOf([brew('forge'), cask('northwind-editor')])), '--format', 'json']);
  expect(result.status).toBe(0);
  const drift = JSON.parse(result.stdout);
  expect(Object.keys(drift)).toEqual(['snapshot', 'counts', 'notDeclared', 'missing', 'notChecked', 'shared', 'matched', 'proposedRelations']);
  expect(drift.notDeclared).toHaveLength(1);
  expect(drift.notDeclared[0]).toMatchObject({ source: 'cask', id: 'northwind-editor', annotation: 'stackledger/cask: northwind-editor' });
});

test('C1 character in JSON', () => {
  const title = 'Northwind \u009b2J Editor';
  const result = driftRun([catalogue(comp('editor')), '--snapshot', snapshotFile(snapshotOf([app('com.northwind.editor', '/Applications/Northwind Editor.app', { title })])), '--format', 'json']);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Northwind \\u009b2J Editor');
  expect(result.stdout).not.toMatch(/[\u007f-\u009f]/);
  expect(JSON.parse(result.stdout).notDeclared[0].title).toBe(title);
});

test('Same input twice', () => {
  const example = northwind();
  for (const format of ['text', 'json']) {
    const [first, second] = [driftRun([example.folder, '--snapshot', example.file, '--format', format]), driftRun([example.folder, '--snapshot', example.file, '--format', format])];
    expect(first.status).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  }
});

test('Drift closed pipe', async () => {
  // Long ids make the text far larger than any pipe buffer, so the writer meets the closed end.
  const items = Array.from({ length: 3000 }, (_, i) => simple('npm', `northwind-package-${String(i).padStart(4, '0')}-${'x'.repeat(100)}`));
  const args = [cli, 'drift', catalogue(comp('editor')), '--snapshot', snapshotFile(snapshotOf(items))];
  const child = spawn(process.execPath, args, { env: { ...process.env, NODE_OPTIONS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.stdout.once('data', () => child.stdout.destroy());
  const status = await new Promise<number | null>(done => child.on('close', code => done(code)));
  expect(status).toBe(1);
  expect(oneLine(stderr)).toBe(true);
  expect(stderr).toContain('cannot write');
  expect(stderr).not.toContain('Usage:');
});

// Scaffold (drift-command spec, Scaffold folder, Scaffold write). Faults go through drift-entry.mjs.

/** A catalogue and a snapshot in which the casks `northwind-draw` and `northwind-editor` are not declared. */
function twoCasks() {
  const path = catalogue(comp('forge', { 'stackledger/brew': 'forge' }));
  return { path, before: hashes(path), file: snapshotFile(snapshotOf([brew('forge'), cask('northwind-draw'), cask('northwind-editor')])) };
}
const mode = (path: string) => statSync(path).mode & 0o777;

test('Scaffold written', () => {
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const plain = driftRun([example.path, '--snapshot', example.file]);
  const result = driftRun([example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe(plain.stdout);
  expect(readdirSync(dir).sort()).toEqual(['northwind-draw.yaml', 'northwind-editor.yaml']);
  expect(readFileSync(join(dir, 'northwind-editor.yaml'), 'utf8')).toContain('    stackledger/cask: northwind-editor\n');
  expect(mode(dir)).toBe(0o700);
  expect(mode(join(dir, 'northwind-draw.yaml'))).toBe(0o644);
  expect(hashes(example.path)).toEqual(example.before);
  // The same JSON with and without the option.
  const json = (extra: string[]) => driftRun([example.path, '--snapshot', example.file, '--format', 'json', ...extra]).stdout;
  expect(json(['--scaffold', join(folder(), 'more')])).toBe(json([]));
});

test('Scaffold folder exists', () => {
  const example = twoCasks(), dir = folder();
  const result = driftRun([example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('already exists');
  expect(readdirSync(dir)).toEqual([]);
});

test('Scaffold inside the catalogue', () => {
  const example = twoCasks();
  for (const dir of [join(example.path, 'new-items'), join(example.path, 'nested', 'new-items')]) {
    const result = driftRun([example.path, '--snapshot', example.file, '--scaffold', dir]);
    expect(result.status, dir).toBe(2);
    expect(result.stdout).toBe('');
  }
  // Through a link to the catalogue: real paths are compared.
  const link = join(folder(), 'link');
  symlinkSync(example.path, link);
  const linked = driftRun([example.path, '--snapshot', example.file, '--scaffold', join(link, 'new-items')]);
  expect(linked.status).toBe(2);
  expect(linked.stderr).toContain('outside the catalogue folder');
  expect(hashes(example.path)).toEqual(example.before);
});

test('Scaffold passes validate', () => {
  const copy = folder();
  cpSync(join(root, 'examples/northwind'), copy, { recursive: true });
  const before = JSON.parse(run(['validate', copy, '--json']).stdout).summary;
  const snapshot = snapshotOf([
    brew('forge', { dependsOn: ['libnorth'] }), brew('libnorth'), cask('northwind-editor', ['Northwind Editor.app']),
    app('com.northwind.editor', '/Applications/Northwind Editor.app', { title: 'Northwind: Editor # beta' }),
    app('com.northwind.draw', '/Applications/Northwind Draw.app'), app('com.northwind.draw', '/Users/username/Applications/Northwind Draw.app'),
    launchd('com.northwind.sync', '/Applications/Northwind Draw.app/Contents/MacOS/sync'), simple('npm', 'northwind-cli'), simple('pipx', 'northwind-docs'),
    simple('mise', 'node'), mas('1234567890', 'Slack'),
  ]);
  const dir = join(folder(), 'new-items');
  expect(driftRun([copy, '--snapshot', snapshotFile(snapshot), '--scaffold', dir]).status).toBe(0);
  expect(readdirSync(dir).length).toBeGreaterThan(5);
  cpSync(dir, join(copy, 'new-items'), { recursive: true });
  const after = JSON.parse(run(['validate', copy, '--json']).stdout).summary;
  expect(after.errors).toBeLessThanOrEqual(before.errors);
  expect(after.warnings).toBeLessThanOrEqual(before.warnings);
  expect(after.documents).toBe(before.documents + readdirSync(dir).length);
});

test('Card number built by removing controls', () => {
  // Removing the tabs from the title would give a card number: that draft fails the check and is left out.
  const path = catalogue(comp('forge', { 'stackledger/brew': 'forge' })), dir = join(folder(), 'new-items');
  const file = snapshotFile(snapshotOf([brew('forge'), app('com.northwind.pay', '/Applications/Northwind Pay.app', { title: '4111\t1111\t1111\t1111' }), cask('northwind-editor')]));
  const result = driftRun([path, '--snapshot', file, '--scaffold', dir]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('stackledger drift: 1 scaffold file was left out because it has errors; run stackledger validate on the drafts for details\n');
  expect(result.stdout).toContain('com.northwind.pay');
  expect(readdirSync(dir)).toEqual(['northwind-editor.yaml']);
  expect(readFileSync(join(dir, 'northwind-editor.yaml'), 'utf8')).not.toContain('4111');
});

test('Scaffold write fails', () => {
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const result = driftEntryRun({ faults: { failWrite: 2 } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).not.toContain('Usage:');
  expect(existsSync(dir)).toBe(false);
});

test('Scaffold rollback keeps files it did not create', () => {
  // Another process creates the second file just before the command opens it: the exclusive open
  // fails with EEXIST, and the rollback removes only the first file, which this run created.
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const result = driftEntryRun({ faults: { createBeforeWrite: 2 } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('EEXIST');
  expect(readdirSync(dir)).toEqual(['northwind-editor.yaml']);
  expect(readFileSync(join(dir, 'northwind-editor.yaml'), 'utf8')).toBe('written by another process\n');
});

test('Scaffold rollback keeps a replaced file', () => {
  // Another process replaces the first file after it is written; the second create fails. The path
  // alone is not ownership: the rollback removes a file only when it is still the one this run made.
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const result = driftEntryRun({ faults: { replaceFileAfterWrite: 1, failCreate: 2 } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('EIO');
  expect(readdirSync(dir)).toEqual(['northwind-draw.yaml']);
  expect(readFileSync(join(dir, 'northwind-draw.yaml'), 'utf8')).toBe('written by another process\n');
});

test('Scaffold rollback keeps a replaced folder', () => {
  // Writing the second file fails; after the rollback removes the files, another process moves the
  // scaffold folder away and creates an empty folder at its path. That folder is not this run's: it is kept.
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const result = driftEntryRun({ faults: { failWrite: 2, replaceFolderAfterUnlink: 2 } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).toContain('the scaffold folder could not be removed');
  expect(readdirSync(dir)).toEqual([]);
  expect(readdirSync(`${dir}-moved`)).toEqual([]);
});

test('Scaffold folder created meanwhile', () => {
  const example = twoCasks(), dir = join(folder(), 'new-items');
  const result = driftEntryRun({ faults: { createBeforeMkdir: true } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('already exists');
  expect(readdirSync(dir)).toEqual([]);
});

test('Scaffold folder replaced during the write', () => {
  // After the first (or the last) file is written, the folder is moved aside and a link to another
  // folder takes its place: the command sees it before the next create (or before it finishes), stops
  // with exit 1, and nothing is written through the link.
  for (const after of [1, 2]) {
    const example = twoCasks(), dir = join(folder(), 'new-items');
    const result = driftEntryRun({ faults: { replaceFolderAfterWrite: after } }, [example.path, '--snapshot', example.file, '--scaffold', dir]);
    expect(result.status, `after write ${after}`).toBe(1);
    expect(result.stdout).toBe('');
    expect(oneLine(result.stderr)).toBe(true);
    expect(result.stderr).toContain('scaffold folder was replaced');
    expect(readdirSync(`${dir}-elsewhere`)).toEqual([]);
    expect(lstatSync(dir).isSymbolicLink()).toBe(true);
  }
});

test('Scaffold parent writable by others', () => {
  // Another user who can write the parent could swap the new folder for a link: refused before any write.
  const example = twoCasks();
  for (const permissions of [0o777, 0o770, 0o707]) {
    const parent = folder();
    chmodSync(parent, permissions);
    const result = driftRun([example.path, '--snapshot', example.file, '--scaffold', join(parent, 'new-items')]);
    chmodSync(parent, 0o700);
    expect(result.status, permissions.toString(8)).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('can be written by other users');
    expect(readdirSync(parent)).toEqual([]);
  }
  // With the sticky bit, as /tmp has, other users cannot rename or remove the user's folder.
  const sticky = folder();
  chmodSync(sticky, 0o1777);
  expect(driftRun([example.path, '--snapshot', example.file, '--scaffold', join(sticky, 'new-items')]).status).toBe(0);
  chmodSync(sticky, 0o700);
  // A parent owned by another user (reported through the ScaffoldOps seam) is refused too.
  const owned = folder();
  const other = driftEntryRun({ faults: { parentUid: 4242 } }, [example.path, '--snapshot', example.file, '--scaffold', join(owned, 'new-items')]);
  expect(other.status).toBe(2);
  expect(other.stdout).toBe('');
  expect(other.stderr).toContain('not owned by the current user');
  expect(readdirSync(owned)).toEqual([]);
});

test('Scaffold ancestor writable by others', () => {
  // The parent is private, but another user who can write a folder above it could swap the parent for
  // a link (into the catalogue, say) before the mkdir: every folder from / down is checked.
  const example = twoCasks();
  for (const permissions of [0o777, 0o770, 0o707]) {
    const ancestor = folder(), parent = join(ancestor, 'private');
    mkdirSync(parent, { mode: 0o700 });
    chmodSync(ancestor, permissions);
    const result = driftRun([example.path, '--snapshot', example.file, '--scaffold', join(parent, 'new-items')]);
    chmodSync(ancestor, 0o700);
    expect(result.status, permissions.toString(8)).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('can be written by other users');
    expect(readdirSync(parent)).toEqual([]);
  }
  // A sticky ancestor, as /tmp, is accepted.
  const sticky = folder(), inside = join(sticky, 'private');
  mkdirSync(inside, { mode: 0o700 });
  chmodSync(sticky, 0o1777);
  const accepted = driftRun([example.path, '--snapshot', example.file, '--scaffold', join(inside, 'new-items')]);
  chmodSync(sticky, 0o700);
  expect(accepted.status).toBe(0);
  // An ancestor owned by another user (reported through the ScaffoldOps seam) is refused too.
  const owned = join(folder(), 'private');
  mkdirSync(owned, { mode: 0o700 });
  const other = driftEntryRun({ faults: { ancestorUid: 4242 } }, [example.path, '--snapshot', example.file, '--scaffold', join(owned, 'new-items')]);
  expect(other.status).toBe(2);
  expect(other.stdout).toBe('');
  expect(other.stderr).toContain('not owned by the current user');
  expect(readdirSync(owned)).toEqual([]);
});

test('Scaffold parent replaced before the folder is created', () => {
  // Between the checks and the mkdir the parent becomes a link to the catalogue: the folder made lands
  // in the catalogue, so the command removes it and stops with exit 1, writing no draft there.
  const example = twoCasks(), parent = join(folder(), 'drafts');
  mkdirSync(parent, { mode: 0o700 });
  const before = readdirSync(example.path);
  const result = driftEntryRun({ faults: { parentToLinkBeforeMkdir: example.path } }, [example.path, '--snapshot', example.file, '--scaffold', join(parent, 'new-items')]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(oneLine(result.stderr)).toBe(true);
  expect(result.stderr).not.toContain('Usage:');
  expect(readdirSync(example.path)).toEqual(before);
  expect(hashes(example.path)).toEqual(example.before);
  expect(readdirSync(`${parent}-moved`)).toEqual([]);
});
