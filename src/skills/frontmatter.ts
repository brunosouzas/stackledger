/** Frontmatter of `SKILL.md` and agent files, and the checks of one file's fields (skill-source spec:
 * Frontmatter, Name and description, Agent Skills specification checks, Fields outside the
 * specification, Relation keys). Used by src/skills/source.ts; pure functions, no I/O.
 *
 * Positions: the frontmatter is parsed as the file's text with its opening `---` line replaced by an
 * empty line, so the parser's line and column are the file's own. A missing field and a whole-file
 * problem are at `1:1` (unlike the catalogue's problem(), which uses the start of the mapping).
 *
 * A file whose frontmatter is absent, unclosed, not one YAML mapping or has duplicate keys gets
 * exactly one error at `1:1` with a fixed message: parser messages can quote the file, and a value
 * that breaks a secret rule must never reach the output.
 */
import { isMap, isScalar, LineCounter, parseAllDocuments, type Document, type Node } from 'yaml';
import { compareText } from '../identity.js';
import { fieldName, fileProblem, resolveNode, sourceNode, type FieldPath, type Problem, type Source } from '../source.js';

const BYTE_ORDER_MARK = '\uFEFF';
const FENCE_LINE = '---';
/** Top-level fields the Agent Skills specification allows. */
const SPECIFICATION_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const MAX_NAME_CODE_POINTS = 64;
const MAX_DESCRIPTION_CODE_POINTS = 1024;
const MAX_COMPATIBILITY_CODE_POINTS = 500;
const RELATION_PREFIX = 'stackledger-';
export const KIND_KEY = 'stackledger-kind';
export const SKILLS_KEY = 'stackledger-skills';
export const AGENTS_KEY = 'stackledger-agents';
const RELATION_KEYS = new Set([KIND_KEY, SKILLS_KEY, AGENTS_KEY]);
export type SkillKind = 'skill' | 'playbook';
const KINDS: readonly string[] = ['skill', 'playbook'];

export type Frontmatter = Source;
export type FrontmatterResult =
  | { status: 'read'; frontmatter: Frontmatter }
  /** The file does not start with a `---` line (an agent file then gets a warning instead of an error). */
  | { status: 'absent'; problem: Problem }
  | { status: 'invalid'; problem: Problem };

/** Split and parse the frontmatter block of a file's text. */
export function readFrontmatter(path: string, text: string): FrontmatterResult {
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const opening = /^---\r?\n/.exec(body);
  if (!opening) {
    const unclosed = body === FENCE_LINE || body === `${FENCE_LINE}\r`;
    return unclosed ? { status: 'invalid', problem: fileProblem(path, 'Frontmatter is not closed by a --- line') }
      : { status: 'absent', problem: fileProblem(path, 'File has no frontmatter: the first line must be ---') };
  }
  let start = opening[0].length, close = -1;
  while (start <= body.length) {
    const end = body.indexOf('\n', start);
    const line = body.slice(start, end < 0 ? body.length : end);
    if (line === FENCE_LINE || line === `${FENCE_LINE}\r`) { close = start; break; }
    if (end < 0) break;
    start = end + 1;
  }
  if (close < 0) return { status: 'invalid', problem: fileProblem(path, 'Frontmatter is not closed by a --- line') };
  // The opening line becomes an empty line, so positions in the parsed text are positions in the file.
  const yamlText = '\n' + body.slice(opening[0].length, close);
  const counter = new LineCounter();
  const documents = parseAllDocuments(yamlText, { lineCounter: counter, prettyErrors: false, uniqueKeys: true, logLevel: 'silent' });
  const list = Array.isArray(documents) ? documents : [];
  const error = list.flatMap(document => document.errors)[0];
  // Only the parser's stable error code is shown: its message can quote the file.
  if (error) return { status: 'invalid', problem: fileProblem(path, `Frontmatter is not valid YAML (${error.code})`) };
  const document = list[0];
  if (list.length !== 1 || !document || !isMap(document.contents)) {
    return { status: 'invalid', problem: fileProblem(path, 'Frontmatter must be one YAML mapping') };
  }
  let value: Record<string, unknown>;
  try { value = document.toJS({ maxAliasCount: 100 }) as Record<string, unknown>; } catch {
    return { status: 'invalid', problem: fileProblem(path, 'Frontmatter cannot be expanded safely') };
  }
  return { status: 'read', frontmatter: { path, document: document as Document, counter, value } };
}

/** A problem at a field's value (or key), or at `1:1` when the field is absent. */
export function at(frontmatter: Frontmatter, path: FieldPath, message: string, severity: Problem['severity'] = 'error', key = false): Problem {
  const node = sourceNode(frontmatter, path, key);
  const offset = node?.range?.[0];
  const position = offset === undefined ? { line: 1, col: 1 } : frontmatter.counter.linePos(offset);
  return { path: frontmatter.path, line: position.line, column: position.col, severity, field: fieldName(path), message };
}

function codePoints(text: string): number {
  return Array.from(text).length;
}
function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Step 5: `name` and `description` must be non-empty strings; both are reported. */
export function checkNameAndDescription(frontmatter: Frontmatter): Problem[] {
  const problems: Problem[] = [];
  for (const field of ['name', 'description']) {
    if (!Object.hasOwn(frontmatter.value, field)) problems.push(at(frontmatter, [field], `${field} is required`));
    else {
      const value = frontmatter.value[field];
      if (typeof value !== 'string' || !value) problems.push(at(frontmatter, [field], `${field} must be a non-empty string`));
    }
  }
  return problems;
}

/** Warnings on the name's format: the specification's rules, applied after NFKC normalisation. */
function nameFormat(name: string): string[] {
  const normalised = name.normalize('NFKC');
  const messages: string[] = [];
  if (codePoints(normalised) > MAX_NAME_CODE_POINTS) messages.push(`name is longer than ${MAX_NAME_CODE_POINTS} characters`);
  if (/[\p{Lu}\p{Lt}]/u.test(normalised)) messages.push('name has an upper-case letter');
  if (!/^[\p{L}\p{N}-]*$/u.test(normalised)) messages.push('name may hold only letters, digits and hyphens');
  if (normalised.startsWith('-') || normalised.endsWith('-')) messages.push('name starts or ends with a hyphen');
  if (normalised.includes('--')) messages.push('name holds two hyphens in a row');
  return messages;
}

export interface SkillFields {
  problems: Problem[];
  kind: SkillKind;
}
/** Step 6 for a skill: specification checks, outside fields, metadata and relation keys; all reported. */
export function checkSkillFields(frontmatter: Frontmatter, folderName: string): SkillFields {
  const problems: Problem[] = [];
  const value = frontmatter.value;
  const name = value.name as string, description = value.description as string;
  for (const message of nameFormat(name)) problems.push(at(frontmatter, ['name'], message, 'warning'));
  // Compared without normalisation: the tool looks the folder up by its exact name.
  if (name !== folderName) problems.push(at(frontmatter, ['name'], `name differs from the folder name ${folderName}`, 'warning'));
  if (codePoints(description) > MAX_DESCRIPTION_CODE_POINTS) {
    problems.push(at(frontmatter, ['description'], `description is longer than ${MAX_DESCRIPTION_CODE_POINTS} characters`, 'warning'));
  }
  if (Object.hasOwn(value, 'compatibility')) {
    const compatibility = value.compatibility;
    if (typeof compatibility !== 'string' || codePoints(compatibility) < 1 || codePoints(compatibility) > MAX_COMPATIBILITY_CODE_POINTS) {
      problems.push(at(frontmatter, ['compatibility'], `compatibility must be a string of 1 to ${MAX_COMPATIBILITY_CODE_POINTS} characters`, 'warning'));
    }
  }
  for (const field of ['license', 'allowed-tools']) {
    if (Object.hasOwn(value, field) && typeof value[field] !== 'string') problems.push(at(frontmatter, [field], `${field} must be a string`, 'warning'));
  }
  const outside = Object.keys(value).filter(key => !SPECIFICATION_FIELDS.has(key)).sort(compareText);
  if (outside.length) {
    problems.push({ ...fileProblem(frontmatter.path, `Fields outside the Agent Skills specification: ${outside.join(', ')}`, 'warning') });
  }
  let kind: SkillKind = 'skill';
  if (Object.hasOwn(value, 'metadata')) {
    if (!isMapping(value.metadata)) problems.push(at(frontmatter, ['metadata'], 'metadata must be a mapping of strings', 'warning'));
    else kind = checkMetadata(frontmatter, problems);
  }
  return { problems, kind };
}

/** A problem at a node of the frontmatter (a key or value as written), or at `1:1` without one. */
function atNode(frontmatter: Frontmatter, node: Node | null | undefined, path: FieldPath, message: string, severity: Problem['severity'] = 'error'): Problem {
  const offset = node?.range?.[0];
  const position = offset === undefined ? { line: 1, col: 1 } : frontmatter.counter.linePos(offset);
  return { path: frontmatter.path, line: position.line, column: position.col, severity, field: fieldName(path), message };
}

/** Metadata keys and values; returns the kind (`skill` when absent or invalid). Positions are those of
 * the key or value as written (an alias where one is used); types are those of the resolved node. */
function checkMetadata(frontmatter: Frontmatter, problems: Problem[]): SkillKind {
  let kind: SkillKind = 'skill';
  const mapping = resolveNode(frontmatter, sourceNode(frontmatter, ['metadata']));
  if (!isMap(mapping)) return kind;
  const values = frontmatter.value.metadata as Record<string, unknown>;
  for (const pair of mapping.items) {
    const keyNode = pair.key as Node | null, valueNode = pair.value as Node | null;
    const key = resolveNode(frontmatter, keyNode);
    if (!isScalar(key) || typeof key.value !== 'string') {
      // The field is written from the key's text, so `42:` is `metadata.42`.
      const text = isScalar(key) ? (key.source ?? String(key.value)) : String(key);
      problems.push(atNode(frontmatter, keyNode, ['metadata', text], 'metadata key must be a string', 'warning'));
      continue;
    }
    const name = key.value;
    const path: FieldPath = ['metadata', name];
    const value = values[name];
    if (name.toLowerCase().startsWith(RELATION_PREFIX)) {
      if (!RELATION_KEYS.has(name)) {
        problems.push(atNode(frontmatter, keyNode, path, `Unknown key; expected ${KIND_KEY}, ${SKILLS_KEY} or ${AGENTS_KEY}`));
      } else if (typeof value !== 'string') {
        problems.push(atNode(frontmatter, valueNode, path, name === KIND_KEY ? `${KIND_KEY} must be skill or playbook`
          : `${name} must be a string of names separated by spaces`));
      } else if (name === KIND_KEY) {
        if (KINDS.includes(value)) kind = value as SkillKind;
        else problems.push(atNode(frontmatter, valueNode, path, `${KIND_KEY} must be skill or playbook`));
      }
      continue;
    }
    if (typeof value !== 'string') problems.push(atNode(frontmatter, valueNode, path, 'metadata values must be strings', 'warning'));
  }
  return kind;
}

/** Step 6 for an agent: `skills`, when present, must be a list of strings; returns the preloads read. */
export function checkAgentFields(frontmatter: Frontmatter): { problems: Problem[]; preloads: string[] } {
  if (!Object.hasOwn(frontmatter.value, 'skills')) return { problems: [], preloads: [] };
  const skills = frontmatter.value.skills;
  if (!Array.isArray(skills) || !skills.every(item => typeof item === 'string')) {
    return { problems: [at(frontmatter, ['skills'], 'skills must be a list of skill names', 'warning')], preloads: [] };
  }
  return { problems: [], preloads: skills as string[] };
}

/** Names of a relation value: separated by any whitespace; a blank string declares none. */
export function relationNames(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}
