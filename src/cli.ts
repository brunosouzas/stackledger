#!/usr/bin/env node
/** Read and validate a local catalogue. Build with npm run build, run stackledger validate [folder].
 * Usage/folder failures exit 2 on stderr; catalogue problems stay on stdout (exit 0 or 1).
 */
import { parseArgs } from 'node:util';
import { validateFolder, type Result } from './validate.js';
const usage = 'Usage: stackledger validate [folder] [--json]\n       stackledger --help\n';
function text(result: Result): string {
  const lines = result.problems.map(p => `${p.path}:${p.line}:${p.column} ${p.severity} ${p.field ?? '-'} ${p.message}`);
  const s = result.summary;
  lines.push(`files: ${s.files}, documents: ${s.documents}, ignored: ${s.ignored}, errors: ${s.errors}, warnings: ${s.warnings}`);
  return lines.join('\n') + '\n';
}
async function main(args: string[]): Promise<void> {
  if (args.includes('--help')) { process.stdout.write(usage); return; }
  try {
    const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: 'boolean' } } });
    const [command, folder, ...extra] = positionals;
    if (!command) throw new Error('A command is required');
    if (command !== 'validate') throw new Error('Unknown command; expected validate');
    if (extra.length) throw new Error('Only one folder is accepted');
    const { problems, summary } = await validateFolder(folder ?? process.cwd());
    const result = { problems, summary };
    process.stdout.write(values.json ? JSON.stringify(result) + '\n' : text(result));
    process.exitCode = summary.errors ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Cannot validate catalogue'}\n${usage}`);
    process.exitCode = 2;
  }
}
await main(process.argv.slice(2));
