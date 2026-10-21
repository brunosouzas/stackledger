/** Discovery annotations on components (catalogue spec, mac-discovery change). Run npm test.
 * The validate stage reads `stackledger/<source>` annotations of served components and warns about
 * unknown keys, empty identifiers and identifiers claimed by two components. Fictitious Northwind data.
 */
import { test, expect } from 'vitest';
import { component, check, set } from './helpers.js';
import { identifiers, sameIdentifier } from '../../src/discovery/annotations.js';

const annotated = (name: string, annotations: Record<string, string>) => set(component(name), 'metadata.annotations', annotations);

test('Valid discovery annotations', () => {
  const result = check(annotated('editor', { 'stackledger/brew': 'git, gh', 'stackledger/app': 'com.northwind.editor' }));
  expect(result.problems).toEqual([]);
  expect(identifiers('git, gh')).toEqual({ ids: ['git', 'gh'], empty: false });
});

test('Unknown discovery source', () => {
  const result = check(annotated('editor', { 'stackledger/brews': 'git' }));
  expect(result.problems).toHaveLength(1);
  expect(result.problems[0]).toMatchObject({ severity: 'warning', field: 'metadata.annotations["stackledger/brews"]' });
  for (const key of ['brew', 'cask', 'mas', 'app', 'launchd', 'mise', 'npm', 'pipx']) expect(result.problems[0]!.message).toContain(`stackledger/${key}`);
});

test('Empty identifier', () => {
  const result = check(annotated('editor', { 'stackledger/brew': 'git,,gh' }));
  expect(result.problems).toMatchObject([{ severity: 'warning', field: 'metadata.annotations["stackledger/brew"]' }]);
  expect(identifiers('git,,gh')).toEqual({ ids: ['git', 'gh'], empty: true });
});

test('Other annotations untouched', () => {
  const result = check(annotated('editor', { 'backstage.io/source-location': 'url:https://example.com/editor' }));
  expect(result.problems).toEqual([]);
});

test('Identifier claimed twice', () => {
  const result = check(annotated('editor', { 'stackledger/cask': 'northwind-editor' }), annotated('editor-beta', { 'stackledger/cask': 'northwind-editor' }));
  expect(result.problems).toHaveLength(1);
  expect(result.problems[0]).toMatchObject({ path: '001.yaml', severity: 'warning', field: 'metadata.annotations["stackledger/cask"]' });
  expect(result.problems[0]!.message).toContain('component:editor');
  // Compared as drift compares them: app ignores ASCII case, pipx folds separators.
  expect(sameIdentifier('app', 'COM.Northwind.Editor', 'com.northwind.editor')).toBe(true);
  expect(sameIdentifier('pipx', 'Northwind_Docs', 'northwind-docs')).toBe(true);
  expect(sameIdentifier('brew', 'Forge', 'forge')).toBe(false);
});

test('Same identifier for two sources', () => {
  const result = check(annotated('forge', { 'stackledger/brew': 'forge' }), annotated('forge-cli', { 'stackledger/npm': 'forge' }));
  expect(result.problems).toEqual([]);
});
