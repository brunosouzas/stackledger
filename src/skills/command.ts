/** `stackledger skills validate [folder...] [--json]` (skills-validate-command spec). Called by
 * src/cli.ts; run `node dist/cli.js skills validate /path/to/skills`.
 *
 * Reads the given folders (none: the current folder) as one skill set through src/skills/source.ts and
 * prints its problems: one line each and a counts line, or one JSON object with `--json`. Exit 0 with
 * no error (warnings allowed), 1 with at least one error. A usage error or a given folder that cannot
 * be checked throws a plain Error before anything is written, so src/cli.ts prints the reason and the
 * usage on stderr and exits 2 with stdout empty; any other failure is an InternalError (exit 1).
 *
 * Text lines lose their control characters and JSON has U+007F–U+009F as `\u` escapes (src/control.ts),
 * because folder and file names come from outside and may hold ESC or U+009B. Only reads; no network.
 */
import { parseArgs } from 'node:util';
import { escapeJsonControls, withoutControls } from '../control.js';
import { internal } from '../errors.js';
import { writeStdout } from '../stdout.js';
import { readSkillSet, type SkillSet } from './source.js';
import { SkillsFolderError } from './walk.js';

const SUBCOMMANDS = ['validate'];

/** The default output: one line per problem, then the counts. */
export function formatText(set: Pick<SkillSet, 'problems' | 'summary'>): string {
  const lines = set.problems.map(p => withoutControls(`${p.path}:${p.line}:${p.column} ${p.severity} ${p.field ?? '-'} ${p.message}`));
  const s = set.summary;
  lines.push(`skills: ${s.skills}, playbooks: ${s.playbooks}, agents: ${s.agents}, rules: ${s.rules}, errors: ${s.errors}, warnings: ${s.warnings}`);
  return lines.join('\n') + '\n';
}
/** The `--json` output: problems and summary, with U+007F–U+009F escaped. */
export function formatJson(set: Pick<SkillSet, 'problems' | 'summary'>): string {
  return escapeJsonControls(JSON.stringify({ problems: set.problems, summary: set.summary })) + '\n';
}

/** Run `stackledger skills …` with the whole argument list (`skills` first). */
export async function skillsCommand(args: string[]): Promise<void> {
  // An unknown option (named in parseArgs' message) is a usage error, thrown before anything is read.
  const { values, positionals } = parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: 'boolean' } } });
  const [, subcommand, ...folders] = positionals;
  if (subcommand === undefined) throw new Error(`A skills subcommand is required; expected ${SUBCOMMANDS.join(', ')}`);
  if (!SUBCOMMANDS.includes(subcommand)) throw new Error(`Unknown skills subcommand '${subcommand}'; expected ${SUBCOMMANDS.join(', ')}`);
  let set: SkillSet;
  try { set = await readSkillSet(folders); } catch (error) {
    if (error instanceof SkillsFolderError) throw new Error(error.message);
    throw internal('skills validate', error);
  }
  await writeStdout(values.json ? formatJson(set) : formatText(set), 'stackledger skills validate: cannot write the output');
  process.exitCode = set.summary.errors ? 1 : 0;
}
