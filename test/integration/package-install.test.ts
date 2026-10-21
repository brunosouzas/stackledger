/** The packed package installs and runs, with exactly the production dependency versions of
 * npm-shrinkwrap.json (package-release spec, Package contents and Locked dependencies).
 * Run npm run build && npm test. It packs a clean checkout, installs that tarball into two empty
 * temporary folders as `stackledger@<version>` from a local stand-in registry (registry-stand-in.ts
 * says why a plain `npm install ./file.tgz` would not do), and compares `npm ls --all --json` of
 * both with the shrinkwrap. The other packages come from the npm registry, so it needs the network:
 * it is skipped only when STACKLEDGER_OFFLINE=1. Every npm call uses a temporary cache and an
 * explicit --prefix, so neither the user's npm cache nor a node_modules above the folder is touched.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './helpers.js';
import { cleanCheckout, npm, npmEnv, pack, removeFolder, tempFolder } from './package-helpers.js';
import { serveTarball, type StandIn } from './registry-stand-in.js';

const offline = process.env.STACKLEDGER_OFFLINE === '1';
if (offline) console.warn('package-install.test.ts skipped: STACKLEDGER_OFFLINE=1 (it needs the npm registry)');

interface Tree { version?: string; dependencies?: Record<string, Tree> }
interface Locked { version?: string; dev?: boolean; optional?: boolean; devOptional?: boolean; link?: boolean }

/** Every package below `tree` as `path name@version`, the path made of its parents' names.
 * An entry without a version is an optional peer that nothing installs, so it is left out.
 * npm ls lists a package's dependencies once and marks later copies "deduped", so the paths of
 * one install are compared with the other's, and the name@version set with the shrinkwrap. */
function flatten(tree: Tree, parents: string[] = []): string[] {
  return Object.entries(tree.dependencies ?? {}).flatMap(([name, child]) => child.version === undefined ? []
    : [`${[...parents, name].join('>')}@${child.version}`, ...flatten(child, [...parents, name])]);
}

/** The installed versions, by name, for comparison with the shrinkwrap. */
const versions = (entries: string[]) => new Set(entries.map(entry => entry.replace(/^.*>/, '')));

/** npm install without blocking this process, which serves the stand-in registry meanwhile. */
function install(target: string, registry: string, cache: string, version: string) {
  const args = ['install', '--prefix', target, '--no-audit', '--no-fund', '--cache', cache,
    '--registry', registry, '--replace-registry-host', 'never', `stackledger@${version}`];
  return new Promise<{ status: number | null; stderr: string }>(resolve => {
    const child = spawn('npm', args, { cwd: target, env: npmEnv, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stderr }));
  });
}

describe.skipIf(offline)('installed package', () => {
  let checkout: string, output: string, cache: string, registry: StandIn | undefined;
  const installs: string[] = [];
  beforeAll(async () => {
    checkout = cleanCheckout(); output = tempFolder('pack'); cache = tempFolder('cache');
    const packed = pack(checkout, output, cache);
    registry = await serveTarball(join(output, packed.filename));
    const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
    for (const name of ['first', 'second']) {
      const target = tempFolder(`install-${name}`); installs.push(target);
      const result = await install(target, registry.url, cache, version);
      if (result.status !== 0) throw new Error(`npm install failed in the ${name} folder: ${result.stderr}`);
    }
  }, 900_000);
  // Removing two installs and an npm cache can take longer than the default hook time under load.
  afterAll(async () => { await registry?.close(); for (const path of [checkout, output, cache, ...installs]) removeFolder(path); }, 120_000);

  test('Installed package runs: stackledger --help lists the seven commands', () => {
    const result = spawnSync(join(installs[0]!, 'node_modules', '.bin', 'stackledger'), ['--help'], { encoding: 'utf8', env: npmEnv });
    expect(result.status, result.stderr).toBe(0);
    for (const command of ['validate', 'mcp', 'map', 'build', 'report', 'discover', 'drift']) {
      expect(result.stdout).toMatch(new RegExp(`^ *(Usage: )?stackledger ${command}\\b`, 'm'));
    }
  });

  test('Two installs agree: same production versions in both, equal to the shrinkwrap', () => {
    const listed = installs.map(target => {
      // npm ls exits 1 when it reports extraneous packages (below), so its JSON is read whatever the status.
      const result = npm(['ls', '--prefix', target, '--all', '--json', '--cache', cache], target);
      const tree = JSON.parse(result.stdout) as Tree;
      expect(tree.dependencies?.stackledger, result.stderr).toBeDefined();
      return flatten(tree.dependencies!.stackledger!).sort();
    });
    expect(listed[0]!.length).toBeGreaterThan(0);
    expect(listed[1]).toEqual(listed[0]);

    const shrinkwrap = JSON.parse(readFileSync(join(root, 'npm-shrinkwrap.json'), 'utf8')) as { packages: Record<string, Locked> };
    const entries = Object.entries(shrinkwrap.packages).filter(([path, entry]) => path !== '' && !entry.link)
      .map(([path, entry]) => ({ id: `${path.replace(/^.*node_modules\//, '')}@${entry.version}`, entry }));
    const installed = versions(listed[0]!);
    // Every production entry is installed at its locked version; optional ones are other platforms' builds.
    const required = entries.filter(({ entry }) => !entry.dev && !entry.optional && !entry.devOptional);
    expect(required.length).toBeGreaterThan(0);
    expect(required.filter(({ id }) => !installed.has(id)).map(({ id }) => id)).toEqual([]);
    // Nothing installed has a version the shrinkwrap does not lock. npm also installs a dependency's
    // shrinkwrap entries marked dev, as packages nothing uses ("extraneous"); they are locked too.
    const locked = new Set(entries.map(({ id }) => id));
    expect([...installed].filter(id => !locked.has(id))).toEqual([]);
  });
});
