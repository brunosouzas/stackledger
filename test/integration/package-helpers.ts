/** A clean checkout of this repository in a temporary folder, and npm pack on it, for the package
 * tests. The copy holds what Git would check out (tracked and new, not ignored, files), so no dist/:
 * packing it proves prepack builds first. node_modules is a link to this checkout's, so the build
 * needs no install. Every npm call uses a temporary cache, so the user's npm cache is not touched.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { root } from './helpers.js';

export const npmEnv = { ...process.env, npm_config_update_notifier: 'false', npm_config_fund: 'false', NODE_OPTIONS: '' };

export function tempFolder(prefix: string): string { return mkdtempSync(join(tmpdir(), `stackledger-${prefix}-`)); }
export function removeFolder(path: string | undefined) { if (path) rmSync(path, { recursive: true, force: true }); }

export function npm(args: string[], cwd: string, timeout = 240_000) {
  const result = spawnSync('npm', args, { cwd, encoding: 'utf8', timeout, env: npmEnv });
  if (result.error) throw result.error;
  return result;
}

export function cleanCheckout(): string {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
  const copy = tempFolder('checkout');
  // A file deleted in the working tree is still listed by --cached until it is committed.
  for (const path of listed.stdout.split('\0').filter(Boolean)) {
    if (!existsSync(join(root, path))) continue;
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    cpSync(join(root, path), join(copy, path));
  }
  symlinkSync(join(root, 'node_modules'), join(copy, 'node_modules'));
  return copy;
}

export interface Packed { filename: string; integrity: string; files: { path: string }[] }

/** npm pack with its lifecycle scripts (prepack builds dist/), the tarball written to `destination`. */
export function pack(checkout: string, destination: string, cache: string): Packed {
  const result = npm(['pack', '--json', '--pack-destination', destination, '--cache', cache], checkout);
  if (result.status !== 0) throw new Error(`npm pack failed: ${result.stderr}`);
  // Lifecycle scripts print to stdout before the JSON; the JSON array is the last thing written.
  const json = result.stdout.slice(result.stdout.indexOf('[\n'));
  const [packed] = JSON.parse(json) as Packed[];
  return packed!;
}
