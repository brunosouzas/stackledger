#!/usr/bin/env node
/** Command line: validate, mcp, map and build; run node dist/cli.js --help for their options.
 * Usage/folder failures exit 2 on stderr with empty stdout; internal failures exit 1 without usage. Validate reports problems on stdout;
 * map writes SVG on stdout and diagnostics on stderr. MCP stdout contains protocol messages only.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { validateFolder, type Result } from './validate.js';
import { loadFolder } from './source.js';
import { viewNames, type ViewName } from './views.js';
import { reportFailure } from './errors.js';
const usage = 'Usage: stackledger validate [folder] [--json]\n       stackledger mcp <folder> [--view full|staff]\n       stackledger map <folder> [--view full|staff] [--theme light|dark] [--date YYYY-MM-DD]\n       stackledger build <folder> --out <dir> [--date YYYY-MM-DD]\n       stackledger --help\n';
function text(result: Result): string {
  const lines = result.problems.map(p => `${p.path}:${p.line}:${p.column} ${p.severity} ${p.field ?? '-'} ${p.message}`);
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
  process.stdout.write(values.json ? JSON.stringify(result) + '\n' : text(result));
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
    const { positionals } = parseArgs({ args, strict: false, allowPositionals: true, options: { json: { type: 'boolean' }, view: { type: 'string' }, theme: { type: 'string' }, date: { type: 'string' }, out: { type: 'string' } } });
    const command = positionals[0];
    if (!command) throw new Error('A command is required');
    if (command === 'validate') await validate(args);
    else if (command === 'mcp') await mcp(args);
    else if (command === 'map') { const { mapCommand } = await import('./map/command.js'); await mapCommand(args); }
    else if (command === 'build') { const { buildCommand } = await import('./site/command.js'); await buildCommand(args); }
    else throw new Error('Unknown command; expected validate, mcp, map or build');
  } catch (error) {
    const { stderr, exitCode } = reportFailure(error, usage);
    process.stderr.write(stderr);
    process.exitCode = exitCode;
  }
}
await main(process.argv.slice(2));
