/** Build time with a skill set (build-command, Build time with skills): the generated catalogue of 300
 * items and 20 lines (test/large-catalogue.ts) with a generated skill set of 200 skills, 20 playbooks,
 * 10 agents, 2,000 rules and 10 skill lines, both sites within 150 seconds. Run npm run test:perf after
 * npm run build; one worker, nothing else running. Fictitious data in a temporary folder.
 */
import { afterAll, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cli } from '../integration/helpers.js';
import { largeCatalogue } from '../large-catalogue.js';

const base = mkdtempSync(join(tmpdir(), 'stackledger-perf-skills-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));
const write = (root: string, files: Record<string, string>) => {
  for (const [file, text] of Object.entries(files)) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); }
  return root;
};

/** 200 skills with 10 rules each, 20 playbooks loading 10 skills and using an agent, 10 agents, 10 lines. */
function largeSkillSet(): Record<string, string> {
  const files: Record<string, string> = {};
  const skills = Array.from({ length: 200 }, (_, i) => `skill-${String(i).padStart(3, '0')}`);
  const playbooks = Array.from({ length: 20 }, (_, i) => `playbook-${String(i).padStart(2, '0')}`);
  const agents = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
  skills.forEach((name, i) => {
    files[`skills/${name}/SKILL.md`] = `---\nname: ${name}\ndescription: Northwind skill ${i}.\n---\n`;
    files[`skills/${name}/rules.md`] = `# Rules\n\n## Group (G${i})\n\n${Array.from({ length: 10 }, (_, r) => `- **S${i}-${r}** Rule ${r} of ${name}.`).join('\n')}\n`;
  });
  playbooks.forEach((name, i) => {
    files[`playbooks/${name}/SKILL.md`] = `---\nname: ${name}\ndescription: Northwind playbook ${i}.\nmetadata:\n  stackledger-kind: playbook\n  stackledger-skills: ${skills.slice(i * 10, i * 10 + 10).join(' ')}\n  stackledger-agents: ${agents[i % 10]}\n---\n`;
  });
  agents.forEach((name, i) => { files[`agents/${name}.md`] = `---\nname: ${name}\ndescription: Northwind agent ${i}.\nskills:\n  - ${skills[i]}\n---\n`; });
  const lines = Array.from({ length: 10 }, (_, i) => `apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: line-${i}\nspec:\n  code: "L${i}"\n  color: "#3366${String(10 + i * 8).padStart(2, '0')}"\n  stops: [${[`playbook:${playbooks[i * 2]}`, ...skills.slice(i * 10, i * 10 + 8).map(name => `skill:${name}`), `agent:${agents[i]}`].map(ref => JSON.stringify(ref)).join(', ')}]\n`);
  files['stackledger-skills.yaml'] = lines.join('---\n');
  return files;
}

test('Large catalogue and skill set', async () => {
  const catalogue = write(join(base, 'catalogue'), largeCatalogue());
  const kit = write(join(base, 'kit'), largeSkillSet());
  const out = join(base, 'out');
  const start = performance.now();
  const result = await new Promise<{ status: number; stderr: string }>(resolve => execFile(process.execPath,
    [cli, 'build', catalogue, '--out', out, '--date', '2027-06-01', '--skills', kit], { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
    (error, _stdout, stderr) => resolve({ status: error ? 1 : 0, stderr })));
  const ms = performance.now() - start;
  console.info(`build-command: 300 items, 20 lines, 230 skill items, 2,000 rules, 10 skill lines: ${(ms / 1000).toFixed(1)} s`);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain('Skills: 200 skills, 20 playbooks, 10 agents, 2000 rules');
  expect(readdirSync(join(out, 'full', 'skills')).length).toBe(201);
  expect(ms).toBeLessThan(150_000);
}, 300_000);
