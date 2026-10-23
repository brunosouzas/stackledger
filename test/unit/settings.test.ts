/** Settings kind scenarios of the catalogue spec: schema, hide list and one settings document. Run npm test. */
import { test, expect } from 'vitest';
import { component, settings, check, checkFiles, errors, set } from './helpers.js';
import { resolveSites } from '../../src/views.js';
const hiding = (hide: unknown, name = 'settings') => settings(name, { views: { staff: { hide } } });
test('Settings is a supported kind', () => { expect(check(settings()).problems).toEqual([]); });
test('Unsupported pair', () => { const result = errors(set(settings(), 'apiVersion', 'backstage.io/v1alpha1')); expect(result).toMatchObject([{ field: 'apiVersion' }]); expect(result[0].message).toContain('stackledger/v1alpha1 Settings'); });
test('Kind in the wrong case', () => { const result = errors(set(component(), 'kind', 'component')); expect(result).toHaveLength(1); for (const kind of ['Component', 'Resource', 'Line', 'MapLayout', 'Settings']) expect(result[0].message).toContain(kind); });
test('Typo in settings', () => { expect(errors(settings('settings', { view: { staff: { hide: ['vendor'] } } }))).toMatchObject([{ field: 'spec.view', message: 'Unlisted field' }]); });
test('Settings needs a spec and accepts only its metadata', () => {
 expect(errors(set(settings(), 'spec', undefined))).toMatchObject([{ field: 'spec' }]);
 expect(check(set(set(settings(), 'metadata.title', 'Northwind Studio'), 'metadata.namespace', 'default')).problems).toEqual([]);
 expect(errors(set(settings(), 'metadata.labels', { a: 'b' }))).toMatchObject([{ field: 'metadata.labels' }]);
});
test('Staff hide list', () => { expect(check(hiding(['cost', 'renewsOn'])).problems).toEqual([]); });
test('Unknown field name in the hide list', () => {
 const result = errors(hiding(['price'])); expect(result).toMatchObject([{ field: 'spec.views.staff.hide[0]' }]);
 for (const field of ['vendor', 'status', 'cycle', 'cost', 'currency', 'renewsOn', 'seats', 'paidBy', 'vaultItem', 'note']) expect(result[0].message).toContain(field);
});
test('Repeated field name', () => { expect(errors(hiding(['cost', 'cost']))).toMatchObject([{ field: 'spec.views.staff.hide[1]' }]); expect(errors(hiding(['cost', 'cost']))).toHaveLength(1); });
test('Second settings document', () => {
 const result = checkFiles({ 'a.yaml': [settings('settings')], 'b.yaml': [hiding(['vendor'], 'company')] });
 expect(result.problems).toHaveLength(1); expect(result.problems[0]).toMatchObject({ path: 'b.yaml', severity: 'error' }); expect(result.problems[0]!.message).toContain('a.yaml');
 expect(result.served.settings.map(s => s.metadata.name)[0]).toBe('settings');
});
test('Two settings with the same name', () => {
 const result = checkFiles({ 'a.yaml': [settings('settings')], 'b.yaml': [settings('settings')] });
 expect(result.problems).toHaveLength(1); expect(result.problems[0]).toMatchObject({ path: 'b.yaml', field: 'metadata.name' }); expect(result.problems[0]!.message).toContain('Duplicate name');
});
const site = (value: unknown) => settings('settings', { site: value });
test('Title and accent', () => { expect(check(site({ title: 'Northwind software', colors: { accent: '#e4002b' } })).problems).toEqual([]); });
test('Title too long', () => { expect(errors(site({ title: 'N'.repeat(61) }))).toMatchObject([{ field: 'spec.site.title' }]); expect(check(site({ title: 'N'.repeat(60) })).problems).toEqual([]); });
test('Colour name', () => { expect(errors(site({ colors: { primary: 'red' } }))).toMatchObject([{ field: 'spec.site.colors.primary' }]); });
// catalogue, Home settings.
const link = (fields: Record<string, unknown>) => ({ title: 'Articles', url: 'https://example.org/articles/', ...fields });
test('Home text and links', () => {
  expect(check(site({ home: { text: 'Northwind tools', links: [link({ description: 'What we write' })] } })).problems).toEqual([]);
  expect(errors(site({ home: { text: 'N'.repeat(201) } }))).toMatchObject([{ field: 'spec.site.home.text' }]);
  expect(errors(site({ home: { links: [] } }))).toMatchObject([{ field: 'spec.site.home.links' }]);
});
test('Script URL', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org/', '//example.org/', '/articles/']) {
    expect(errors(site({ home: { links: [link({ url })] } })), url).toMatchObject([{ field: 'spec.site.home.links[0].url' }]);
  }
  expect(check(site({ home: { links: [link({ url: 'HTTPS://Example.org/' }), link({ url: 'http://wiki.example.org/' })] } })).problems).toEqual([]);
});
test('Bad link', () => {
  const result = errors(site({ home: { links: [{ title: 'No URL' }, link({ url: 'https://user:secret@example.org/' }), link({ url: 'https://' }), link({ target: '_blank' }), link({ url: 'https://example.org/a b' }),
    link({ url: 'https://x.example/"><script>alert(1)</script>' }), link({ url: 'https://x.example/a>b' }), link({ url: "https://x.example/a'b" })] } }));
  expect(result.map(problem => problem.field)).toEqual(['spec.site.home.links[0].url', 'spec.site.home.links[1].url', 'spec.site.home.links[2].url', 'spec.site.home.links[3].target', 'spec.site.home.links[4].url',
    'spec.site.home.links[5].url', 'spec.site.home.links[6].url', 'spec.site.home.links[7].url']);
});
test('Too many links', () => {
  expect(errors(site({ home: { links: Array.from({ length: 21 }, () => link({})) } }))).toMatchObject([{ field: 'spec.site.home.links' }]);
  expect(check(site({ home: { links: Array.from({ length: 20 }, () => link({})) } })).problems).toEqual([]);
});
test('Unknown home field', () => {
  expect(errors(site({ home: { image: 'banner.png' } }))).toMatchObject([{ field: 'spec.site.home.image', message: 'Unlisted field' }]);
});
test('Logo not supported', () => {
 expect(errors(site({ logo: 'logo.png' }))).toMatchObject([{ field: 'spec.site.logo', message: 'Unlisted field' }]);
 expect(errors(site({ colors: { border: '#FFFFFF' } }))).toMatchObject([{ field: 'spec.site.colors.border', message: 'Unlisted field' }]);
 expect(check(site({ colors: { primary: '#121212', accent: '#E4002B', body: '#FFFFFF', text: '#444444' } })).problems).toEqual([]);
});
const sites = (value: unknown) => settings('settings', { sites: value });
const settingsText = (sitesText: string) => `apiVersion: stackledger/v1alpha1\nkind: Settings\nmetadata:\n  name: settings\nspec:\n${sitesText}`;
test('Personal mode', () => {
 const result = check(sites(['full']));
 expect(result.problems).toEqual([]);
 expect(resolveSites(result)).toEqual(['full']);
});
test('Corporate mode in any order', () => {
 for (const value of [['full', 'staff'], ['staff', 'full']]) {
  const result = check(sites(value));
  expect(result.problems).toEqual([]);
  expect(resolveSites(result)).toEqual(['full', 'staff']);
 }
});
test('Corporate mode by default', () => {
 expect(resolveSites(check(settings()))).toEqual(['full', 'staff']);
 expect(resolveSites(check(component()))).toEqual(['full', 'staff']);
});
test('Staff site alone', () => {
 const result = checkFiles({ 'stackledger.yaml': [settingsText('  sites: [staff]\n')] });
 expect(result.problems).toMatchObject([{ path: 'stackledger.yaml', line: 6, field: 'spec.sites', severity: 'error' }]);
 expect(result.problems[0]!.message).toContain('full');
 expect(errors(sites([]))).toMatchObject([{ field: 'spec.sites' }]);
});
test('Unknown site', () => {
 const result = checkFiles({ 'stackledger.yaml': [settingsText('  sites:\n    - full\n    - finance\n')] });
 expect(result.problems).toMatchObject([{ path: 'stackledger.yaml', line: 8, field: 'spec.sites[1]', severity: 'error' }]);
 expect(result.problems[0]!.message).toBe('Allowed values: full, staff');
 expect(errors(sites('full'))).toMatchObject([{ field: 'spec.sites' }]);
});
test('Repeated site', () => {
 const result = errors(sites(['full', 'full']));
 expect(result).toMatchObject([{ field: 'spec.sites[1]' }]);
 expect(result).toHaveLength(1);
});
test('Broken settings build both sites', () => {
 // A Settings document in error is not used, so the default applies: both sites (staff hides every licence field).
 expect(resolveSites(check(sites(['staff'])))).toEqual(['full', 'staff']);
 expect(resolveSites(check(settings('settings', { sites: ['full'], site: { logo: 'logo.png' } })))).toEqual(['full', 'staff']);
});
// catalogue spec, Skills settings.
const skills = (value: unknown) => settings('settings', { skills: value });
test('Two skills folders', () => { expect(check(skills({ folders: ['../kit', '../openspec'] })).problems).toEqual([]); });
test('Absolute path', () => { const result = errors(skills({ folders: ['/home/northwind/kit'] })); expect(result).toMatchObject([{ field: 'spec.skills.folders[0]' }]); expect(result[0]!.message).toContain('relative to the catalogue folder'); });
test('Home folder shortcut', () => { expect(errors(skills({ folders: ['~/kit'] }))).toMatchObject([{ field: 'spec.skills.folders[0]' }]); expect(errors(skills({ folders: ['\\\\server\\kit'] }))).toMatchObject([{ field: 'spec.skills.folders[0]' }]); });
test('Drive letter', () => { expect(errors(skills({ folders: ['C:kit'] }))).toMatchObject([{ field: 'spec.skills.folders[0]' }]); expect(check(skills({ folders: ['kit:v2'] })).problems).toEqual([]); });
test('Empty list', () => { expect(errors(skills({ folders: [] }))).toMatchObject([{ field: 'spec.skills.folders' }]); expect(errors(skills({ folders: [''] }))).toMatchObject([{ field: 'spec.skills.folders[0]' }]); });
test('Too many folders', () => { expect(errors(skills({ folders: Array.from({ length: 21 }, (_, i) => `f${i}`) }))).toMatchObject([{ field: 'spec.skills.folders' }]); expect(check(skills({ folders: Array.from({ length: 20 }, (_, i) => `f${i}`) })).problems).toEqual([]); });
test('Repeated folder', () => { expect(errors(skills({ folders: ['../kit', '../kit'] }))).toMatchObject([{ field: 'spec.skills.folders[1]' }]); expect(errors(skills({ folders: ['../kit', '../kit'] }))).toHaveLength(1); });
test('Unknown skills field', () => { expect(errors(skills({ folder: ['../kit'] }))).toMatchObject([{ field: 'spec.skills.folder', message: 'Unlisted field' }]); });
