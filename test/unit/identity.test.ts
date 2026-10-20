/** Identity and stage-order scenarios. Run npm test; each bad identity must stop checks. */
import { test, expect } from 'vitest';
import { component, line, check, errors, set } from './helpers.js';
test('Unmarked rule is an error', () => { expect(errors(set(line(), 'spec.code', 'ABCD'), component('a'), component('b'))).toMatchObject([{ field: 'spec.code', severity: 'error' }]); });
test('Ignored kind without a name', () => { const result = check({ kind: 'System' }); expect(result.summary).toMatchObject({ ignored: 1, documents: 0 }); expect(result.problems).toEqual([]); });
test('Unsupported pair without a name', () => { expect(check({ kind: 'Component', apiVersion: 'example.com/v1' }).problems).toMatchObject([{ field: 'apiVersion' }]); expect(check({ kind: 'Component', apiVersion: 'example.com/v1' }).problems).toHaveLength(1); });
test('Nothing but a name', () => { expect(check({ metadata: { name: 'a' } }).problems).toMatchObject([{ field: 'kind' }]); expect(check({ metadata: { name: 'a' } }).problems).toHaveLength(1); });
test('Invalid name stops the checks', () => { const result = check(set(set(component(), 'metadata.name', 'café'), 'spec.owner', undefined)); expect(result.problems).toHaveLength(1); expect(result.problems[0].field).toBe('metadata.name'); });
test('Missing kind', () => { expect(errors(set(component(), 'kind', undefined))).toMatchObject([{ field: 'kind' }]); });
test('Duplicate name across files', () => { const result = check(component('slack'), component('Slack')); expect(result.problems).toHaveLength(1); expect(result.problems[0]).toMatchObject({ path: '001.yaml', field: 'metadata.name', severity: 'error' }); expect(result.problems[0].message).toContain('000.yaml'); });
test('Name too long', () => { expect(errors(component('a'.repeat(64)))).toMatchObject([{ field: 'metadata.name' }]); expect(errors(component('a'.repeat(63)))).toEqual([]); });
test('Name with an accent', () => { expect(errors(component('café'))).toMatchObject([{ field: 'metadata.name' }]); });
test('Unsupported pair', () => { const result = errors(set(component(), 'apiVersion', 'stackledger/v1alpha1')); expect(result).toHaveLength(1); expect(result[0].message).toContain('backstage.io/v1alpha1 Component'); });
test('Kind in the wrong case', () => { const result = errors(set(component(), 'kind', 'component')); expect(result).toHaveLength(1); expect(result[0].message).toContain('Component, Resource, Line, MapLayout'); });
test('Backstage catalogue with extra kinds', () => { const result = check(component(), { kind: 'System' }, { kind: 'User', spec: { profile: { email: 'alex@example.com' } } }); expect(result.summary).toMatchObject({ ignored: 2, documents: 1 }); expect(result.problems).toEqual([]); });
test('Database resource', () => { const result = check({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'db' }, spec: { type: 'database' } }); expect(result.summary.ignored).toBe(1); expect(result.problems).toEqual([]); });
test('US spelling', () => { const result = check({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'chat' }, spec: { type: 'license' } }); expect(result.summary.ignored).toBe(1); expect(result.problems).toMatchObject([{ field: 'spec.type', severity: 'warning' }]); });
test('Resource without type', () => { expect(errors({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'db' } })).toMatchObject([{ field: 'spec.type' }]); });
test('Team namespace', () => { const result = check(set(component(), 'metadata.namespace', 'payments')); expect(result.summary).toMatchObject({ documents: 1, errors: 0, warnings: 1 }); expect(result.problems[0].field).toBe('metadata.namespace'); });
