/** Build fixture catalogues into both sites with the built package, in a child process.
 * Build first with npm run build. Each build runs dist/site/build.js prepareBuild in its own Node
 * process (Astro changes the current directory and must not run inside the test runner's module
 * system). Folders live in the test's temporary directory and are removed by cleanup().
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { listFiles } from '../../src/site/relative.js';
import { root } from './helpers.js';

const run = promisify(execFile);
const created: string[] = [];

export interface Built { catalogue: string; staging: string; staff: string; full: string; root: string }

export async function buildSites(files: Record<string, string>, date = '2027-06-01'): Promise<Built> {
  const base = mkdtempSync(join(tmpdir(), 'stackledger-site-'));
  created.push(base);
  const catalogue = join(base, 'catalogue');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(catalogue, path)), { recursive: true });
    writeFileSync(join(catalogue, path), content);
  }
  mkdirSync(catalogue, { recursive: true });
  const staging = join(base, 'out', '.stackledger-tmp-test');
  mkdirSync(staging, { recursive: true });
  const module = pathToFileURL(join(root, 'dist/site/build.js')).href;
  const script = `const { prepareBuild } = await import(${JSON.stringify(module)}); await prepareBuild(...JSON.parse(process.argv[1]));`;
  await run(process.execPath, ['--input-type=module', '-e', script, JSON.stringify([catalogue, staging, date])], { env: { ...process.env, NODE_OPTIONS: '' }, timeout: 120_000 });
  return { catalogue, staging, staff: join(staging, 'site-staff'), full: join(staging, 'site-full'), root: join(staging, 'root') };
}

export function cleanup(): void {
  for (const path of created.splice(0)) rmSync(path, { recursive: true, force: true });
}

/** Every file of a site as relative path -> content. */
export function tree(dir: string): Map<string, string> {
  return new Map(listFiles(dir).map(file => [file, readFileSync(join(dir, file), 'latin1')]));
}

export const pages = (dir: string) => listFiles(dir).filter(file => file.endsWith('.html'));
export const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
