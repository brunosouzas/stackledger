/** Rules files: rule lines, why and check, groups, code fences and rule IDs (skill-source spec).
 * Run npm test. Fixtures are fictitious Northwind rules in temporary folders.
 */
import { test, expect } from 'vitest';
import { readSkillSet } from '../../src/skills/source.js';
import { rules, skill, skillSet } from '../skills-helpers.js';

/** The set of one skill `writer` with the given rules.md. */
const withRules = (text: string) => readSkillSet([], { cwd: skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/rules.md': text }) });

test('Rule with why and check', async () => {
  const set = await withRules('# Rules\n\n## Flows (FLOW)\n\n- **FLOW-1** Keep flows thin.\n  Why: logic hides.\n  Check: one reference.\n');
  expect(set.problems).toEqual([]);
  expect(set.skills[0]!.rules).toEqual([{ id: 'FLOW-1', text: 'Keep flows thin.', why: 'logic hides.', check: 'one reference.', group: 'Flows (FLOW)', line: 5 }]);
  expect(set.summary.rules).toBe(1);
});

test('Indented item', async () => {
  const set = await withRules(rules('- **FLOW-1** top', '  - **FLOW-2** nested'));
  expect(set.skills[0]!.rules.map(rule => rule.id)).toEqual(['FLOW-1']);
});

test('Example inside a code fence', async () => {
  const set = await withRules(rules('- **DOC-1** Real.', '~~~', '- **LOG-1** example', '~~~', '- **DOC-2** After.'));
  expect(set.skills[0]!.rules.map(rule => rule.id)).toEqual(['DOC-1', 'DOC-2']);
});

test('Fence never closed', async () => {
  const set = await withRules(rules('- **DOC-1** Before.', '```yaml', '- **DOC-2** inside', '~~~', '- **DOC-3** still inside'));
  expect(set.skills[0]!.rules.map(rule => rule.id)).toEqual(['DOC-1']);
  expect(set.problems).toEqual([]);
});

test('Duplicate in one file', async () => {
  const set = await withRules(rules('- **DOC-1** First.', '- **DOC-1** Second.'));
  // rules() puts the first rule on line 5.
  expect(set.problems).toEqual([expect.objectContaining({ path: 'writer/rules.md', line: 6, column: 1, severity: 'error' })]);
  expect(set.skills[0]!.rules).toMatchObject([{ id: 'DOC-1', text: 'First.' }]);
});

test('Same ID in two skills', async () => {
  const set = await readSkillSet([], { cwd: skillSet({
    'developer/SKILL.md': skill('developer'), 'developer/rules.md': rules('- **DOC-1** Code docs.'),
    'documentation/SKILL.md': skill('documentation'), 'documentation/rules.md': rules('- **DOC-1** Project docs.'),
  }) });
  expect(set.problems).toEqual([expect.objectContaining({ path: 'documentation/rules.md', line: 5, column: 1, severity: 'warning' })]);
  expect(set.problems[0]!.message).toContain('developer');
  expect(set.summary).toMatchObject({ rules: 2, errors: 0 });
});
