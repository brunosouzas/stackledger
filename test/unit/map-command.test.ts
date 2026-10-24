/** map-command \"Command\" and \"Usage errors\" with --backdrop, and catalogue \"Option wins over invalid
 * settings\", against the built CLI. The kept scenarios (Default options, Read-only, Unknown theme, Impossible
 * date) are in test/integration/map.test.ts. Run npm run build && npm test; fictitious catalogues only. */
import { expect, test } from 'vitest';
import { join } from 'node:path';
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
