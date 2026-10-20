/** Line fields, stop resolution and shared drawing attributes. Run npm test. */
import { test, expect } from 'vitest';
import { component, licence, line, layout, check, errors, set } from './helpers.js';
const base = () => [component('a'), component('b'), layout()];
test('Typo in a line', () => { const result = errors(set(set(line(), 'spec.stops', undefined), 'spec.stop', ['component:a', 'component:b']), ...base()); expect(result.map(p => p.field).sort()).toEqual(['spec.stop', 'spec.stops']); });
test('Line with one stop', () => { expect(errors(set(line(), 'spec.stops', ['component:a']), ...base())).toMatchObject([{ field: 'spec.stops' }]); });
test('Short colour', () => { expect(errors(set(line(), 'spec.color', '#f00'), ...base())).toMatchObject([{ field: 'spec.color' }]); });
test('Shared code', () => { const result = errors(set(line('first'), 'spec.code', '1'), set(set(line('second'), 'spec.code', '1'), 'spec.color', '#00FF00'), ...base()); expect(result).toMatchObject([{ path: '001.yaml', field: 'spec.code' }]); expect(result[0].message).toContain('first'); });
test('Stop visited twice', () => { expect(errors(set(line(), 'spec.stops', ['component:a', 'component:b', 'component:a']), ...base())).toMatchObject([{ field: 'spec.stops[2]' }]); });
test('Stop that is a licence', () => { const result = errors(set(line(), 'spec.stops', ['component:a', 'resource:licence-chat']), licence(), ...base()); expect(result).toMatchObject([{ field: 'spec.stops[1]' }]); expect(result[0].message).toContain('must be components'); });
test('Missing stop', () => { expect(errors(set(line(), 'spec.stops', ['component:a', 'component:ghost']), ...base())).toMatchObject([{ field: 'spec.stops[1]' }]); });
test('Stop in another namespace', () => { expect(errors(set(line(), 'spec.stops', ['component:a', 'component:payments/caddy']), ...base())).toMatchObject([{ field: 'spec.stops[1]' }]); });
test('References use the earlier duplicate', () => { const result = check(component('slack'), component('Slack'), component('b'), set(line(), 'spec.stops', ['component:slack', 'component:b'])); expect(result.summary.errors).toBe(1); expect(result.problems.filter(p => p.severity === 'error')).toMatchObject([{ path: '001.yaml', field: 'metadata.name' }]); expect(result.problems.some(p => p.message.includes('target does not exist'))).toBe(false); });
test('Shared colour', () => { const result = check(line('first'), set(line('second'), 'spec.color', '#ff0000'), ...base()); expect(result.problems).toMatchObject([{ path: '001.yaml', field: 'spec.color', severity: 'warning' }]); expect(result.summary.errors).toBe(0); });
