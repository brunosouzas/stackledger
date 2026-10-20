/** Licence schema boundaries and unknown-value scenarios. Run npm test. */
import { test, expect } from 'vitest';
import { licence, check, errors, set } from './helpers.js';
for (const [scenario, path, value] of [
 ['Typo in a licence', 'spec.licence.renews_on', '2027-01-01'],
 ['Owner that is a list', 'spec.owner', []],
 ['Licence without vendor', 'spec.licence.vendor', undefined],
 ['Zero seats', 'spec.licence.seats', 0],
 ['Fractional seats', 'spec.licence.seats', 2.5],
 ['Impossible date', 'spec.licence.renewsOn', '2027-02-30'],
 ['Negative cost', 'spec.licence.cost', -5],
 ['Lower-case currency', 'spec.licence.currency', 'gbp'],
] as const) test(scenario, () => { expect(errors(set(licence(), path, value))).toMatchObject([{ field: path, severity: 'error' }]); });
test('Unknown status', () => { const result = errors(set(licence(), 'spec.licence.status', 'retired')); expect(result).toMatchObject([{ field: 'spec.licence.status' }]); for (const status of ['active', 'to-confirm', 'to-buy', 'cancelled', 'expired']) expect(result[0].message).toContain(status); });
test('Unknown values are valid', () => { let value: unknown = licence(); for (const field of ['cost', 'currency', 'renewsOn']) value = set(value, `spec.licence.${field}`, 'unknown'); expect(check(value).problems).toEqual([]); });
