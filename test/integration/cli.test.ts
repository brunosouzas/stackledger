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
test('Unknown command', () => { const result = run(['build']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('Unknown command'); });
test('Fictitious demo validates with every checked kind', () => { const result = run(['validate', demo]); expect(result.status).toBe(0); expect(result.stdout).toBe('files: 1, documents: 5, ignored: 0, errors: 0, warnings: 0\n'); });
