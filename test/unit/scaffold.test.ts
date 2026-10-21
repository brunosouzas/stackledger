/** buildScaffold and its validation (drift-command spec: Scaffold content, Scaffold files pass
 * validation, Scaffold grouping and relations, Scaffold names, Scaffold write's YAML escaping). Run
 * npm test. One test per scenario, named after it; data is fictitious (test/drift-helpers.ts).
 */
import { test, expect } from 'vitest';
import { parse, parseAllDocuments } from 'yaml';
import { buildDrift } from '../../src/drift.js';
import { buildScaffold, checkScaffold, type ScaffoldFile } from '../../src/scaffold.js';
import type { Item } from '../../src/discovery/types.js';
import type { Component } from '../../src/schema.js';
import { app, brew, cask, comp, snapshotOf, TAKEN_AT } from '../drift-helpers.js';

function scaffold(items: Item[], components: Component[] = [], names = components.map(component => component.metadata.name)): ScaffoldFile[] {
  const snapshot = snapshotOf(items);
  return buildScaffold(buildDrift(snapshot, components), snapshot, names);
}
const documentOf = (file: ScaffoldFile) => parse(file.text) as Component;
const annotationsOf = (files: ScaffoldFile[]) => Object.fromEntries(files.map(file => [file.file, documentOf(file).metadata.annotations]));

test('Scaffold of a cask', () => {
  const files = scaffold([cask('northwind-editor', [], ['5.0.1'])]);
  expect(files.map(file => file.file)).toEqual(['northwind-editor.yaml']);
  expect(files[0]!.text).toBe(`# Draft written by stackledger drift --scaffold from a snapshot taken ${TAKEN_AT}.
# Review the owner, lifecycle, description and journeys, then move it into the catalogue.
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: northwind-editor
  title: northwind-editor
  annotations:
    stackledger/cask: northwind-editor
spec:
  type: tool
  lifecycle: active
  owner: unknown
`);
  expect(files[0]!.text).not.toContain('5.0.1');
  expect(files[0]!.text).not.toContain('username');
});

test('Title of control characters only', () => {
  const [file] = scaffold([app('com.northwind.blank', '/Applications/Northwind Blank.app', { title: '\u0007\u001b\u009b' })]);
  expect(documentOf(file!).metadata.title).toBe('com.northwind.blank');
  expect(documentOf(file!).metadata.name).toBe('com-northwind-blank');
  expect(file!.text).not.toContain('/Applications');
});

// The same title at command level (stderr and the folder) is a scenario test in test/integration/drift.test.ts.
test('Card number title fails the scaffold check', () => {
  const files = scaffold([app('com.northwind.pay', '/Applications/Northwind Pay.app', { title: '4111\t1111\t1111\t1111' }), cask('northwind-editor')]);
  expect(files).toHaveLength(2);
  const checked = checkScaffold(files);
  expect(checked.files.map(file => file.file)).toEqual(['northwind-editor.yaml']);
  expect(checked.leftOut).toBe(1);
});

test('Cask and its app in one file', () => {
  const files = scaffold([cask('northwind-editor', ['Northwind Editor.app']), app('com.northwind.editor', '/Applications/Northwind Editor.app', { title: 'Northwind Editor' })]);
  expect(annotationsOf(files)).toEqual({ 'northwind-editor.yaml': { 'stackledger/cask': 'northwind-editor', 'stackledger/app': 'com.northwind.editor' } });
  expect(documentOf(files[0]!).metadata.title).toBe('Northwind Editor');
  // Annotation keys in source order: cask before app.
  expect(files[0]!.text.indexOf('stackledger/cask')).toBeLessThan(files[0]!.text.indexOf('stackledger/app'));
});

test('One app in two places', () => {
  const files = scaffold([app('com.northwind.draw', '/Applications/Northwind Draw.app'), app('com.northwind.draw', '/Users/username/Applications/Northwind Draw.app')]);
  expect(annotationsOf(files)).toEqual({ 'northwind-draw.yaml': { 'stackledger/app': 'com.northwind.draw' } });
});

test('Two casks install one app', () => {
  const files = scaffold([cask('northwind-draw', ['Northwind Draw.app']), cask('northwind-draw-beta', ['Northwind Draw.app']), app('com.northwind.draw', '/Applications/Northwind Draw.app', { title: 'Northwind Draw' })]);
  expect(annotationsOf(files)).toEqual({
    'northwind-draw.yaml': { 'stackledger/cask': 'northwind-draw', 'stackledger/app': 'com.northwind.draw' },
    'northwind-draw-beta.yaml': { 'stackledger/cask': 'northwind-draw-beta' },
  });
});

test('Scaffold relation', () => {
  const files = scaffold([brew('forge', { dependsOn: ['libnorth', 'northwind-core'] }), brew('libnorth', { onRequest: false }), brew('northwind-core')],
    [comp('libnorth', { 'stackledger/brew': 'libnorth' })]);
  const forge = files.find(file => file.file === 'forge.yaml')!;
  // A catalogue component and another scaffold file, in reference order.
  expect(documentOf(forge).spec.dependsOn).toEqual(['component:libnorth', 'component:northwind-core']);
  expect(documentOf(files.find(file => file.file === 'northwind-core.yaml')!).spec.dependsOn).toBeUndefined();
});

test('Name already in the catalogue', () => {
  const files = scaffold([cask('northwind-editor'), cask('Northwind-Editor')], [comp('Northwind-Editor')]);
  expect(files.map(file => file.file)).toEqual(['northwind-editor-2.yaml', 'northwind-editor-3.yaml']);
  expect(files.map(file => documentOf(file).metadata.name)).toEqual(['northwind-editor-2', 'northwind-editor-3']);
  // Names stay at most 63 characters with the suffix, and names of components with errors are taken too.
  const long = 'a'.repeat(63);
  expect(scaffold([cask(long)], [], [long]).map(file => file.file)).toEqual([`${'a'.repeat(61)}-2.yaml`]);
});

test('Title that looks like YAML', () => {
  const title = 'Northwind: Editor\n # beta';
  const [file] = scaffold([app('com.northwind.editor', '/Applications/Northwind Editor.app', { title })]);
  const documents = parseAllDocuments(file!.text);
  expect(documents).toHaveLength(1);
  expect(documents[0]!.errors).toEqual([]);
  expect((documents[0]!.toJS() as Component).metadata.title).toBe('Northwind: Editor # beta');
  expect(checkScaffold([file!]).leftOut).toBe(0);
});
