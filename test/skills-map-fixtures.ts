/** Fictitious Northwind skill sets whose diagrams are both unit-tested (test/unit/skills-map.test.ts)
 * and rendered by Mermaid in Chromium (test/browser/skills-map.spec.ts), keyed by the spec scenario
 * that owns them (skills-mermaid task 2.2). Plain data and string builders only: this module must not
 * import vitest, because the Playwright runner loads it too. Never real skills.
 *
 * Each fixture maps a path below the set's folder to the text of the file there.
 */

/** A SKILL.md with a name, a description and optional `metadata` entries (written in order). */
export function skillText(name: string, metadata: Record<string, string> = {}, description = `Helps the Northwind team with ${name}.`): string {
  const entries = Object.entries(metadata);
  const block = entries.length ? `metadata:\n${entries.map(([key, value]) => `  ${key}: ${value}\n`).join('')}` : '';
  return `---\nname: ${name}\ndescription: ${description}\n${block}---\n\n# ${name}\n\nNorthwind notes.\n`;
}
/** A playbook loading the given skills (space-separated). */
export function playbookText(name: string, skills: string): string {
  return skillText(name, { 'stackledger-kind': 'playbook', 'stackledger-skills': skills });
}

/** 20 playbooks that each load the same 20 skills: exactly 400 relations, the diagram budget. */
function edgeBudget(): Record<string, string> {
  const numbers = Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0'));
  const files: Record<string, string> = {};
  for (const number of numbers) files[`skills/s${number}/SKILL.md`] = skillText(`s${number}`);
  for (const number of numbers) files[`skills/p${number}/SKILL.md`] = playbookText(`p${number}`, numbers.map(other => `s${other}`).join(' '));
  return files;
}

/** A skill name that tries to close its Mermaid node and start a `click` line. */
export const HOSTILE_NAME = 'a"]; click n1 "https://example.com';

export const MERMAID_FIXTURES: Record<string, Record<string, string>> = {
  'Node names are not IDs': {
    'skills/end/SKILL.md': skillText('end'),
    'skills/release/SKILL.md': playbookText('release', 'end'),
  },
  'Label that tries to close the node': {
    // Single-quoted YAML keeps the double quotes and brackets as they are.
    'skills/hostile/SKILL.md': skillText(`'${HOSTILE_NAME}'`),
    // Relation values split on spaces, so only an agent's `skills` list can name it: the index draws it too.
    'agents/drafter.md': `---\nname: drafter\ndescription: Northwind drafter agent.\nskills:\n  - '${HOSTILE_NAME}'\n---\n\nYou are the Northwind drafter.\n`,
  },
  'Diagram of a skill': {
    'skills/writer/SKILL.md': skillText('writer'),
    'skills/release/SKILL.md': playbookText('release', 'writer'),
  },
  'Two playbooks that load each other': {
    'skills/a/SKILL.md': playbookText('a', 'b'),
    'skills/b/SKILL.md': playbookText('b', 'a'),
  },
  'Skill that lists itself': {
    'skills/writer/SKILL.md': skillText('writer', { 'stackledger-skills': 'writer' }),
  },
  'Index at the edge budget': edgeBudget(),
};
