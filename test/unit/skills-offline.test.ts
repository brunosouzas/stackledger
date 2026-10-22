/** Network not used (skill-source spec): Node 22's permission model does not restrict the network, so
 * the skill reading and the command are inspected instead: src/skills/*.ts and every project module
 * they import, transitively. Run npm test.
 */
import { test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dns', 'dgram'];
const IMPORT = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

test('Network not used', () => {
  const start = readdirSync(join(src, 'skills')).filter(name => name.endsWith('.ts')).map(name => join(src, 'skills', name));
  expect(start.map(file => relative(src, file)).sort()).toEqual(['skills/command.ts', 'skills/frontmatter.ts', 'skills/rules.ts', 'skills/source.ts', 'skills/walk.ts']);
  const seen = new Set<string>(), queue = [...start], findings: string[] = [];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? match[4]!;
      const bare = specifier.replace(/^node:/, '').split('/')[0]!;
      if (NETWORK_MODULES.includes(bare)) findings.push(`${relative(src, file)} imports ${specifier}`);
      // Follow the project's own modules (compiled .js names map to the .ts sources).
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
    }
    if (/\bfetch\s*\(/.test(text)) findings.push(`${relative(src, file)} calls fetch`);
  }
  expect(findings).toEqual([]);
  // The inspection really reached the reused catalogue modules.
  expect([...seen].map(file => relative(src, file))).toEqual(expect.arrayContaining(['source.ts', 'secrets.ts', 'validate.ts', 'control.ts', 'errors.ts']));
});
