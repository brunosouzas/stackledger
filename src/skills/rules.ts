/** Rules in a skill's `rules.md` (skill-source spec: Rules files, Code fences in rules files, Rule IDs).
 * Used by src/skills/source.ts; a pure function over the file's text, no I/O.
 *
 * A rule starts at column 1 with `- **ID** text`, ID like `FLOW-1`; indented `Why:` and `Check:` lines
 * before the next rule or heading are its why and check; the nearest earlier `## ` heading is its group.
 * Nothing inside a fenced code block (backticks or tildes, an unclosed block running to the end) is a
 * rule, so a rules file can show examples. An ID already defined in the same file is reported by line
 * and the later rule is dropped; IDs shared between skills are the caller's check.
 */
export interface Rule {
  id: string;
  text: string;
  why?: string;
  check?: string;
  group?: string;
  /** 1-based line of the rule in its file. */
  line: number;
}
export interface DuplicateRule { id: string; line: number; firstLine: number }
export interface ParsedRules { rules: Rule[]; duplicates: DuplicateRule[] }

const RULE_LINE = /^- \*\*([A-Z][A-Z0-9]*-[0-9]+)\*\* (.+)$/;
const DETAIL_LINE = /^[ \t]+(Why|Check):[ \t]*(.*)$/;
const HEADING_LINE = /^#{1,6}(?:[ \t]|$)/;
const GROUP_HEADING = /^## (.*)$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

export function parseRules(text: string): ParsedRules {
  const rules: Rule[] = [];
  const duplicates: DuplicateRule[] = [];
  const firstLines = new Map<string, number>();
  let group: string | undefined;
  /** The rule whose Why and Check lines may still follow; undefined after a heading or a dropped rule. */
  let current: Rule | undefined;
  let fence: { character: string; length: number } | undefined;
  const lines = text.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
  for (const [index, line] of lines.entries()) {
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.character === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
      if (closing.test(line)) fence = undefined;
      continue;
    }
    const opening = FENCE_OPEN.exec(line);
    if (opening) { fence = { character: opening[1]![0]!, length: opening[1]!.length }; continue; }
    if (HEADING_LINE.test(line)) {
      current = undefined;
      const heading = GROUP_HEADING.exec(line);
      if (heading) group = heading[1]!.trim();
      continue;
    }
    const rule = RULE_LINE.exec(line);
    if (rule) {
      const id = rule[1]!, lineNumber = index + 1;
      const first = firstLines.get(id);
      if (first !== undefined) { duplicates.push({ id, line: lineNumber, firstLine: first }); current = undefined; continue; }
      firstLines.set(id, lineNumber);
      current = { id, text: rule[2]!.trim(), line: lineNumber, ...(group === undefined ? {} : { group }) };
      rules.push(current);
      continue;
    }
    const detail = DETAIL_LINE.exec(line);
    if (detail && current) {
      const field = detail[1] === 'Why' ? 'why' : 'check';
      if (current[field] === undefined) current[field] = detail[2]!.trim();
    }
  }
  return { rules, duplicates };
}
