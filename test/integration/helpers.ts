/** Spawn the built executable, not an in-process mock. Build first with npm run build. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const cli = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
export const demo = fileURLToPath(new URL('../fixtures/demo/', import.meta.url));
export function run(args: string[] = [], cwd = root, flags: string[] = []) {
 const result = spawnSync(process.execPath, [...flags, cli, ...args], { cwd, encoding: 'utf8', timeout: 20000, env: { ...process.env, NODE_OPTIONS: '' } });
 if (result.error) throw result.error;
 return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}
