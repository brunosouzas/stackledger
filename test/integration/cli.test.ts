/** CLI usage and status integration. npm run build && npm test runs the real entry point. */
import { test, expect } from 'vitest';
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { run, demo } from './helpers.js';
import { folder, component } from '../helpers.js';
test('Default folder', () => { const result = run(['validate'], demo); expect(result.status).toBe(0); expect(result.stderr).toBe(''); expect(result.stdout).toContain('documents: 5'); });
test('Help', () => { const result = run(['validate', '--help']); expect(result.status).toBe(0); expect(result.stdout).toContain('Usage: stackledger validate'); expect(result.stderr).toBe(''); });
test('Help wins', () => { const result = run(['validate', '--help', '--fast', 'a', 'b']); expect(result.status).toBe(0); expect(result.stdout).toContain('Usage:'); expect(result.stderr).toBe(''); expect(run(['--help', '--invalid']).status).toBe(0); });
test('Unknown option', () => { const result = run(['validate', '--fast']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('--fast'); expect(result.stderr).toContain('Usage:'); });
test('Two folders', () => { const result = run(['validate', 'a', 'b']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('Only one folder is accepted'); });
test('No command', () => { const result = run(); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('Usage:'); });
test('Warnings only', () => { const result = run(['validate', folder({ 'a.yaml': component().replace('  name: a', '  name: a\n  namespace: team\n  description: alex@example.com') })]); expect(result.status).toBe(0); expect(result.stdout).toContain('errors: 0, warnings: 2'); expect(result.stderr).toBe(''); });
test('One error', () => { const result = run(['validate', folder({ 'a.yaml': component().replace('  owner: user:alex\n', '') })]); expect(result.status).toBe(1); expect(result.stdout).toContain('errors: 1'); expect(result.stderr).toBe(''); });
test('Missing folder', () => { const result = run(['validate', join(folder(), 'absent'), '--json']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('folder was not found'); });
test('Top-level file and unreadable folder cannot be checked', () => {
 const root = folder({ 'a.yaml': component() }); expect(run(['validate', join(root, 'a.yaml')]).status).toBe(2);
 chmodSync(root, 0); const result = run(['validate', root, '--json']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('cannot be read');
});
test('Unknown command', () => { const result = run(['publish']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('Unknown command'); });
test('Fictitious demo validates with every checked kind', () => { const result = run(['validate', demo]); expect(result.status).toBe(0); expect(result.stdout).toBe('files: 1, documents: 5, ignored: 0, errors: 0, warnings: 0\n'); });
test('Global help lists both commands', () => {
 const help = run(['--help']); expect(help.status).toBe(0);
 for (const command of ['validate', 'mcp', 'map', 'build', 'report', 'drift']) expect(help.stdout).toContain(`stackledger ${command} `);
 expect(help.stdout).toContain('stackledger discover\n');
 const unknown = run(['publish']); expect(unknown.status).toBe(2); expect(unknown.stderr).toContain('expected validate, mcp, map, build, report, discover or drift');
});
test('Hostile annotation key', () => {
 // YAML's \x9b escape puts a raw U+009B (CSI) into the key; output must show it only as \u009b.
 const root = folder({ 'a.yaml': component().replace('  name: a\n', '  name: a\n  annotations:\n    "stackledger/brew\\x9b2J": git\n') });
 const text = run(['validate', root]), json = run(['validate', root, '--json']);
 expect(text.status).toBe(0); expect(json.status).toBe(0);
 expect(text.stdout).toContain('metadata.annotations["stackledger/brew\\u009b2J"]');
 expect(JSON.parse(json.stdout).problems[0].field).toBe('metadata.annotations["stackledger/brew\\u009b2J"]');
 for (const output of [text.stdout, json.stdout]) expect(output).not.toContain('\u009b');
});
