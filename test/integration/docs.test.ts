/** Extract and execute every documented YAML example. Run npm run build && npm test.
 * Examples are standalone folders: accidental dangling references cannot be hidden by other blocks.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { parse } from 'yaml';
import { root, run } from './helpers.js';
for (const path of ['docs/catalogue-format.md', 'README.md']) {
 const document = readFileSync(join(root, path), 'utf8');
 const section = path === 'README.md' ? document.split('## Catalogue format\n')[1]?.split(/^## /m)[0] : document;
 if (!section) throw new Error(`Missing catalogue section: ${path}`);
 const blocks = [...section.matchAll(/(?:(<!-- intentionally invalid -->)\s*)?```yaml\s*\n([\s\S]*?)```/g)];
 test(`${path} contains YAML examples for every kind`, () => {
  // The README keeps a short example; the format reference shows every kind, Settings included.
  const kinds = ['Component', 'Resource', 'Line', 'MapLayout', ...(path === 'README.md' ? [] : ['Settings'])];
  expect(blocks.length).toBeGreaterThan(0); for (const kind of kinds) expect(blocks.map(b => b[2]).join('\n')).toContain(`kind: ${kind}\n`);
 });
 for (const [index, block] of blocks.entries()) test(`${path} YAML example ${index + 1}`, () => {
  const result = run(['validate', '--json', folder({ 'example.yaml': block[2]! })]);
  const output = JSON.parse(result.stdout); expect(result.stderr).toBe('');
  if (block[1]) { expect(result.status).toBe(1); expect(output.summary.errors).toBeGreaterThan(0); }
  else { expect(result.status).toBe(0); expect(output.summary.errors).toBe(0); }
 });
}
test('docs/mcp.md client examples parse and name every tool', () => {
 const document = readFileSync(join(root, 'docs/mcp.md'), 'utf8');
 const block = (language: string) => [...document.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))].map(m => m[1]!);
 const json = JSON.parse(block('json')[0]!), hermes = parse(block('yaml')[0]!), toml = block('toml')[0]!;
 for (const servers of [json.mcpServers, hermes.mcp_servers]) {
  expect(servers.stackledger).toEqual({ command: 'node', args: ['/path/to/stackledger/dist/cli.js', 'mcp', '/path/to/catalogue'] });
  expect(servers['stackledger-staff'].args.slice(-2)).toEqual(['--view', 'staff']);
 }
 expect(toml).toContain('[mcp_servers.stackledger]\ncommand = "node"\nargs = ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue"]');
 for (const tool of ['find_items', 'get_item', 'impact', 'gaps', 'renewals', 'validate']) expect(document).toContain(`| \`${tool}\``);
});
