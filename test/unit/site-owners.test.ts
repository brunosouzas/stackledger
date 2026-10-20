/** Owners by name on the site (catalogue-site polish): Group and User documents give display names.
 * Run npm test. Synthetic documents only.
 */
import { test, expect } from 'vitest';
import { stringify } from 'yaml';
import { parseSource } from '../../src/source.js';
import { displayOwner, ownerNames } from '../../src/site/owners.js';
import { buildSiteData } from '../../src/site/data.js';
import { check, component, licence, set } from './helpers.js';

const group = (name: string, extra: Record<string, unknown> = {}) => ({ apiVersion: 'backstage.io/v1alpha1', kind: 'Group', metadata: { name, ...extra }, spec: { type: 'team' } });
const sources = (...documents: unknown[]) => documents.flatMap((document, i) => parseSource(`${i}.yaml`, stringify(document)).sources);

test('A Group title replaces the reference', () => {
  const names = ownerNames(sources(group('northwind', { title: 'Northwind team' })));
  expect(displayOwner(names, 'group:northwind')).toBe('Northwind team');
  expect(displayOwner(names, 'Group:Northwind')).toBe('Northwind team');
  expect(displayOwner(names, 'user:alex')).toBe('user:alex');
});

test('Display name, then name, for Users and untitled Groups', () => {
  const user = { apiVersion: 'backstage.io/v1alpha1', kind: 'User', metadata: { name: 'alex' }, spec: { profile: { displayName: 'Alex Doe' } } };
  const names = ownerNames(sources(user, group('ops')));
  expect(displayOwner(names, 'user:alex')).toBe('Alex Doe');
  expect(displayOwner(names, 'group:ops')).toBe('ops');
});

test('Unchecked or conflicting owner documents are not used', () => {
  const names = ownerNames(sources(
    { ...group('legacy', { title: 'Legacy' }), apiVersion: 'example.com/v1' },
    group('bad name!', { title: 'Bad' }),
    group('vault', { title: 'Vault', annotations: { token: 'ghp_' + 'a'.repeat(36) } }),
    group('twice', { title: 'One' }),
    group('twice', { title: 'Two' }),
  ));
  for (const ref of ['group:legacy', 'group:bad name!', 'group:vault', 'group:twice']) expect(displayOwner(names, ref)).toBe(ref);
});

test('Pages and the software list show owners by name', () => {
  const catalogue = check(set(component('editor'), 'spec.owner', 'group:northwind'), set(licence('licence-editor'), 'spec.owner', 'group:northwind'), component('forge'));
  const owners = new Map([['group:northwind', 'Northwind team']]);
  for (const view of ['full', 'staff'] as const) {
    const data = buildSiteData(catalogue, view, '0.1.0', '2027-06-01', owners).data;
    expect(data.components.find(page => page.slug === 'editor')!.owner).toBe('Northwind team');
    expect(data.components.find(page => page.slug === 'forge')!.owner).toBe('user:alex');
    expect(data.licences[0]!.owner).toBe('Northwind team');
    expect(data.rows.map(row => row.owner)).toEqual(['Northwind team', 'user:alex', 'Northwind team']);
    expect(data.filters.owner).toEqual(['Northwind team', 'user:alex']);
  }
});
