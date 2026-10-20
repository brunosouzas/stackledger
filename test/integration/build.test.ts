/** `stackledger build` against the built CLI: every build-command scenario (catalogue-site task 4.1).
 * Build first with npm run build. Each case runs the real command in a child process; folders live
 * in one temporary directory removed after the file. Heavy cases run concurrently.
 *
 * Failures at every publication step are injected through build-with-faults.mjs, a test-only entry
 * point that passes BuildFaults (src/site/command.ts) to the command. Catalogues are fictitious.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { component, layout, licence, line, set } from '../unit/helpers.js';
import { yaml } from './mcp-helpers.js';
import { cli, root } from './helpers.js';
import type { BuildFaults, CheckPoint } from '../../src/site/command.js';
import { MARKER, MARKER_NAME } from '../../src/site/policy.js';

const DATE = '2027-06-01';
const PROXY = /identity-aware proxy/;

interface Result { status: number; stdout: string; stderr: string; ms: number }

const faultEntry = join(root, 'test', 'integration', 'build-with-faults.mjs');

/** BuildFaults as JSON, plus the entry point's `swap` of the output folder for a link (no functions). */
type Faults = Omit<BuildFaults, 'at'> & { swap?: { at: CheckPoint; to: string } };

interface BuildOptions { env?: Record<string, string>; flags?: string[]; faults?: Faults }

/** Run the built CLI asynchronously, so several builds can run at the same time. With `faults`, run
 * the test-only entry point instead, which passes them to the command. */
function build(args: string[], options: BuildOptions = {}): Promise<Result> {
  const start = performance.now();
  const entry = options.faults ? [faultEntry, JSON.stringify(options.faults)] : [cli];
  return new Promise(resolve => {
    execFile(process.execPath, [...(options.flags ?? []), ...entry, ...args],
      { env: { ...process.env, NODE_OPTIONS: '', ...options.env }, timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const status = error ? (typeof error.code === 'number' ? error.code : -1) : 0;
        resolve({ status, stdout, stderr, ms: performance.now() - start });
      });
  });
}

let base = '';
let counter = 0;
const fresh = (name: string) => join(base, `${name}-${++counter}`);

function writeFolder(path: string, files: Record<string, string>): string {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    writeFileSync(join(path, file), content);
  }
  mkdirSync(path, { recursive: true });
  return path;
}

/** Every entry under `dir` as relative path -> 'dir', 'link:<target>' or the SHA-256 of the file
 * (byte-for-byte comparison). Links are recorded, never followed. */
function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(dir, relative), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(relative, entry.name);
      if (entry.isSymbolicLink()) {
        result[path] = `link:${readlinkSync(join(dir, path))}`;
      } else if (entry.isDirectory()) {
        result[path] = 'dir';
        walk(path);
      } else {
        result[path] = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
      }
    }
  };
  walk('');
  return result;
}

/** Number of HTML pages under a site folder. */
const pagesIn = (dir: string) => readdirSync(dir, { recursive: true }).filter(file => String(file).endsWith('.html')).length;
const staging = (out: string) => readdirSync(out).filter(name => name.startsWith('.stackledger-tmp-'));
const lines = (text: string) => text.trimEnd().split('\n');

const depends = (document: unknown, refs: string[]) => set(document, 'spec.dependsOn', refs);
const stops = (name: string, names: string[]) => set(line(name), 'spec.stops', names.map(item => `component:${item}`));

function smallCatalogue(extra: unknown[] = []): Record<string, string> {
  return {
    'catalog-info.yaml': yaml(
      depends(component('editor'), ['resource:licence-editor', 'component:forge']),
      component('forge'),
      component('linear'),
      set(licence('licence-editor'), 'spec.licence.cost', 98765),
      stops('ship', ['linear', 'editor', 'forge']),
      ...extra,
    ),
  };
}

let catalogue = '';
let twoSites: { out: string; result: Result };

beforeAll(async () => {
  // The real path: the permission model grants paths as written, and macOS links /var to /private/var.
  base = realpathSync(mkdtempSync(join(tmpdir(), 'stackledger-build-')));
  catalogue = writeFolder(join(base, 'catalogue'), smallCatalogue());
  const out = join(base, 'public');
  twoSites = { out, result: await build(['build', catalogue, '--out', out, '--date', DATE]) };
}, 120_000);

afterAll(() => {
  // Unreadable fixtures need their modes back before the recursive removal.
  const restore = (path: string) => {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path, { withFileTypes: true })) if (entry.isDirectory()) restore(join(path, entry.name));
  };
  if (base) {
    restore(base);
    rmSync(base, { recursive: true, force: true });
  }
});

describe('Command', () => {
  test('Two sites', () => {
    const { out, result } = twoSites;
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(join(out, 'full', 'index.html'))).toBe(true);
    expect(existsSync(join(out, 'staff', 'index.html'))).toBe(true);
    expect(readdirSync(out).sort()).toEqual(['.stackledger-build', '_headers', 'full', 'robots.txt', 'staff']);
  });

  test('Proxy reminder', () => {
    const { out, result } = twoSites;
    const report = lines(result.stderr);
    expect(report.at(-1)).toMatch(PROXY);
    expect(pagesIn(join(out, 'staff'))).toBeGreaterThanOrEqual(8);
    expect(report).toContain(`Built the staff site in ${join(out, 'staff')} (${pagesIn(join(out, 'staff'))} pages)`);
    expect(report).toContain(`Built the full site in ${join(out, 'full')} (${pagesIn(join(out, 'full'))} pages)`);
  });
});

describe('Usage errors', () => {
  test('Missing out', async () => {
    const before = snapshot(base);
    const result = await build(['build', catalogue]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^--out is required\nUsage:/);
    expect(snapshot(base)).toEqual(before);
  });

  test('Impossible date', async () => {
    const before = snapshot(base);
    const out = fresh('date');
    const result = await build(['build', catalogue, '--out', out, '--date', '2027-02-30']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('real YYYY-MM-DD');
    expect(existsSync(out)).toBe(false);
    expect(snapshot(base)).toEqual(before);
  });

  test('Every usage error prints a reason and usage, and creates or changes nothing', async () => {
    const out = join(base, 'never');
    const file = join(base, 'catalogue', 'catalog-info.yaml');
    const locked = join(base, 'locked');
    mkdirSync(locked);
    chmodSync(locked, 0);
    const outFile = join(base, 'out-file.txt');
    writeFileSync(outFile, 'not a folder\n');
    const before = snapshot(join(base, 'catalogue'));
    const cases = [
      ['build'],
      ['build', '--out', out],
      ['build', catalogue, '--out'],
      ['build', catalogue, '--out', out, '--fast'],
      ['build', catalogue, '--out', out, '--view', 'staff'],
      ['build', catalogue, catalogue, '--out', out],
      ['build', catalogue, '--out', out, '--date', '2027-6-01'],
      ['build', join(base, 'absent'), '--out', out],
      ['build', file, '--out', out],
      ['build', locked, '--out', out],
      ['build', catalogue, '--out', outFile],
    ];
    const results = await Promise.all(cases.map(args => build(args)));
    results.forEach((result, i) => {
      const label = cases[i]!.join(' ');
      expect(result.status, label).toBe(2);
      expect(result.stdout, label).toBe('');
      expect(result.stderr, label).toMatch(/.+\nUsage:/);
    });
    expect(existsSync(out)).toBe(false);
    expect(readFileSync(outFile, 'utf8')).toBe('not a folder\n');
    expect(snapshot(join(base, 'catalogue'))).toEqual(before);
  });

  test('Help wins over invalid arguments', async () => {
    const out = fresh('help');
    for (const args of [['build', '--help'], ['build', catalogue, '--out', out, '--date', 'never', '--help']]) {
      const result = await build(args);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('stackledger build <folder> --out <dir> [--date YYYY-MM-DD]');
      expect(result.stderr).toBe('');
    }
    expect(existsSync(out)).toBe(false);
  });
});

describe('Safe output folder', () => {
  test('Output inside the catalogue', async () => {
    const before = snapshot(catalogue);
    const result = await build(['build', catalogue, '--out', join(catalogue, 'site')]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^Output folder must not be the catalogue folder or inside it\nUsage:/);
    expect(snapshot(catalogue)).toEqual(before);
  });

  test('Output is the catalogue, contains it, or reaches it through a link', async () => {
    const parent = writeFolder(fresh('parent'), { '.stackledger-build': 'marker\n' });
    const inner = writeFolder(join(parent, 'catalogue'), smallCatalogue());
    const link = join(base, `link-${++counter}`);
    symlinkSync(inner, link);
    const before = snapshot(parent);
    const cases: [string, RegExp][] = [
      [inner, /inside it/],
      [parent, /must not contain the catalogue folder/],
      [link, /inside it/],
      [join(link, 'site'), /inside it/],
    ];
    for (const [out, message] of cases) {
      const result = await build(['build', inner, '--out', out]);
      expect(result.status, out).toBe(2);
      expect(result.stderr, out).toMatch(message);
    }
    expect(snapshot(parent)).toEqual(before);
  });

  test('Names that begin with two dots are still inside the folder', async () => {
    // `..review-probe` is a child of the catalogue, not its parent: relative() gives '..review-probe'.
    const folder = writeFolder(fresh('dots'), smallCatalogue());
    const beforeFolder = snapshot(folder);
    const inside = await build(['build', folder, '--out', join(folder, '..review-probe')]);
    expect(inside.status, inside.stderr).toBe(2);
    expect(inside.stderr).toMatch(/inside it/);
    expect(snapshot(folder)).toEqual(beforeFolder);

    // The other direction: a marked output folder holding a catalogue named `..catalogue`.
    const parent = writeFolder(fresh('dots-parent'), { [MARKER_NAME]: MARKER });
    const inner = writeFolder(join(parent, '..catalogue'), smallCatalogue());
    const beforeParent = snapshot(parent);
    const containing = await build(['build', inner, '--out', parent]);
    expect(containing.status, containing.stderr).toBe(2);
    expect(containing.stderr).toMatch(/must not contain the catalogue folder/);
    expect(snapshot(parent)).toEqual(beforeParent);
  });

  test.concurrent('A sibling whose name begins with two dots is outside and accepted', async () => {
    const folder = writeFolder(fresh('dots-sibling'), smallCatalogue());
    const out = join(dirname(folder), `..sibling-${++counter}`);
    const result = await build(['build', folder, '--out', out, '--date', DATE]);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(out, 'staff', 'index.html'))).toBe(true);
  }, 120_000);

  test('Unrelated non-empty folder', async () => {
    const out = writeFolder(fresh('notes'), { 'notes.txt': 'keep me\n' });
    const result = await build(['build', catalogue, '--out', out]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('not empty');
    expect(readdirSync(out)).toEqual(['notes.txt']);
    expect(readFileSync(join(out, 'notes.txt'), 'utf8')).toBe('keep me\n');
  });
});

describe('Marker and published entries', () => {
  const NOT_OURS = /not written by stackledger build/;

  test('A marker that is not the regular file stackledger writes is refused', async () => {
    const elsewhere = writeFolder(fresh('real-marker'), { [MARKER_NAME]: MARKER });
    const cases: [string, (out: string) => void][] = [
      ['directory', out => mkdirSync(join(out, MARKER_NAME))],
      ['symbolic link', out => symlinkSync(join(elsewhere, MARKER_NAME), join(out, MARKER_NAME))],
      ['wrong content', out => writeFileSync(join(out, MARKER_NAME), 'marker\n')],
    ];
    const outs = cases.map(([, make]) => {
      const out = writeFolder(fresh('marker'), { 'notes.txt': 'keep me\n' });
      make(out);
      return { out, before: snapshot(out) };
    });
    const results = await Promise.all(outs.map(({ out }) => build(['build', catalogue, '--out', out, '--date', DATE])));
    results.forEach((result, i) => {
      const label = cases[i]![0];
      expect(result.status, `${label}: ${result.stderr}`).toBe(2);
      expect(result.stderr, label).toMatch(NOT_OURS);
      expect(snapshot(outs[i]!.out), label).toEqual(outs[i]!.before);
    });
    expect(snapshot(elsewhere)).toEqual({ [MARKER_NAME]: expect.any(String) });
  }, 120_000);

  test('A published entry that is a symbolic link is refused', async () => {
    const names = ['full', 'staff', '_headers', 'robots.txt'];
    const cases = names.map(name => {
      const out = writeFolder(fresh('linked'), { [MARKER_NAME]: MARKER });
      const target = writeFolder(fresh('link-target'), { 'keep.txt': 'keep me\n' });
      symlinkSync(target, join(out, name));
      return { name, out, target, before: snapshot(out), targetBefore: snapshot(target) };
    });
    const results = await Promise.all(cases.map(({ out }) => build(['build', catalogue, '--out', out, '--date', DATE])));
    results.forEach((result, i) => {
      const { name, out, target, before, targetBefore } = cases[i]!;
      expect(result.status, `${name}: ${result.stderr}`).toBe(2);
      expect(result.stderr, name).toContain(`${name} is a symbolic link`);
      expect(snapshot(out), name).toEqual(before);
      expect(snapshot(target), name).toEqual(targetBefore);
    });
  }, 120_000);
});

describe('Atomic replace', () => {
  test.concurrent('Rebuild', async () => {
    const out = fresh('rebuild');
    const first = await build(['build', catalogue, '--out', out, '--date', DATE]);
    expect(first.status, first.stderr).toBe(0);
    expect(existsSync(join(out, 'full', 'software', 'forge', 'index.html'))).toBe(true);
    // A crashed earlier build left a staging folder: the next build removes it first.
    writeFolder(join(out, '.stackledger-tmp-crashed'), { 'full/secret.html': 'old full-view file\n' });
    const smaller = writeFolder(fresh('smaller'), {
      'catalog-info.yaml': yaml(component('editor'), component('linear'), stops('ship', ['linear', 'editor'])),
    });
    const second = await build(['build', smaller, '--out', out, '--date', DATE]);
    expect(second.status, second.stderr).toBe(0);
    expect(existsSync(join(out, 'full', 'software', 'forge'))).toBe(false);
    expect(staging(out)).toEqual([]);
    // Nothing of the first build remains: the output equals a build into an empty folder.
    const clean = fresh('clean');
    expect((await build(['build', smaller, '--out', clean, '--date', DATE])).status).toBe(0);
    expect(snapshot(out)).toEqual(snapshot(clean));
  }, 120_000);

  describe('Failure leaves the old site', () => {
    let seed = '';
    beforeAll(async () => {
      seed = fresh('seed');
      const result = await build(['build', catalogue, '--out', seed, '--date', DATE]);
      expect(result.status, result.stderr).toBe(0);
    }, 120_000);

    // A rebuild over an earlier build renames 10 times: old then new, for staff, full, _headers,
    // robots.txt and the marker. The tenth rename (the marker) is the commit point.
    const steps: [string, BuildFaults][] = [['prepare', { prepare: true }], ...Array.from({ length: 10 }, (_, i): [string, BuildFaults] => [`step ${i + 1}`, { step: i + 1 }])];
    test.concurrent.each(steps)('Failure leaves the old site (%s)', async (_, faults) => {
      const out = fresh('fail');
      cpSync(seed, out, { recursive: true });
      const before = snapshot(out);
      const other = writeFolder(fresh('other'), smallCatalogue([component('extra')]));
      const result = await build(['build', other, '--out', out, '--date', '2031-01-01'], { faults });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toMatch(/^stackledger build: internal error: injected failure/);
      expect(staging(out)).toEqual([]);
      expect(snapshot(out)).toEqual(before);
    }, 120_000);

    // A failed undo leaves previous entries under the staging folder's old/; its journal lets the
    // next build finish the undo before it removes any staging folder.
    const UNDO_FAILED = /^stackledger build: publication failed and could not be undone; the previous entries are in .*\/old/;
    const interrupt = async (out: string, step: number) => {
      const other = writeFolder(fresh('other'), smallCatalogue([component('extra')]));
      const result = await build(['build', other, '--out', out, '--date', '2031-01-01'], { faults: { step, undo: 1 } });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toMatch(UNDO_FAILED);
      expect(staging(out)).toHaveLength(1);
      return join(out, staging(out)[0]!);
    };

    test.concurrent.each([5, 10])('An undo that failed at step %i is finished by the next build', async step => {
      const out = fresh('undo');
      cpSync(seed, out, { recursive: true });
      const before = snapshot(out);
      await interrupt(out, step);
      expect(snapshot(out)).not.toEqual(before);
      // The next build recovers first, then fails while preparing: the output is the earlier build again.
      const next = await build(['build', catalogue, '--out', out, '--date', DATE], { faults: { prepare: true } });
      expect(next.status, next.stderr).toBe(1);
      expect(next.stderr).toMatch(/injected failure while preparing/);
      expect(staging(out)).toEqual([]);
      expect(snapshot(out)).toEqual(before);
    }, 120_000);

    test.concurrent('A recovered publication is reported, and the build then succeeds', async () => {
      const out = fresh('undo-report');
      cpSync(seed, out, { recursive: true });
      const interrupted = await interrupt(out, 7);
      const next = await build(['build', catalogue, '--out', out, '--date', DATE]);
      expect(next.status, next.stderr).toBe(0);
      expect(next.stderr).toContain(`Note: finished undoing the publication interrupted in ${interrupted}`);
      expect(staging(out)).toEqual([]);
      expect(snapshot(out)).toEqual(snapshot(seed));
    }, 120_000);

    test.concurrent('An interrupted publication that cannot be undone stops the build and deletes nothing', async () => {
      const out = fresh('undo-stuck');
      cpSync(seed, out, { recursive: true });
      const before = snapshot(out);
      const interrupted = await interrupt(out, 5);
      // A read-only staging folder: the new full site cannot be moved back into it.
      chmodSync(interrupted, 0o555);
      const stuck = snapshot(out);
      const next = await build(['build', catalogue, '--out', out, '--date', DATE]);
      expect(next.status, next.stderr).toBe(1);
      expect(next.stderr).toContain(`the publication interrupted in ${interrupted} could not be undone`);
      expect(next.stderr).toContain('nothing was deleted');
      expect(snapshot(out)).toEqual(stuck);
      // Once the folder is writable again, the next build restores the earlier one.
      chmodSync(interrupted, 0o755);
      const again = await build(['build', catalogue, '--out', out, '--date', DATE], { faults: { prepare: true } });
      expect(again.status, again.stderr).toBe(1);
      expect(snapshot(out)).toEqual(before);
    }, 120_000);

    // The build cannot hold the output folder open; it re-checks the folder's real path and
    // identity before each change, and stops when the folder was swapped for a link.
    test.concurrent.each(['staging', 'publish', 'cleanup'] as const)('An output folder swapped for a link before %s: exit 1, nothing outside changes', async point => {
      const out = fresh('swapped');
      cpSync(seed, out, { recursive: true });
      const elsewhere = writeFolder(fresh('elsewhere'), { [MARKER_NAME]: MARKER, 'staff/index.html': 'another site\n' });
      const before = snapshot(elsewhere);
      const other = writeFolder(fresh('other'), smallCatalogue([component('extra')]));
      const result = await build(['build', other, '--out', out, '--date', DATE], { faults: { swap: { at: point, to: elsewhere } } });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`^stackledger build: the output folder ${out} was moved or replaced during the build; stopped without further changes`));
      expect(snapshot(elsewhere)).toEqual(before);
      // The real folder, now at <out>-moved, holds a complete build (the earlier one, or the new one
      // after the commit) and, from the publish point on, the staging folder left as it was.
      const moved = `${out}-moved`;
      expect(readFileSync(join(moved, MARKER_NAME), 'utf8')).toBe(MARKER);
      expect(staging(moved)).toHaveLength(point === 'staging' ? 0 : 1);
      if (point !== 'cleanup') {
        const published = (dir: string) => Object.fromEntries(Object.entries(snapshot(dir)).filter(([path]) => !path.startsWith('.stackledger-tmp-')));
        expect(published(moved)).toEqual(snapshot(seed));
      }
    }, 120_000);

    test.concurrent('There is no eleventh step: the marker rename is the last one', async () => {
      const out = fresh('eleven');
      cpSync(seed, out, { recursive: true });
      const result = await build(['build', catalogue, '--out', out, '--date', DATE], { faults: { step: 11 } });
      expect(result.status, result.stderr).toBe(0);
      expect(snapshot(out)).toEqual(snapshot(seed));
    }, 120_000);

    test.concurrent('A cleanup failure after the commit is a warning', async () => {
      const out = fresh('cleanup');
      cpSync(seed, out, { recursive: true });
      const result = await build(['build', catalogue, '--out', out, '--date', DATE], { faults: { cleanup: true } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toMatch(/Warning: the build is published, but .*\.stackledger-tmp-\w+ could not be removed/);
      expect(lines(result.stderr).at(-1)).toMatch(PROXY);
      expect(staging(out)).toHaveLength(1);
      // The next build removes the leftover staging folder.
      expect((await build(['build', catalogue, '--out', out, '--date', DATE])).status).toBe(0);
      expect(staging(out)).toEqual([]);
      expect(snapshot(out)).toEqual(snapshot(seed));
    }, 120_000);
  });
});

test.concurrent('Catalogue text that mentions staging folders builds', async () => {
  const text = 'Clean up .stackledger-tmp-* after a crashed build';
  const folder = writeFolder(fresh('mentions-staging'), smallCatalogue([set(component('janitor'), 'metadata.description', text)]));
  const out = fresh('mentions-staging-out');
  const result = await build(['build', folder, '--out', out, '--date', DATE]);
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(out, 'staff', 'software', 'janitor', 'index.html'), 'utf8')).toContain(text);
}, 120_000);

test.concurrent('The shipped CLI ignores the old STACKLEDGER_TEST_FAIL variable', async () => {
  const out = fresh('no-env-hook');
  const result = await build(['build', catalogue, '--out', out, '--date', DATE], { env: { STACKLEDGER_TEST_FAIL: 'prepare' } });
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(out, 'full', 'index.html'))).toBe(true);
}, 120_000);

test('Documented', () => {
  const text = readFileSync(join(root, 'docs', 'site.md'), 'utf8').replace(/\s+/g, ' ');
  expect(text).toMatch(/Never serve the output folder while a build runs/);
  expect(text).toMatch(/Publish only these four entries of the output folder: `full\/`, `staff\/`, `_headers` and `robots\.txt`/);
});

const permission = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout;
const sandboxSupported = /\s--permission\b/.test(permission) && permission.includes('--allow-addons');

test.concurrent('Sandboxed build', async context => {
  if (!sandboxSupported) {
    context.skip('This Node version has no stable --permission flag with --allow-addons (Node >= 22.13 has them)');
    return;
  }
  const folder = writeFolder(fresh('sandbox-catalogue'), smallCatalogue());
  const out = fresh('sandbox-out');
  // The command must read the staging folder back, so --out is readable too; it is the only writable path.
  mkdirSync(out);
  const before = snapshot(folder);
  const flags = ['--permission', `--allow-fs-read=${folder}`, `--allow-fs-read=${root}`, `--allow-fs-read=${out}`, `--allow-fs-write=${out}`,
    '--allow-addons', '--allow-child-process', '--allow-worker'];
  const fakeHome = fresh('home');
  const result = await build(['build', folder, '--out', out, '--date', DATE], { flags, env: { HOME: fakeHome, TMPDIR: fakeHome } });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).not.toContain('ERR_ACCESS_DENIED');
  expect(existsSync(fakeHome)).toBe(false);
  expect(snapshot(folder)).toEqual(before);
  // The same files as the unrestricted build of the same catalogue and date.
  expect(snapshot(out)).toEqual(snapshot(twoSites.out));
}, 120_000);

test.concurrent('One error', async () => {
  const folder = writeFolder(fresh('one-error'), smallCatalogue([set(component('broken'), 'spec.owner', undefined)]));
  const out = fresh('one-error-out');
  const [result, map] = await Promise.all([
    build(['build', folder, '--out', out, '--date', DATE]),
    build(['map', folder, '--date', DATE]),
  ]);
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) expect(existsSync(join(out, site, 'index.html'))).toBe(true);
  // The report: counts with the hint, the map's lines as `stackledger map` writes them, the sites, the reminder.
  const mapLines = lines(map.stderr);
  expect(mapLines[0]).toMatch(/^stackledger map: 1 error, \d+ warnings?; run stackledger validate for details$/);
  expect(mapLines).toContain('Suggested positions for MapLayout spec.stations:');
  expect(lines(result.stderr)).toEqual([
    mapLines[0]!.replace('stackledger map:', 'stackledger build:'),
    ...mapLines.slice(1),
    `Built the staff site in ${join(out, 'staff')} (${pagesIn(join(out, 'staff'))} pages)`,
    `Built the full site in ${join(out, 'full')} (${pagesIn(join(out, 'full'))} pages)`,
    expect.stringMatching(PROXY),
  ]);
}, 120_000);

test.concurrent('Built twice', async () => {
  // Same documents, other order and other file names: the build is still identical.
  const documents = [
    depends(component('editor'), ['resource:licence-editor', 'component:forge']),
    component('forge'), component('linear'), set(licence('licence-editor'), 'spec.licence.cost', 98765),
    stops('ship', ['linear', 'editor', 'forge']),
  ];
  const reordered = writeFolder(fresh('reordered'), {
    'z/later.yaml': yaml(...documents.slice(2).reverse()),
    'a.yaml': yaml(...documents.slice(0, 2).reverse()),
  });
  const outs = [fresh('twice'), fresh('twice'), fresh('twice-reordered')];
  const results = await Promise.all([
    build(['build', catalogue, '--out', outs[0]!, '--date', DATE]),
    build(['build', catalogue, '--out', outs[1]!, '--date', DATE]),
    build(['build', reordered, '--out', outs[2]!, '--date', DATE]),
  ]);
  for (const result of results) expect(result.status, result.stderr).toBe(0);
  const first = snapshot(outs[0]!);
  expect(Object.keys(first).length).toBeGreaterThan(20);
  expect(snapshot(outs[1]!)).toEqual(first);
  expect(snapshot(outs[2]!)).toEqual(first);
}, 120_000);

/** 280 components, 20 licences and 20 lines of 12 stops, with stored positions (a fixed seed). */
function largeCatalogue(): Record<string, string> {
  let seed = 20271020;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const names = Array.from({ length: 280 }, (_, i) => `app-${String(i).padStart(3, '0')}`);
  const licences = Array.from({ length: 20 }, (_, i) => licence(`licence-${String(i).padStart(2, '0')}`));
  const components = names.map((name, i) => depends(component(name), [`resource:licence-${String(i % 20).padStart(2, '0')}`, ...(i ? [`component:${names[i - 1]}`] : [])]));
  const stopLists = Array.from({ length: 20 }, (_, i) => names.slice(i * 10, i * 10 + 10));
  for (const list of stopLists) while (list.length < 12) {
    const name = names[random(200)]!;
    if (!list.includes(name)) list.push(name);
  }
  const lines = stopLists.map((list, i) => set(set(stops(`journey-${i}`, list), 'spec.code', String(i)), 'spec.color', '#336699'));
  const cells = Array.from({ length: 25 * 12 }, (_, i) => [(i % 25) * 2, Math.floor(i / 25) * 2] as [number, number]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const map = set(layout(), 'spec.stations', Object.fromEntries(names.slice(0, 200).map((name, i) => [`component:${name}`, cells[i]!])));
  return { 'catalog-info.yaml': yaml(...components, ...licences, ...lines, map) };
}

test('Large catalogue', async () => {
  const folder = writeFolder(fresh('large'), largeCatalogue());
  const out = fresh('large-out');
  const result = await build(['build', folder, '--out', out, '--date', DATE]);
  console.info(`build-command: 300 items, 20 lines: ${(result.ms / 1000).toFixed(1)} s`);
  expect(result.status, result.stderr).toBe(0);
  // At least 280 components + 20 licences + 20 journeys + map, software list and journeys list.
  expect(pagesIn(join(out, 'full'))).toBeGreaterThanOrEqual(323);
  expect(result.stderr).toContain(`Built the full site in ${join(out, 'full')} (${pagesIn(join(out, 'full'))} pages)`);
  expect(result.ms).toBeLessThan(90_000);
}, 180_000);
