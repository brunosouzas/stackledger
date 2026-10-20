/** Layout positions, line agreement and case-insensitive zones. Run npm test. */
import { test, expect } from 'vitest';
import { component, line, layout, check, errors, set } from './helpers.js';
const components = () => [component('a'), component('b')];
test('Second layout', () => { const result = errors(layout('first'), set(layout('second'), 'spec.stations', { 'component:ghost': [9, 9] }), ...components()); expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ path: '001.yaml', field: null }); expect(result[0].message).toContain('Only one MapLayout'); });
test('Two stations in one cell', () => { const result = errors(set(layout(), 'spec.stations', { 'component:a': [3, 2], 'component:b': [3, 2] }), ...components()); expect(result).toMatchObject([{ field: 'spec.stations["component:b"]' }]); expect(result[0].message).toContain('component:a'); });
test('Fractional position', () => { expect(errors(set(layout(), 'spec.stations', { 'component:a': [2.5, 1] }), component())).toMatchObject([{ field: 'spec.stations["component:a"]' }]); });
test('Station for a missing component', () => { expect(errors(set(layout(), 'spec.stations', { 'component:ghost': [0, 0] }))).toMatchObject([{ field: 'spec.stations["component:ghost"]' }]); });
test('Stop without position', () => { const result = check(line('first'), set(line('second'), 'spec.color', '#00FF00'), set(layout(), 'spec.stations', { 'component:b': [1, 0] }), ...components()); expect(result.problems).toMatchObject([{ path: '000.yaml', field: 'spec.stops[0]', severity: 'warning' }]); expect(result.summary).toMatchObject({ errors: 0, warnings: 1 }); });
test('No layout at all', () => { const result = check(line(), ...components()); expect(result.problems).toMatchObject([{ field: 'spec.stops[0]', severity: 'warning' }, { field: 'spec.stops[1]', severity: 'warning' }]); expect(result.summary).toMatchObject({ errors: 0, warnings: 2 }); });
const zones = [{ name: 'finance', title: 'Finance', color: '#123456' }];
test('Zone name in another case', () => { const result = check(set(component(), 'metadata.labels', { 'stackledger/zone': 'Finance' }), component('b'), line(), set(layout(), 'spec.zones', zones)); expect(result.problems).toEqual([]); });
test('Undeclared zone', () => { expect(errors(set(component(), 'metadata.labels', { 'stackledger/zone': 'finance' }))).toMatchObject([{ field: 'metadata.labels["stackledger/zone"]' }]); });
test('Duplicate zone', () => { expect(errors(set(layout(), 'spec.zones', [...zones, { ...zones[0], name: 'Finance' }]), ...components())).toMatchObject([{ field: 'spec.zones[1].name' }]); });
