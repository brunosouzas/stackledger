/** Read and check a skill set: the skills, playbooks, agents and rules of one or more folders, what
 * one agent would see (skill-source spec). Used by src/skills/command.ts (`stackledger skills
 * validate`). Only reads files: nothing is written and nothing is sent over the network.
 *
 * Validation runs in three phases, so one root cause gives one message and the counts are stable:
 * 1. Own checks of each SKILL.md and agent file, in a fixed order, an error stopping the later steps:
 *    size and readability, secret rules on the raw text, frontmatter shape, secret rules on every
 *    decoded key and string (YAML escapes such as `\u0031` hide a card number from the raw scan),
 *    name and description, then the other field checks. A file with no error is a candidate.
 * 2. Among candidates, in walk order, a later skill (or agent) with a name already used is rejected.
 * 3. The set is now fixed. Declared relations, agent preloads and rules (rule IDs across skills) are
 *    checked against it; their problems never remove an item, so there is no cascade.
 * A file rejected in phase 1 or 2 never reaches the set, so its values (a secret, say) never appear in
 * another item's message. Problems are sorted with the catalogue's sortProblems. Entries skipped by a
 * `.stackledgerignore` file never reach phase 1; they are only counted and listed (src/skills/walk.ts).
 *
 * What can go wrong: a given folder that is missing, not a folder or cannot be listed throws
 * SkillsFolderError (src/skills/walk.ts); every other failure is a problem on its path.
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { compareText } from '../identity.js';
import { fileProblem, MAX_FILE_BYTES, type Problem } from '../source.js';
import { sortProblems } from '../validate.js';
import { IGNORE_FILE } from './ignore.js';
import { readBounded, secretProblems } from './read.js';
import { AGENTS_KEY, SKILLS_KEY, at, checkAgentFields, checkNameAndDescription, checkSkillFields, readFrontmatter,
  relationNames, type Frontmatter, type SkillKind } from './frontmatter.js';
import { parseRules, type Rule } from './rules.js';
import { RULES_FILE, SKILL_FILE, walkSkillFolders, type FoundAgent, type FoundSkill, type WalkOptions } from './walk.js';

export interface Skill {
  name: string;
  kind: SkillKind;
  /** Display path of the SKILL.md. */
  path: string;
  /** Declared relations, in the order written, repeats removed. */
  skills: string[];
  agents: string[];
  rules: Rule[];
}
export interface Agent {
  name: string;
  path: string;
  /** Preloaded skills, as listed. */
  preloads: string[];
}
export interface SkillsSummary { skills: number; playbooks: number; agents: number; rules: number; ignored: number; errors: number; warnings: number }
export interface SkillSet {
  skills: Skill[];
  agents: Agent[];
  problems: Problem[];
  /** Display paths of the entries skipped by ignore files, each once, sorted by code point. */
  ignored: string[];
  summary: SkillsSummary;
}

interface SkillCandidate { found: FoundSkill; frontmatter: Frontmatter; kind: SkillKind }
interface AgentCandidate { found: FoundAgent; frontmatter: Frontmatter; preloads: string[] }

/** A file's display path inside a skill folder; a folder of `/` (or ending in `/`) adds no second separator. */
function displayJoin(folder: string, file: string): string {
  if (!folder) return file;
  return folder.endsWith('/') ? folder + file : `${folder}/${file}`;
}
/** A file's text, or the error that stops its checks (too large or unreadable), read once and bounded
 * (src/skills/read.ts). */
function readText(absolute: string, path: string): ReturnType<typeof readBounded> {
  return readBounded(absolute, path, { bytes: MAX_FILE_BYTES, tooLarge: 'File is larger than 1 MiB; not read', unreadable: 'File cannot be read' });
}
/** Every key and scalar of a decoded frontmatter value, as text: strings, numbers (a hexadecimal key decodes
 * to a number), and the keys and members of the `Map` and `Set` objects that `!!omap`, `!!pairs` and `!!set`
 * produce. Aliases can share objects, so each is visited once. */
function* decodedStrings(value: unknown, seen = new Set<object>()): Generator<string> {
  if (typeof value === 'string') { yield value; return; }
  if (typeof value === 'number' || typeof value === 'bigint') { yield String(value); return; }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) {
    for (const [key, child] of value) { yield* decodedStrings(key, seen); yield* decodedStrings(child, seen); }
    return;
  }
  if (value instanceof Set) { for (const member of value) yield* decodedStrings(member, seen); return; }
  for (const [key, child] of Object.entries(value)) {
    if (!Array.isArray(value)) yield key;
    yield* decodedStrings(child, seen);
  }
}

/** Phase 1, steps 1 to 4 for one file: its frontmatter, or the problems that stop it. Agent files with no
 * frontmatter block get a warning instead of an error. */
async function ownFrontmatter(absolute: string, path: string, agent: boolean): Promise<{ frontmatter?: Frontmatter; problems: Problem[] }> {
  const read = await readText(absolute, path);
  if ('problem' in read) return { problems: [read.problem] };
  const raw = secretProblems(path, [read.text]);
  if (raw.length) return { problems: raw };
  const parsed = readFrontmatter(path, read.text);
  if (parsed.status === 'absent' && agent) {
    return { problems: [fileProblem(path, 'Agent file has no frontmatter; not read as an agent', 'warning')] };
  }
  if (parsed.status !== 'read') return { problems: [parsed.problem] };
  const decoded = secretProblems(path, decodedStrings(parsed.frontmatter.value));
  if (decoded.length) return { problems: decoded };
  return { frontmatter: parsed.frontmatter, problems: [] };
}
const hasError = (problems: Problem[]) => problems.some(problem => problem.severity === 'error');
const distinct = (names: string[]) => [...new Set(names)];

/** Read the given folders (none: the current folder) as one skill set. */
export async function readSkillSet(folders: string[], options: WalkOptions = {}): Promise<SkillSet> {
  const walked = await walkSkillFolders(folders, options);
  const problems: Problem[] = [...walked.problems];
  for (const folder of walked.folders) {
    if (folder.found) continue;
    // Skipped entries are not found, so a pattern that hides everything fails; the message says it was the ignore file.
    const skipped = folder.ignored === 1 ? '; 1 entry was skipped by ' + IGNORE_FILE
      : folder.ignored ? `; ${folder.ignored} entries were skipped by ${IGNORE_FILE}` : '';
    problems.push(fileProblem(folder.path, `No skill folder or agent file found in this folder${skipped}`));
  }

  // Phase 1: own checks; phase 2: unique names among candidates, in walk order.
  const skillCandidates: SkillCandidate[] = [];
  const agentCandidates: AgentCandidate[] = [];
  const skillPaths = new Map<string, string>(), agentPaths = new Map<string, string>();
  for (const found of walked.items) {
    const path = found.type === 'skill' ? displayJoin(found.folder, SKILL_FILE) : found.path;
    const absolute = found.type === 'skill' ? join(found.absolute, SKILL_FILE) : found.absolute;
    const own = await ownFrontmatter(absolute, path, found.type === 'agent');
    problems.push(...own.problems);
    const frontmatter = own.frontmatter;
    if (!frontmatter) continue;
    const identity = checkNameAndDescription(frontmatter);
    problems.push(...identity);
    if (hasError(identity)) continue;
    const name = frontmatter.value.name as string;
    const paths = found.type === 'skill' ? skillPaths : agentPaths;
    if (found.type === 'skill') {
      const fields = checkSkillFields(frontmatter, found.folderName);
      problems.push(...fields.problems);
      if (hasError(fields.problems)) continue;
      const earlier = paths.get(name);
      if (earlier !== undefined) { problems.push(at(frontmatter, ['name'], `Name ${name} is already used by ${earlier}`)); continue; }
      paths.set(name, path);
      skillCandidates.push({ found, frontmatter, kind: fields.kind });
    } else {
      const fields = checkAgentFields(frontmatter);
      problems.push(...fields.problems);
      const earlier = paths.get(name);
      if (earlier !== undefined) { problems.push(at(frontmatter, ['name'], `Name ${name} is already used by ${earlier}`)); continue; }
      paths.set(name, path);
      agentCandidates.push({ found, frontmatter, preloads: fields.preloads });
    }
  }

  // Phase 3: the set is fixed; check what each item declares against it, without removing anything.
  const skills: Skill[] = [], agents: Agent[] = [];
  const ruleOwners = new Map<string, string>();
  for (const candidate of skillCandidates) {
    const { frontmatter, found } = candidate;
    const name = frontmatter.value.name as string;
    const skill: Skill = { name, kind: candidate.kind, path: frontmatter.path, skills: [], agents: [], rules: [] };
    for (const [key, known, noun] of [[SKILLS_KEY, skillPaths, 'Skill'], [AGENTS_KEY, agentPaths, 'Agent']] as const) {
      const declared = (frontmatter.value.metadata as Record<string, unknown> | undefined)?.[key];
      if (typeof declared !== 'string') continue;
      const names = relationNames(declared);
      for (const missing of distinct(names.filter(target => !known.has(target)))) {
        problems.push(at(frontmatter, ['metadata', key], `${noun} ${missing} is not in the set`));
      }
      for (const repeated of distinct(names.filter((target, index) => names.indexOf(target) !== index))) {
        problems.push(at(frontmatter, ['metadata', key], `${repeated} is listed more than once`, 'warning'));
      }
      if (key === SKILLS_KEY && names.includes(name)) problems.push(at(frontmatter, ['metadata', key], `${name} lists itself`, 'warning'));
      skill[key === SKILLS_KEY ? 'skills' : 'agents'] = distinct(names);
    }
    if (found.hasRules) skill.rules = await readRules(found, name, ruleOwners, problems);
    skills.push(skill);
  }
  for (const candidate of agentCandidates) {
    const { frontmatter } = candidate;
    candidate.preloads.forEach((preload, index) => {
      if (!skillPaths.has(preload)) problems.push(at(frontmatter, ['skills', index], `Skill ${preload} is not in the set; the tool skips it`, 'warning'));
    });
    agents.push({ name: frontmatter.value.name as string, path: frontmatter.path, preloads: candidate.preloads });
  }

  sortProblems(problems);
  const count = (severity: Problem['severity']) => problems.filter(problem => problem.severity === severity).length;
  return { skills, agents, problems, ignored: [...walked.ignored].sort(compareText), summary: {
    skills: skills.filter(skill => skill.kind === 'skill').length,
    playbooks: skills.filter(skill => skill.kind === 'playbook').length,
    agents: agents.length,
    rules: skills.reduce((sum, skill) => sum + skill.rules.length, 0),
    ignored: walked.ignored.length,
    errors: count('error'), warnings: count('warning'),
  } };
}

/** The rules of a skill in the set. A rules file that is too large, unreadable or breaks a secret rule
 * gives no rules; a rule ID repeated in the file drops that rule; one used by an earlier skill is a warning. */
async function readRules(found: FoundSkill, skill: string, owners: Map<string, string>, problems: Problem[]): Promise<Rule[]> {
  const path = displayJoin(found.folder, RULES_FILE);
  const absolute = join(found.absolute, RULES_FILE);
  try { if (!(await stat(absolute)).isFile()) return []; } catch { /* A broken link or a vanished file: readText reports it. */ }
  const read = await readText(absolute, path);
  if ('problem' in read) { problems.push(read.problem); return []; }
  const secrets = secretProblems(path, [read.text]);
  if (secrets.length) { problems.push(...secrets); return []; }
  const parsed = parseRules(read.text);
  for (const duplicate of parsed.duplicates) {
    problems.push({ path, line: duplicate.line, column: 1, severity: 'error', field: null,
      message: `Rule ID ${duplicate.id} is already defined at line ${duplicate.firstLine}` });
  }
  for (const rule of parsed.rules) {
    const owner = owners.get(rule.id);
    if (owner === undefined) owners.set(rule.id, skill);
    else problems.push({ path, line: rule.line, column: 1, severity: 'warning', field: null, message: `Rule ID ${rule.id} is also used by skill ${owner}` });
  }
  return parsed.rules;
}
