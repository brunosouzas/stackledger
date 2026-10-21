/** buildDrift (drift-command spec: matching, not declared, missing, shared, inferred needs, proposed
 * relations, cask app suggestions, identifiers that cannot be annotated, order). Run npm test.
 * One test per scenario, named after it; snapshots and components are fictitious (test/drift-helpers.ts).
 */
import { test, expect } from 'vitest';
import { buildDrift, itemNeeds } from '../../src/drift.js';
import { app, brew, cask, comp, launchd, mas, simple, snapshotOf } from '../drift-helpers.js';

const ids = (entries: { source: string; id: string }[]) => entries.map(entry => `${entry.source} ${entry.id}`);
/** What the launchd item `job` needs, as `source id` texts. */
function needsOfJob(items: Parameters<typeof snapshotOf>[0]): string[] {
  const snapshot = snapshotOf(items);
  const job = snapshot.items.find(item => item.source === 'launchd')!;
  return (itemNeeds(snapshot).get(job) ?? []).map(item => `${item.source} ${item.id}`);
}

test('Name is not enough', () => {
  const drift = buildDrift(snapshotOf([brew('git')]), [comp('git', {}, { title: 'git' })]);
  expect(ids(drift.notDeclared)).toEqual(['brew git']);
  expect(drift.matched).toEqual([]);
});

test('Bundle identifier in another case', () => {
  const drift = buildDrift(snapshotOf([app('com.northwind.editor', '/Applications/Northwind Editor.app')]), [comp('editor', { 'stackledger/app': 'COM.Northwind.Editor' })]);
  expect(drift.matched).toEqual([{ source: 'app', id: 'com.northwind.editor', path: '/Applications/Northwind Editor.app', components: ['component:editor'] }]);
  expect(drift.notDeclared).toEqual([]);
  expect(drift.missing).toEqual([]);
});

test('Python package spelling', () => {
  const drift = buildDrift(snapshotOf([simple('pipx', 'northwind-docs')]), [comp('docs', { 'stackledger/pipx': 'Northwind_Docs' })]);
  expect(drift.matched.map(entry => entry.components)).toEqual([['component:docs']]);
  expect(drift.missing).toEqual([]);
  // Only pipx reads `_` as `-`; npm compares exactly.
  const npm = buildDrift(snapshotOf([simple('npm', 'northwind-docs')]), [comp('docs', { 'stackledger/npm': 'Northwind_Docs' })]);
  expect(npm.matched).toEqual([]);
});

test('Undeclared cask', () => {
  const drift = buildDrift(snapshotOf([cask('northwind-editor', [], ['5.0.1'])]), []);
  expect(drift.notDeclared).toEqual([{ source: 'cask', id: 'northwind-editor', path: null, versions: ['5.0.1'], title: null,
    annotation: 'stackledger/cask: northwind-editor', note: null, suggestedComponents: [] }]);
  expect(drift.counts.notDeclared).toBe(1);
});

test('Formula installed as a dependency', () => {
  const drift = buildDrift(snapshotOf([brew('libnorth', { onRequest: false })]), []);
  expect(drift.notDeclared).toEqual([]);
  expect(drift.counts.dependencies).toBe(1);
  // It still matches when annotated.
  const annotated = buildDrift(snapshotOf([brew('libnorth', { onRequest: false })]), [comp('libnorth', { 'stackledger/brew': 'libnorth' })]);
  expect(annotated.counts).toMatchObject({ matched: 1, dependencies: 0 });
});

test('Apple app', () => {
  const drift = buildDrift(snapshotOf([
    app('com.apple.northwindsample', '/Applications/Northwind Sample.app'),
    app('com.apple.northwindstore', '/Applications/Northwind Store.app', { appStore: true }),
    launchd('com.apple.northwind.agent', null),
  ]), []);
  expect(ids(drift.notDeclared)).toEqual(['app com.apple.northwindstore']);
  expect(drift.counts.macos).toBe(2);
});

test('Missing app', () => {
  const drift = buildDrift(snapshotOf([]), [comp('legacy', { 'stackledger/app': 'com.northwind.legacy' })]);
  expect(drift.missing).toEqual([{ component: 'component:legacy', source: 'app', id: 'com.northwind.legacy', incomplete: false }]);
  expect(drift.notChecked).toEqual([]);
});

test('Source skipped', () => {
  const drift = buildDrift(snapshotOf([], { mas: { status: 'skipped' } }), [comp('notes', { 'stackledger/mas': '1234567890' })]);
  expect(drift.notChecked).toEqual([{ component: 'component:notes', source: 'mas', id: '1234567890', status: 'skipped' }]);
  expect(drift.missing).toEqual([]);
});

test('Missing from an incomplete source', () => {
  const drift = buildDrift(snapshotOf([launchd('com.northwind.sync', null)], { launchd: { ignored: 1 } }), [comp('backup', { 'stackledger/launchd': 'com.northwind.backup' })]);
  expect(drift.missing).toEqual([{ component: 'component:backup', source: 'launchd', id: 'com.northwind.backup', incomplete: true }]);
});

test('Two components for one item', () => {
  const drift = buildDrift(snapshotOf([cask('northwind-editor')]), [
    comp('editor-beta', { 'stackledger/cask': 'northwind-editor' }), comp('editor', { 'stackledger/cask': 'northwind-editor' })]);
  expect(drift.shared).toEqual([{ source: 'cask', id: 'northwind-editor', path: null, components: ['component:editor', 'component:editor-beta'] }]);
  expect(drift.matched).toEqual(drift.shared);
  expect(drift.counts).toMatchObject({ items: 1, matched: 1, shared: 1 });
});

test('Job inside an app', () => {
  expect(needsOfJob([
    app('com.northwind.sync', '/Applications/Northwind Sync.app'),
    launchd('com.northwind.sync', '/Applications/Northwind Sync.app/Contents/MacOS/sync'),
  ])).toEqual(['app com.northwind.sync']);
});

test('Job of a formula', () => {
  expect(needsOfJob([brew('forge'), launchd('com.northwind.updater', '/opt/homebrew/opt/forge/bin/forge')])).toEqual(['brew forge']);
  expect(needsOfJob([brew('forge'), launchd('com.northwind.updater', '/usr/local/Cellar/forge/2.1.0/bin/forge')])).toEqual(['brew forge']);
});

test('Job of a tap formula', () => {
  expect(needsOfJob([brew('northwind/tools/ledger'), launchd('com.northwind.ledger', '/opt/homebrew/opt/ledger/bin/ledger')])).toEqual(['brew northwind/tools/ledger']);
});

test('Two formulae with one short name', () => {
  expect(needsOfJob([brew('ledger'), brew('northwind/tools/ledger'), launchd('com.northwind.ledger', '/opt/homebrew/opt/ledger/bin/ledger')])).toEqual([]);
});

test('Prefix that only looks alike', () => {
  expect(needsOfJob([
    app('com.northwind.sync', '/Applications/Northwind Sync.app'),
    launchd('com.northwind.helper', '/Applications/Northwind Sync Helper.app/Contents/MacOS/helper'),
  ])).toEqual([]);
});

test('Formula dependency proposed', () => {
  const drift = buildDrift(snapshotOf([brew('forge', { dependsOn: ['libnorth'] }), brew('libnorth', { onRequest: false })]), [
    comp('forge', { 'stackledger/brew': 'forge' }), comp('libnorth', { 'stackledger/brew': 'libnorth' })]);
  expect(drift.proposedRelations).toEqual([{ from: 'component:forge', to: 'component:libnorth',
    reasons: [{ from: { source: 'brew', id: 'forge', path: null }, to: { source: 'brew', id: 'libnorth', path: null } }] }]);
  expect(drift.counts.proposedRelations).toBe(1);
});

test('Relation already declared', () => {
  const drift = buildDrift(snapshotOf([brew('forge', { dependsOn: ['libnorth'] }), brew('libnorth', { onRequest: false })]), [
    comp('forge', { 'stackledger/brew': 'forge' }, { dependsOn: ['Component:LibNorth'] }), comp('libnorth', { 'stackledger/brew': 'libnorth' })]);
  expect(drift.proposedRelations).toEqual([]);
});

test('App installed by a cask', () => {
  const drift = buildDrift(snapshotOf([cask('northwind-editor', ['Northwind Editor.app']), app('com.northwind.editor', '/Applications/Northwind Editor.app')]),
    [comp('editor', { 'stackledger/cask': 'northwind-editor' })]);
  expect(drift.notDeclared).toHaveLength(1);
  expect(drift.notDeclared[0]).toMatchObject({ source: 'app', id: 'com.northwind.editor', annotation: 'stackledger/app: com.northwind.editor', suggestedComponents: ['component:editor'] });
});

test('App installed by a shared cask', () => {
  const drift = buildDrift(snapshotOf([cask('northwind-editor', ['Northwind Editor.app']), app('com.northwind.editor', '/Applications/Northwind Editor.app')]), [
    comp('editor-beta', { 'stackledger/cask': 'northwind-editor' }), comp('editor', { 'stackledger/cask': 'northwind-editor' })]);
  expect(drift.notDeclared[0]!.suggestedComponents).toEqual(['component:editor', 'component:editor-beta']);
});

test('Label with a comma', () => {
  const drift = buildDrift(snapshotOf([launchd('com.northwind.sync,helper', null)]), [comp('sync', { 'stackledger/launchd': 'com.northwind.sync,helper' })]);
  expect(drift.notDeclared).toHaveLength(1);
  expect(drift.notDeclared[0]).toMatchObject({ id: 'com.northwind.sync,helper', annotation: null, note: 'cannot be annotated' });
  expect(drift.matched).toEqual([]);
  // White space at either end and control characters cannot be annotated either.
  const others = buildDrift(snapshotOf([simple('npm', ' northwind-cli'), simple('npm', 'northwind\u0007cli')]), []);
  expect(others.notDeclared.map(entry => entry.note)).toEqual(['cannot be annotated', 'cannot be annotated']);
});

test('Dependency that cannot be annotated', () => {
  const drift = buildDrift(snapshotOf([brew('forge,helper', { onRequest: false })]), []);
  expect(drift.notDeclared).toEqual([]);
  expect(drift.counts.dependencies).toBe(1);
});

test('Names in mixed case', () => {
  const drift = buildDrift(snapshotOf([cask('northwind-editor')]), [
    comp('alpha', { 'stackledger/cask': 'northwind-editor', 'stackledger/app': 'com.northwind.gone' }),
    comp('Zed', { 'stackledger/cask': 'northwind-editor', 'stackledger/app': 'com.northwind.gone' })]);
  expect(drift.shared[0]!.components).toEqual(['component:Zed', 'component:alpha']);
  expect(drift.missing.map(entry => entry.component)).toEqual(['component:Zed', 'component:alpha']);
  // Items keep source order, then id: brew before cask before mas.
  const ordered = buildDrift(snapshotOf([mas('2', 'B'), cask('b'), cask('a'), brew('z')]), []);
  expect(ids(ordered.notDeclared)).toEqual(['brew z', 'cask a', 'cask b', 'mas 2']);
});

test('counts', () => {
  const drift = buildDrift(snapshotOf([brew('forge'), cask('northwind-editor')]), [comp('forge', { 'stackledger/brew': 'forge' }), comp('plain')]);
  expect(drift.counts).toEqual({ items: 2, matched: 1, notDeclared: 1, dependencies: 0, macos: 0, missing: 0, notChecked: 0, shared: 0, proposedRelations: 0, componentsWithoutAnnotations: 1 });
  expect(drift.snapshot).toEqual({ machine: { name: 'username-macbook-air', user: 'username', macos: '27.2' }, takenAt: '2026-10-21T07:30:00Z' });
  expect(Object.keys(drift)).toEqual(['snapshot', 'counts', 'notDeclared', 'missing', 'notChecked', 'shared', 'matched', 'proposedRelations']);
});
