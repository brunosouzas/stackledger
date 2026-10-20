/** Extract and execute every documented YAML example. Run npm run build && npm test.
 * Examples are standalone folders: accidental dangling references cannot be hidden by other blocks.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { root, run } from './helpers.js';
for (const path of ['docs/catalogue-format.md', 'README.md']) {
 const document = readFileSync(join(root, path), 'utf8');
 const section = path === 'README.md' ? document.split('## Catalogue format\n')[1]?.split(/^## /m)[0] : document;
 if (!section) throw new Error(`Missing catalogue section: ${path}`);
 const blocks = [...section.matchAll(/(?:(<!-- intentionally invalid -->)\s*)?```yaml\s*\n([\s\S]*?)```/g)];
 test(`${path} contains YAML examples for every kind`, () => {
  expect(blocks.length).toBeGreaterThan(0); for (const kind of ['Component', 'Resource', 'Line', 'MapLayout']) expect(blocks.map(b => b[2]).join('\n')).toContain(`kind: ${kind}\n`);
 });
 for (const [index, block] of blocks.entries()) test(`${path} YAML example ${index + 1}`, () => {
  const result = run(['validate', '--json', folder({ 'example.yaml': block[2]! })]);
  const output = JSON.parse(result.stdout); expect(result.stderr).toBe('');
  if (block[1]) { expect(result.status).toBe(1); expect(output.summary.errors).toBeGreaterThan(0); }
  else { expect(result.status).toBe(0); expect(output.summary.errors).toBe(0); }
 });
}
