/** Secret/PII guards never echo synthetic detected values. Run npm test. */
import { test, expect } from 'vitest';
import { component, licence, check, set } from './helpers.js';
import { parseSource } from '../../src/source.js';
import { validateSources } from '../../src/validate.js';
test('Token key in an annotation', () => { const result = check(set(component(), 'metadata.annotations', { 'deploy/Token': 'abc' })); expect(result.problems).toMatchObject([{ field: 'metadata.annotations["deploy/Token"]', severity: 'error' }]); expect(result.problems[0].message).not.toContain('abc'); });
test('Card number in a note', () => { const value = '4111 1111 1111 1111'; const result = check(set(licence(), 'spec.licence.note', value)); expect(result.problems).toMatchObject([{ field: 'spec.licence.note', severity: 'error' }]); expect(result.problems[0].message).not.toContain(value); });
test('Unquoted card number', () => {
 const parsed = parseSource('a.yaml', 'apiVersion: backstage.io/v1alpha1\nkind: Resource\nmetadata: {name: chat}\nspec:\n  type: licence\n  owner: user:alex\n  licence:\n    vendor: Northwind Studio\n    status: active\n    cycle: monthly\n    cost: 0\n    currency: GBP\n    renewsOn: unknown\n    note: 4111111111111111\n');
 const result = validateSources(parsed.sources); expect(result.problems).toMatchObject([{ field: 'spec.licence.note', severity: 'error' }]); expect(result.problems[0].message).not.toContain('4111111111111111');
});
test('Private key', () => { const value = '-----BEGIN OPENSSH PRIVATE KEY-----'; const result = check(set(component(), 'metadata.description', value)); expect(result.problems).toMatchObject([{ field: 'metadata.description', severity: 'error' }]); expect(result.problems[0].message).not.toContain(value); });
test('Ordinary long number', () => { const value = '1234567890123'; const result = check(set(licence(), 'spec.licence.note', value)); expect(result.problems).toEqual([]); expect(result.problems.every(p => !p.message.includes(value))).toBe(true); });
test('E-mail address', () => { const value = 'alex@example.com'; const result = check(set(component(), 'metadata.description', value)); expect(result.problems).toMatchObject([{ field: 'metadata.description', severity: 'warning' }]); expect(result.summary.errors).toBe(0); expect(result.problems[0].message).not.toContain(value); });
test('Versioned formula is not an address', () => { const result = check(set(component(), 'metadata.annotations', { 'stackledger/brew': 'python@3.12, node@22, openssl@3' })); expect(result.problems).toEqual([]); });
