#!/usr/bin/env node
/** Command line: validate, mcp, map, build, report, discover, drift, skills validate and skills map; run node dist/cli.js --help for their options.
 * Usage/folder failures exit 2 on stderr with empty stdout; internal failures exit 1 without usage. Validate and skills validate report problems on stdout;
 * map writes SVG, report the licence report and drift the comparison with a snapshot on stdout, diagnostics on stderr. skills map writes Markdown pages into its --out folder
 * and only diagnostics on stderr. MCP stdout contains protocol messages only.
 * Validate's text lines lose their control characters (a file name may hold ESC or U+009B) and its JSON has U+007F–U+009F as \u escapes (src/control.ts).
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { validateFolder, type Result } from './validate.js';
import { loadFolder } from './source.js';
import { viewNames, type ViewName } from './views.js';
import { reportFailure } from './errors.js';
import { escapeJsonControls, withoutControls } from './control.js';
const usage = 'Usage: stackledger validate [folder] [--json]\n       stackledger mcp <folder> [--view full|staff]\n       stackledger map <folder> [--view full|staff] [--theme light|dark] [--date YYYY-MM-DD]\n       stackledger build <folder> --out <dir> [--date YYYY-MM-DD] [--skills <folder>]...\n       stackledger report <folder> [--date YYYY-MM-DD] [--days N] [--format text|json|csv|ics]\n       stackledger discover\n       stackledger drift <folder> [--snapshot <file>] [--format text|json] [--scaffold <dir>]\n       stackledger skills validate [folder...] [--json]\n       stackledger skills map [folder...] --out <folder> [--check]\n       stackledger --help\n';
function text(result: Result): string {
  const lines = result.problems.map(p => withoutControls(`${p.path}:${p.line}:${p.column} ${p.severity} ${p.field ?? '-'} ${p.message}`));
  const s = result.summary;
  lines.push(`files: ${s.files}, documents: ${s.documents}, ignored: ${s.ignored}, errors: ${s.errors}, warnings: ${s.warnings}`);
  return lines.join('\n') + '\n';
}
async function validate(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: 'boolean' } } });
  const [, folder, ...extra] = positionals;
  if (extra.length) throw new Error('Only one folder is accepted');
  const { problems, summary } = await validateFolder(folder ?? process.cwd());
  const result = { problems, summary };
  process.stdout.write(values.json ? escapeJsonControls(JSON.stringify(result)) + '\n' : text(result));
  process.exitCode = summary.errors ? 1 : 0;
}
async function mcp(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true, options: { view: { type: 'string' } } });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  const view = values.view ?? 'full';
  if (!viewNames.includes(view as ViewName)) throw new Error(`Unknown view; allowed views: ${viewNames.join(', ')}`);
  // Check the folder before the transport starts, so exit 2 happens before any protocol output.
  const absolute = resolve(folder);
  await loadFolder(absolute);
  const { serve } = await import('./mcp.js');
  await serve(absolute, view as ViewName);
}
async function main(args: string[]): Promise<void> {
  if (args.includes('--help')) { process.stdout.write(usage); return; }
  try {
    // Find the command first; each command then parses its own options strictly.
    const { positionals } = parseArgs({ args, strict: false, allowPositionals: true, options: { json: { type: 'boolean' }, view: { type: 'string' }, theme: { type: 'string' }, date: { type: 'string' }, out: { type: 'string' }, days: { type: 'string' }, format: { type: 'string' }, snapshot: { type: 'string' }, scaffold: { type: 'string' } } });
    const command = positionals[0];
    if (!command) throw new Error('A command is required');
    if (command === 'validate') await validate(args);
    else if (command === 'mcp') await mcp(args);
    else if (command === 'map') { const { mapCommand } = await import('./map/command.js'); await mapCommand(args); }
    else if (command === 'build') { const { buildCommand } = await import('./site/command.js'); await buildCommand(args); }
    else if (command === 'report') { const { reportCommand } = await import('./report-command.js'); await reportCommand(args); }
    else if (command === 'discover') { const { discoverCommand } = await import('./discover-command.js'); await discoverCommand(args); }
    else if (command === 'drift') { const { driftCommand } = await import('./drift-command.js'); await driftCommand(args); }
    else if (command === 'skills') { const { skillsCommand } = await import('./skills/command.js'); await skillsCommand(args); }
    else throw new Error('Unknown command; expected validate, mcp, map, build, report, discover, drift or skills');
  } catch (error) {
    const { stderr, exitCode } = reportFailure(error, usage);
    process.stderr.write(stderr);
    process.exitCode = exitCode;
  }
}
await main(process.argv.slice(2));
