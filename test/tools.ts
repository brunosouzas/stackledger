/** Find an external tool (actionlint, caddy) on PATH for the tests that need it.
 * A missing tool skips those tests with a visible message. With STACKLEDGER_REQUIRE_TOOLS=1 a
 * missing tool is a failure instead: .github/workflows/test.yml sets it after downloading pinned,
 * checksummed copies, so the checks always run there.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export function findTool(name: string): string | undefined {
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    if (folder && existsSync(join(folder, name))) return join(folder, name);
  }
  return undefined;
}

/** The tool's path, or undefined after saying why its tests are skipped; throws in CI. */
export function toolOrSkip(name: string, file: string): string | undefined {
  const path = findTool(name);
  if (path) return path;
  if (process.env.STACKLEDGER_REQUIRE_TOOLS === '1') throw new Error(`${name} is not on PATH, and STACKLEDGER_REQUIRE_TOOLS=1 requires it`);
  console.warn(`${file}: ${name} is not on PATH, so its checks are skipped. Put ${name} on PATH to run them.`);
  return undefined;
}

/** actionlint's findings for one workflow file; an empty string means none. */
export function actionlint(binary: string, file: string, cwd: string): { status: number | null; output: string } {
  const result = spawnSync(binary, ['-no-color', file], { cwd, encoding: 'utf8', timeout: 60_000 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
