/** SiteData per view (catalogue-site task 1.2): staff data carries no hidden value and ignores the date.
 * Run npm test. Synthetic catalogues through the real validator; values are distinctive so a leak shows.
 */
import { test, expect } from 'vitest';
import { buildSiteData } from '../../src/site/data.js';
import { check, component, licence, line, set, settings } from './helpers.js';

const hiddenValues = { cycle: 'one-off', cost: 98765, currency: 'QZX', renewsOn: '2031-07-19', seats: 97531, paidBy: 'PAYER-OMEGA', vaultItem: 'VAULT-SIGMA', note: 'ZETA-NOTE' };

function catalogue(values: Record<string, unknown>, extra: unknown[] = []) {
  let editorLicence: unknown = licence('licence-editor');
  for (const [field, value] of Object.entries(values)) editorLicence = set(editorLicence, `spec.licence.${field}`, value);
  const editor = set(set(component('editor'), 'metadata.title', 'Northwind Editor'), 'spec.dependsOn', ['resource:licence-editor', 'component:forge']);
  return check(editor, component('forge'), editorLicence, set(line('ship'), 'spec.stops', ['component:editor', 'component:forge']), ...extra);
}

test('Staff data carries no hidden value', () => {
  const data = buildSiteData(catalogue(hiddenValues), 'staff', '0.1.0').data;
  const text = JSON.stringify(data);
  for (const value of Object.values(hiddenValues)) expect(text, String(value)).not.toContain(String(value));
  // The data is really there: the visible licence fields and the component page.
  const page = data.licences.find(item => item.ref === 'resource:licence-editor')!;
  expect(page.fields.map(field => field.label)).toEqual(['Vendor', 'Status']);
  expect(data.components.map(item => item.slug)).toEqual(['editor', 'forge']);
  expect(data.view).toBe('staff');
});

test('Staff data ignores the date and hidden values', () => {
  const other = { cycle: 'yearly', cost: 12, currency: 'EUR', renewsOn: '2027-06-10', seats: 2, paidBy: 'PAYER-B', vaultItem: 'VAULT-B', note: 'NOTE-B' };
  const first = buildSiteData(catalogue(hiddenValues), 'staff', '0.1.0', '2027-06-01');
  const second = buildSiteData(catalogue(other), 'staff', '0.1.0', '2031-07-01');
  expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
  // Even an impossible date is never read for staff.
  expect(JSON.stringify(buildSiteData(catalogue(other), 'staff', '0.1.0', 'not a date').data)).toBe(JSON.stringify(first.data));
});

test('Full data shows every licence field and needs a real date', () => {
  const data = buildSiteData(catalogue(hiddenValues), 'full', '0.1.0', '2027-06-01').data;
  const page = data.licences.find(item => item.ref === 'resource:licence-editor')!;
  expect(page.fields.map(field => field.value)).toContain('98765');
  expect(() => buildSiteData(catalogue(hiddenValues), 'full', '0.1.0')).toThrow(/date/);
});

test('Site settings and their fallback', () => {
  const custom = settings('settings', { site: { title: 'Northwind software', colors: { accent: '#E4002B' } } });
  const data = buildSiteData(catalogue(hiddenValues, [custom]), 'staff', '0.1.0').data;
  expect(data.title).toBe('Northwind software');
  expect(data.colors).toEqual({ accent: '#E4002B' });
  const broken = settings('settings', { site: { title: 'Northwind software', colors: { accent: 'red' } } });
  const fallback = buildSiteData(catalogue(hiddenValues, [broken]), 'staff', '0.1.0').data;
  expect(fallback.title).toBe('Software map');
  expect(fallback.colors).toEqual({});
  // Broken settings: the staff view hides every licence field.
  expect(fallback.licences[0]!.fields).toEqual([]);
});
