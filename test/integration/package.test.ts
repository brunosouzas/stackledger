/** What the npm package ships (package-release spec, Package contents), and that it holds no test
 * code: no file from test/, nothing named after faults, and no shipped module with a fault hook
 * (design D8: tests wrap FsOps from outside). Run npm run build && npm test.
 * `npm pack --dry-run` lists what `npm publish` would ship, without writing a tarball; its cache is a
 * temporary folder so the user's npm cache is not touched. The contents scenarios run on a clean
 * checkout (no dist/) in a temporary folder, so they also prove that packing builds first.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { root } from './helpers.js';
import { cleanCheckout, npm, pack, removeFolder, tempFolder } from './package-helpers.js';

test('The package holds no test file and no fault hook', () => {
  const cache = folder();
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cache], {
    cwd: root, encoding: 'utf8', timeout: 60_000, env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  expect(result.status, result.stderr).toBe(0);
  const [pack] = JSON.parse(result.stdout) as [{ files: { path: string }[] }];
  const paths = pack.files.map(file => file.path);
  expect(paths).toContain('dist/cli.js');
  expect(paths).toContain('dist/site/fs-ops.js');
  expect(paths.filter(path => path.startsWith('test/') || /fault|journal/i.test(path))).toEqual([]);
  const shipped = paths.filter(path => path.startsWith('dist/site/') && path.endsWith('.js'));
  for (const path of shipped) expect(readFileSync(join(root, path), 'utf8'), path).not.toMatch(/\bfaults?\b|\binjected\b/i);
}, 60_000);

describe('package contents from a clean checkout', () => {
  let checkout: string, output: string, cache: string;
  beforeAll(() => { checkout = cleanCheckout(); output = tempFolder('pack'); cache = tempFolder('cache'); });
  afterAll(() => { removeFolder(checkout); removeFolder(output); removeFolder(cache); }, 60_000);

  test('Packed files: the package lists what users need and nothing from the sources', () => {
    const result = npm(['pack', '--dry-run', '--json', '--cache', cache], checkout);
    expect(result.status, result.stderr).toBe(0);
    // prepack prints the build's output before the JSON array.
    const [listed] = JSON.parse(result.stdout.slice(result.stdout.indexOf('[\n'))) as [{ files: { path: string }[] }];
    const paths = listed.files.map(file => file.path);
    // The site's art ships; its sources (scripts/home-banner.json, scripts/site-art.mjs) do not (catalogue-site, Home banner art).
    for (const path of ['dist/cli.js', 'skills/stackledger/SKILL.md', 'README.md', 'LICENSE', 'package.json', 'npm-shrinkwrap.json',
      'site/public/home-banner.svg', 'site/public/brand-mark-dark.svg',
      ...['github', 'website', 'linkedin', 'email'].flatMap(icon => [`site/public/link-icons/${icon}-light.svg`, `site/public/link-icons/${icon}-dark.svg`])]) {
      expect(paths).toContain(path);
    }
    expect(paths.some(path => path.startsWith('site/'))).toBe(true);
    expect(paths.some(path => path.startsWith('examples/northwind/'))).toBe(true);
    const sources = /^(src|test|scripts|openspec|docs|\.github)\//;
    expect(paths.filter(path => sources.test(path))).toEqual([]);
  }, 180_000);

  test('Shipped shrinkwrap contains only production entries', () => {
    const packed = pack(checkout, output, cache);
    const extracted = spawnSync('tar', ['-xOzf', join(output, packed.filename), 'package/npm-shrinkwrap.json'], { encoding: 'utf8' });
    expect(extracted.status, extracted.stderr).toBe(0);
    const lock = JSON.parse(extracted.stdout) as { packages: Record<string, { dev?: boolean; devOptional?: boolean; devDependencies?: unknown }> };
    expect(Object.entries(lock.packages).filter(([, entry]) => entry.dev || entry.devOptional)).toEqual([]);
    expect(lock.packages['']?.devDependencies).toBeUndefined();
  }, 180_000);

  test('SBOM product identity and required packages match the packed production shrinkwrap', () => {
    const packed = pack(checkout, output, cache);
    const extracted = join(output, 'sbom-extracted', '@brunosouzas', 'stackledger');
    mkdirSync(extracted, { recursive: true });
    const untar = spawnSync('tar', ['-xzf', join(output, packed.filename), '--strip-components=1', '-C', extracted, 'package/package.json', 'package/npm-shrinkwrap.json'], { encoding: 'utf8' });
    expect(untar.status, untar.stderr).toBe(0);
    const lock = JSON.parse(readFileSync(join(extracted, 'npm-shrinkwrap.json'), 'utf8')) as { packages: Record<string, { version?: string; optional?: boolean }> };
    const result = npm(['sbom', '--package-lock-only', '--sbom-format', 'cyclonedx', '--cache', cache], extracted);
    expect(result.status, result.stderr).toBe(0);
    const sbom = JSON.parse(result.stdout) as { metadata: { component: { name: string; version: string; purl?: string } }; components: { name: string; version: string }[] };
    const product = JSON.parse(readFileSync(join(extracted, 'package.json'), 'utf8')) as { name: string; version: string };
    expect(sbom.metadata.component).toMatchObject({ name: product.name, version: product.version, purl: `pkg:npm/${product.name.replace('@', '%40')}@${product.version}` });
    const actual = new Set(sbom.components.map(component => `${component.name}@${component.version}`));
    const required = Object.entries(lock.packages).filter(([path, entry]) => path !== '' && !entry.optional)
      .map(([path, entry]) => `${path.slice(path.lastIndexOf('node_modules/') + 13)}@${entry.version}`);
    expect(required.length).toBeGreaterThan(0);
    expect(required.filter(id => !actual.has(id))).toEqual([]);
  }, 180_000);

  test('Pack without a build: the tarball holds dist/cli.js', () => {
    rmSync(join(checkout, 'dist'), { recursive: true, force: true });
    const packed = pack(checkout, output, cache);
    const listed = spawnSync('tar', ['-tzf', join(output, packed.filename)], { encoding: 'utf8' });
    expect(listed.status, listed.stderr).toBe(0);
    expect(listed.stdout.split('\n')).toContain('package/dist/cli.js');
  }, 180_000);
});
