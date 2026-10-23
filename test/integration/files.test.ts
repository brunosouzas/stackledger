/** Discovery integration: real permissions, symlinks and parser failures. Run npm test. */
import { test, expect } from 'vitest';
import { symlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { loadFolder, MAX_FILE_BYTES } from '../../src/source.js';
import { component, folder } from '../helpers.js';
test('Nested and multi-document files', async () => {
 const root = folder({ 'a.yaml': component('a') + '---\n' + component('b') + '---\n# empty\n', 'team/b.yml': component('c') });
 const result = await loadFolder(root); expect(result.files).toBe(2); expect(result.sources).toHaveLength(3); expect(result.problems).toEqual([]);
});
test('Skipped folders and other files', async () => {
 const result = await loadFolder(folder({ '.git/x.yaml': 'bad', 'node_modules/y.yaml': 'bad', 'notes.md': 'bad' }));
 expect(result).toEqual({ files: 0, sources: [], problems: [] });
});
// catalogue, Skipped folders.
test('Pipeline folder in a catalogue repository', async () => {
 const workflow = 'name: stackledger\non:\n  push:\njobs:\n  site:\n    runs-on: ubuntu-latest\n';
 const result = await loadFolder(folder({ '.github/workflows/stackledger.yml': workflow, 'team/.config/z.yaml': 'bad', 'a.yaml': component('a') }));
 expect(result.files).toBe(1); expect(result.sources.map(s => s.path)).toEqual(['a.yaml']); expect(result.problems).toEqual([]);
});
test('Hidden file and hidden given folder', async () => {
 const root = join(folder({ '.catalogue/.extra.yaml': component('extra') }), '.catalogue');
 const result = await loadFolder(root); expect(result.sources.map(s => s.path)).toEqual(['.extra.yaml']); expect(result.problems).toEqual([]);
});
test('Unreadable hidden folder', async () => {
 const root = folder({ '.private/x.yaml': 'bad', 'a.yaml': component('a') }); chmodSync(join(root, '.private'), 0);
 try {
  const result = await loadFolder(root); expect(result.sources.map(s => s.path)).toEqual(['a.yaml']); expect(result.problems).toEqual([]);
 } finally { chmodSync(join(root, '.private'), 0o755); }
});
test('Hidden link', async () => {
 const shared = folder({ 'b.yaml': component('b') }); const root = folder({ 'a.yaml': component('a') }); symlinkSync(shared, join(root, '.shared'));
 const result = await loadFolder(root); expect(result.sources.map(s => s.path)).toEqual(['a.yaml']); expect(result.problems).toMatchObject([{ path: '.shared', severity: 'warning' }]);
});
test('Link that leaves the folder', async () => {
 const outside = folder({ 'secret.yaml': component() }); const root = folder(); symlinkSync(join(outside, 'secret.yaml'), join(root, 'outside.yaml'));
 const result = await loadFolder(root); expect(result.files).toBe(0); expect(result.sources).toEqual([]); expect(result.problems).toMatchObject([{ path: 'outside.yaml', severity: 'warning' }]);
});
test('Link to a folder inside', async () => {
 const root = folder({ 'ok.yaml': component() }); symlinkSync(root, join(root, 'again'));
 const result = await loadFolder(root); expect(result.sources).toHaveLength(1); expect(result.problems).toMatchObject([{ path: 'again', severity: 'warning' }]);
});
test('Oversized file', async () => {
 const result = await loadFolder(folder({ 'big.yaml': 'x'.repeat(MAX_FILE_BYTES + 1) }));
 expect(result.files).toBe(1); expect(result.sources).toEqual([]); expect(result.problems).toMatchObject([{ path: 'big.yaml', severity: 'error', message: 'File exceeds 1 MiB' }]);
});
test('Unreadable file', async () => {
 const root = folder({ 'locked.yaml': component('locked'), 'ok.yaml': component() }); chmodSync(join(root, 'locked.yaml'), 0);
 const result = await loadFolder(root); expect(result.sources.map(s => s.path)).toEqual(['ok.yaml']); expect(result.problems).toMatchObject([{ path: 'locked.yaml', severity: 'error' }]);
});
test('Broken file among good ones', async () => {
 const result = await loadFolder(folder({ 'bad.yaml': 'a: 1\nb: 2\nc: 3\nd: "unclosed', 'good.yaml': component() }));
 expect(result.sources.map(s => s.path)).toEqual(['good.yaml']); expect(result.problems).toMatchObject([{ path: 'bad.yaml', line: 4, severity: 'error' }]);
});
test('Duplicate key', async () => {
 const result = await loadFolder(folder({ 'a.yaml': component() + '---\nmetadata: {}\nmetadata: {}\n' }));
 expect(result.sources).toEqual([]); expect(result.problems).toMatchObject([{ severity: 'error', message: 'Invalid YAML (DUPLICATE_KEY)' }]);
});
test('Document that is a list', async () => {
 const result = await loadFolder(folder({ 'list.yaml': '- a\n- b\n' }));
 expect(result.sources).toEqual([]); expect(result.problems).toMatchObject([{ field: null, severity: 'error', message: 'Document must be a mapping' }]);
});
// catalogue, Catalogue files: a skills map file is never a catalogue file, wherever it is.
test('Skills map file in the catalogue folder', async () => {
 const { validateLoaded } = await import('../../src/validate.js');
 const skillsMap = 'apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: a-skills\nspec:\n  stations:\n    "skill:writer": [9, 9]\n---\napiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#FF0000"\n  stops: ["skill:writer", "skill:editor"]\n';
 const softwareLayout = 'apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: software\nspec:\n  stations:\n    "component:a": [0, 0]\n';
 const result = validateLoaded(await loadFolder(folder({ 'a.yaml': component('a'), 'map-layout.yaml': softwareLayout, 'skills/stackledger-skills.yaml': skillsMap })));
 expect(result.summary.errors).toBe(0); expect(result.problems.filter(p => p.path.includes('stackledger-skills'))).toEqual([]); expect(result.summary.files).toBe(2);
 expect(result.served.layouts.map(l => l.metadata.name)).toEqual(['software']); expect(result.served.lines).toEqual([]);
});
