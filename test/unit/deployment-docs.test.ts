/** Deployment documentation stays aligned with delivered source, not an unpublished npm release.
 * Run npm test. No demo link is added until the owner-controlled demo checks pass.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('Deployment documentation: npm once released, template, hosting, release rule and roadmap', () => {
  const readme = read('README.md');
  for (const text of ['npx stackledger@0.1.0', 'examples/catalogue-repository/', 'docs/hosting.md', 'docs/release.md']) expect(readme).toContain(text);
  expect(readme).toMatch(/not published|not released|not yet released/i);
  const agents = read('AGENTS.md');
  expect(agents).toContain('`catalogue-deployment`');
  expect(agents).toMatch(/releases only via.*tag.*owner-approved environment/i);
  const roadmap = read('docs/roadmap.md');
  const row = roadmap.split('\n').find(line => line.startsWith('| 7 |'))!;
  expect(row).toContain('`catalogue-deployment`');
  expect(row).toContain('Delivered, 0.1.0 not yet released');
  expect(row).toContain('https://github.com/brunosouzas/stackledger/pull/9');
  expect(roadmap.split('## Later')[1]).toContain('Build from a Git URL');
  expect(read('docs/adr/0006-authentication-at-an-identity-aware-proxy.md')).toContain('`catalogue-deployment`');
});
