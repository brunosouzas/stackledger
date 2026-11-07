/** Test-only entry point: runs `stackledger build` from the built package with a wrapped FsOps.
 *
 * Why: the shipped CLI has no test hook, so a user can never trigger a fault; the build tests still
 * need a real child process (Astro changes the current directory) that fails, or sees its output
 * folder swapped, at a chosen filesystem call. This script passes test/fs-wrapper.mjs's wrapper as
 * the `ops` argument of buildCommand. It lives under test/ and is not part of the package.
 *
 * Run (after npm run build):
 *   node test/integration/build-with-faults.mjs '<plan JSON>' build <folder> --out <dir> [--date D]
 * The plan is the one wrapOps documents, for example {"out": "/tmp/x", "fail": [{"op": "rename", "nth": 3}]},
 * plus two build hooks (src/site/build.ts BuildHooks): `missingFont` names a font file of the fonts
 * configuration that the installed packages then lack (catalogue-site, Missing font file), and
 * `pageEdit` { site: 'full' | 'staff', page, kind } changes one page right after Astro wrote it: kind
 * `style` adds <style>p{color:red}</style> to its head (Other style still fails), kind `font-css`
 * changes one character of its font CSS (Font CSS differs between pages).
 * Failures are reported as src/cli.ts reports them (exit 1 for internal errors, 2 for usage errors).
 * When a swap happened, a last stderr line lists any change made after it ("changes after the swap: none").
 */
import { buildCommand } from '../../dist/site/command.js';
import { NODE_FS } from '../../dist/site/fs-ops.js';
import { reportFailure } from '../../dist/errors.js';
import { wrapOps } from '../fs-wrapper.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';

const require = createRequire(import.meta.url);
const [json, ...args] = process.argv.slice(2);
const plan = JSON.parse(json ?? '{}');
const wrapper = wrapOps(NODE_FS, plan);
const hooks = {};
if (plan.missingFont) {
  hooks.fontFile = (pkg, file) => {
    const path = require.resolve(`${pkg}/files/${file}`);
    return file === plan.missingFont ? `${path}.missing` : path;
  };
}
if (plan.pageEdit) {
  const { site, page, kind } = plan.pageEdit;
  hooks.afterAstro = dir => {
    if (basename(dir) !== `site-${site}`) return;
    const path = join(dir, page);
    const html = readFileSync(path, 'utf8');
    const edited = kind === 'style' ? html.replace('</head>', '<style>p{color:red}</style></head>') : html.replace('font-display:swap', 'font-display:swaq');
    if (edited === html) throw new Error(`build-with-faults: could not edit ${page}`);
    writeFileSync(path, edited);
  };
}
try {
  await buildCommand(args, wrapper.ops, hooks);
} catch (error) {
  const { stderr, exitCode } = reportFailure(error, 'Usage: build-with-faults.mjs <plan JSON> build <folder> --out <dir>\n');
  process.stderr.write(stderr);
  process.exitCode = exitCode;
}
if (wrapper.swapped()) process.stderr.write(`changes after the swap: ${wrapper.changesAfterSwap.join(', ') || 'none'}\n`);
