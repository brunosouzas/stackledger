/** "Matcher failure" (skill-source spec, Ignore file limits) through the command: the matcher is replaced
 * in this file only, so the code under test has no test-only option. Run npm test. Fictitious Northwind
 * skill set only.
 */
import { test, expect, vi } from 'vitest';
import { skill, skillSet } from '../skills-helpers.js';

// A matcher whose own message repeats the pattern and the tested path, as a library error might.
vi.mock('../../src/skills/ignore.js', async original => ({
  ...(await original<typeof import('../../src/skills/ignore.js')>()),
  createMatcher: () => ({ ignores(path: string): boolean { throw new Error(`pattern templates/ failed on ${path}`); } }),
}));

const { skillsCommand } = await import('../../src/skills/command.js');
const { reportFailure } = await import('../../src/errors.js');

test('Matcher failure', async () => {
  const root = skillSet({ '.stackledgerignore': 'templates/\n', 'northwind/writer/SKILL.md': skill('writer') });
  const written = vi.spyOn(process.stdout, 'write');
  const failure = await skillsCommand(['skills', 'validate', root]).then(() => undefined, (error: unknown) => error);
  expect(written).not.toHaveBeenCalled();
  written.mockRestore();
  const { stderr, exitCode } = reportFailure(failure, 'USAGE TEXT');
  // An internal failure: exit 1, one line, no usage text, and neither the pattern nor any path.
  expect(exitCode).toBe(1);
  expect(stderr).toMatch(/^stackledger skills validate: internal error: [^\n]*\n$/);
  expect(stderr).not.toContain('USAGE TEXT');
  for (const text of ['templates', 'northwind', 'writer', root]) expect(stderr).not.toContain(text);
});
