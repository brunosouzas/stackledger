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
test('Unread YAML marks settings as unread', async () => {
 const big = folder({ 'big.yaml': 'x'.repeat(MAX_FILE_BYTES + 1), 'ok.yaml': component() });
 expect((await loadFolder(big)).settingsUnread).toBe(true);
 const linked = folder({ 'ok.yaml': component() }); symlinkSync(join(folder({ 'stackledger.yaml': 'kind: Settings\n' }), 'stackledger.yaml'), join(linked, 'stackledger.yaml'));
 expect((await loadFolder(linked)).settingsUnread).toBe(true);
 expect((await loadFolder(folder({ 'ok.yaml': component(), 'list.yaml': '- a\n' }))).settingsUnread).toBeUndefined();
});
