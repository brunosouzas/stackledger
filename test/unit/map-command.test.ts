/** map-command \"Command\" and \"Usage errors\" with --backdrop, and catalogue \"Option wins over invalid
 * settings\", against the built CLI. The kept scenarios (Default options, Read-only, Unknown theme, Impossible
 * date) are in test/integration/map.test.ts. Run npm run build && npm test; fictitious catalogues only. */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stringify } from 'yaml';
import { run, root } from '../integration/helpers.js';
import { folder } from '../helpers.js';
import { component, layout, line, settings } from './helpers.js';

const yaml = (...docs: unknown[]) => docs.map(doc => stringify(doc)).join('---\n');
const catalogue = (backdrop?: string) => folder({
  'catalogue.yaml': yaml(component('a'), component('b'), line(), layout()),
  ...(backdrop ? { 'stackledger.yaml': yaml(settings('settings', { map: { backdrop } })) } : {}),
});
const CREDIT = '© OpenStreetMap contributors';
const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dns', 'dgram'];
const IMPORT = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
/** Network modules imported, or fetch called, by a source file and every project module it imports, transitively. */
function networkUse(start: string): string[] {
  const seen = new Set<string>(), queue = [start], findings: string[] = [];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? match[4]!;
      if (NETWORK_MODULES.includes(specifier.replace(/^node:/, '').split('/')[0]!)) findings.push(`${relative(root, file)} imports ${specifier}`);
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
    }
    if (/\bfetch\s*\(/.test(text)) findings.push(`${relative(root, file)} calls fetch`);
  }
  // The walk reached the backdrop data and the renderer.
  expect([...seen].map(file => relative(root, file))).toEqual(expect.arrayContaining(['src/map/svg.ts', 'src/map/backdrops/london.ts']));
  return findings;
}
/** The london layer: a group of exactly two paths right after the background group, and the credit. */
const hasLondon = (svg: string) => /\n<g><rect [^>]*\/><\/g>\n<g><path [^>]*\/><path [^>]*\/><\/g>\n/.test(svg) && svg.includes(CREDIT);
const hasNoBackdrop = (svg: string) => /\n<g><rect [^>]*\/><\/g>\n<g><rect [^>]*fill="none"/.test(svg) && !svg.includes('OpenStreetMap');

test('Backdrop option overrides the settings', () => {
  const r = run(['map', catalogue('london'), '--backdrop', 'neutral', '--date', '2027-06-01']);
  expect(r.status).toBe(0); expect(r.stderr).toBe('');
  expect(hasNoBackdrop(r.stdout)).toBe(true);
});
test('Backdrop from the settings', () => {
  const r = run(['map', catalogue('london'), '--date', '2027-06-01']);
  expect(r.status).toBe(0); expect(r.stderr).toBe('');
  expect(hasLondon(r.stdout)).toBe(true);
});
test('London backdrop offline', () => {
  const f = catalogue();
  const flags = ['--permission', `--allow-fs-read=${join(root, 'dist')}`, `--allow-fs-read=${join(root, 'node_modules')}`, `--allow-fs-read=${f}`];
  const r = run(['map', f, '--backdrop', 'london', '--date', '2027-06-01'], root, flags);
  expect(r.status, r.stderr).toBe(0);
  expect(hasLondon(r.stdout)).toBe(true);
  expect(r.stdout).toBe(run(['map', f, '--backdrop', 'london', '--date', '2027-06-01']).stdout);
  // No network: Node 25 and later deny it under --permission without --allow-net; the probe proves the flags do.
  if (process.allowedNodeEnvironmentFlags.has('--allow-net')) {
    const probe = spawnSync(process.execPath, [...flags, '-e', "require('net').connect(9, '127.0.0.1').on('error', e => console.log(e.code))"], { encoding: 'utf8' });
    expect(probe.stdout.trim()).toBe('ERR_ACCESS_DENIED');
  }
  // Node 22 and 24 do not restrict the network there, so the command's modules are inspected too (as skills-offline does).
  expect(networkUse(join(root, 'src/map/command.ts'))).toEqual([]);
});
test('Unknown backdrop option', () => {
  const r = run(['map', catalogue(), '--backdrop', 'paris']);
  expect(r.status).toBe(2); expect(r.stdout).toBe('');
  expect(r.stderr).toContain('neutral'); expect(r.stderr).toContain('london'); expect(r.stderr).toContain('Usage:');
  expect(run(['map', catalogue(), '--backdrop']).status).toBe(2);
});
test('Option wins over invalid settings', () => {
  const r = run(['map', catalogue('paris'), '--backdrop', 'london', '--date', '2027-06-01']);
  expect(r.status).toBe(0); expect(r.stderr).toContain('1 error');
  expect(hasLondon(r.stdout)).toBe(true);
});
