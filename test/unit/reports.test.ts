/** The licence report model (licence-reports spec): one test per scenario of the model, named after
 * it (tasks.md, Scenario to test map). Run npm test. Catalogues are synthetic and fictitious.
 */
import { expect, test } from 'vitest';
import { buildGraph } from '../../src/graph.js';
import { formatAmount, type Amount } from '../../src/money.js';
import { buildReport, type OneOffRow, type Report, type TotalRow } from '../../src/reports.js';
import { applyView, resolveHidden } from '../../src/views.js';
import { check, component, layout, licence, set } from './helpers.js';

const DATE = '2027-06-01';

function lic(name: string, fields: Record<string, unknown> = {}): unknown {
  let document: unknown = licence(name);
  for (const [field, value] of Object.entries(fields)) document = set(document, `spec.licence.${field}`, value);
  return document;
}

const uses = (name: string, zone: string | undefined, ...refs: string[]) => {
  const user = set(component(name), 'spec.dependsOn', refs);
  return zone === undefined ? user : set(user, 'metadata.labels', { 'stackledger/zone': zone });
};

function reportOf(documents: unknown[], date = DATE, days = 90): Report {
  const catalogue = check(...documents);
  return buildReport(buildGraph(applyView(catalogue.served, 'full', resolveHidden(catalogue))), date, days);
}

const shown = (amount: Amount | null) => (amount === null ? null : formatAmount(amount));
const totals = (rows: TotalRow[]) => rows.map(row => ({ currency: row.currency, monthly: shown(row.monthly), yearly: shown(row.yearly), incomplete: row.incomplete }));
const oneOffTotals = (rows: OneOffRow[]) => rows.map(row => ({ currency: row.currency, total: shown(row.total), incomplete: row.incomplete }));
const refs = (entries: { ref: string }[]) => entries.map(entry => entry.ref);

// Renewals

test('Ninety-day window', () => {
  const report = reportOf([lic('licence-a', { renewsOn: '2027-08-30' }), lic('licence-b', { renewsOn: '2027-08-31' })]);
  expect(report.to).toBe('2027-08-30');
  expect(refs(report.renewals)).toEqual(['resource:licence-a']);
});

test('Overdue', () => {
  const report = reportOf([lic('licence-a', { renewsOn: '2027-05-20' })]);
  expect(refs(report.overdue)).toEqual(['resource:licence-a']);
  expect(report.renewals).toEqual([]);
});

test('Window of zero days', () => {
  const report = reportOf([
    lic('licence-yesterday', { renewsOn: '2027-05-31' }), lic('licence-today', { renewsOn: '2027-06-01' }), lic('licence-tomorrow', { renewsOn: '2027-06-02' }),
  ], DATE, 0);
  expect(refs(report.overdue)).toEqual(['resource:licence-yesterday']);
  expect(refs(report.renewals)).toEqual(['resource:licence-today']);
});

test('Window of 366 days', () => {
  const report = reportOf([lic('licence-in', { renewsOn: '2028-06-01' }), lic('licence-out', { renewsOn: '2028-06-02' })], DATE, 366);
  expect(refs(report.renewals)).toEqual(['resource:licence-in']);
  expect(() => reportOf([], DATE, 367)).toThrow(/0 to 366/);
});

// Recurring cost

test('Monthly and yearly', () => {
  const report = reportOf([lic('a', { cycle: 'monthly', cost: 10 }), lic('b', { status: 'to-confirm', cycle: 'yearly', cost: 120 })]);
  expect(totals(report.recurring)).toEqual([{ currency: 'GBP', monthly: '20.00', yearly: '240.00', incomplete: 0 }]);
});

test('Seats and none', () => {
  const report = reportOf([lic('a', { cycle: 'yearly', cost: 120, seats: 5 }), lic('b', { cycle: 'none', cost: 50 })]);
  expect(totals(report.recurring)).toEqual([{ currency: 'GBP', monthly: '10.00', yearly: '120.00', incomplete: 0 }]);
});

test('Exact sum', () => {
  const report = reportOf([lic('a', { cost: 0.1 }), lic('b', { cost: 0.2 }), lic('c', { cost: 1.00499 })]);
  expect(totals(report.recurring)[0]!.monthly).toBe('1.30');
});

test('Two currencies', () => {
  const report = reportOf([lic('a', { cost: 10 }), lic('b', { cost: 20, currency: 'USD' })]);
  expect(totals(report.recurring)).toEqual([
    { currency: 'GBP', monthly: '10.00', yearly: '120.00', incomplete: 0 },
    { currency: 'USD', monthly: '20.00', yearly: '240.00', incomplete: 0 },
  ]);
});

// One-off and planned

test('One-off with a date', () => {
  const report = reportOf([lic('licence-once', { cycle: 'one-off', cost: 300, renewsOn: '2027-07-01' })]);
  expect(report.oneOff.items.map(item => ({ ref: item.ref, cost: formatAmount(item.cost), currency: item.currency, renewsOn: item.renewsOn })))
    .toEqual([{ ref: 'resource:licence-once', cost: '300.00', currency: 'GBP', renewsOn: '2027-07-01' }]);
  expect(oneOffTotals(report.oneOff.totals)).toEqual([{ currency: 'GBP', total: '300.00', incomplete: 0 }]);
  expect(refs(report.renewals)).toEqual(['resource:licence-once']);
  expect(report.recurring).toEqual([]);
});

test('One-off beyond the window', () => {
  const report = reportOf([lic('licence-once', { cycle: 'one-off', cost: 300, renewsOn: '2027-08-31' })]);
  expect(refs(report.oneOff.items)).toEqual(['resource:licence-once']);
  expect(report.renewals).toEqual([]);
});

test('Planned purchase', () => {
  const report = reportOf([lic('licence-new', { status: 'to-buy', cycle: 'yearly', cost: 600, currency: 'EUR' })]);
  expect(report.planned.items.map(item => ({ ref: item.ref, monthly: shown(item.monthly), yearly: shown(item.yearly) })))
    .toEqual([{ ref: 'resource:licence-new', monthly: '50.00', yearly: '600.00' }]);
  expect(totals(report.planned.recurring)).toEqual([{ currency: 'EUR', monthly: '50.00', yearly: '600.00', incomplete: 0 }]);
  expect(report.recurring).toEqual([]);
  expect(report.groups).toEqual({ owner: [], payer: [], zone: [] });
});

test('Cancelled', () => {
  const report = reportOf([lic('licence-old', { status: 'cancelled', cycle: 'monthly', cost: 15, renewsOn: '2027-06-10' })]);
  expect(report.licences).toBe(1);
  expect({ ...report, licences: 0, date: '', to: '', days: 0 }).toEqual({
    date: '', days: 0, to: '', licences: 0, renewals: [], overdue: [], unknownDates: [], recurring: [],
    groups: { owner: [], payer: [], zone: [] }, oneOff: { items: [], totals: [] }, planned: { items: [], recurring: [], oneOff: [] },
    incomplete: [], rows: [],
  });
});

// Incomplete licences

test('Unknown cost', () => {
  const report = reportOf([lic('licence-x', { cycle: 'yearly', cost: 'unknown' })]);
  expect(report.incomplete).toEqual([{ ref: 'resource:licence-x', title: 'licence-x', status: 'active', unknown: ['cost'] }]);
  expect(totals(report.recurring)).toEqual([{ currency: 'GBP', monthly: null, yearly: null, incomplete: 1 }]);
});

test('Unknown currency', () => {
  const report = reportOf([lic('licence-a'), lic('licence-x', { currency: 'unknown' })]);
  expect(report.incomplete.map(item => item.unknown)).toEqual([['currency']]);
  expect(totals(report.recurring)).toEqual([
    { currency: 'GBP', monthly: '10.00', yearly: '120.00', incomplete: 0 },
    { currency: null, monthly: null, yearly: null, incomplete: 1 },
  ]);
});

test('Incomplete one-off and planned', () => {
  const report = reportOf([
    lic('licence-once', { cycle: 'one-off', cost: 'unknown' }), lic('licence-new', { status: 'to-buy', cycle: 'yearly', cost: 'unknown' }),
  ]);
  expect(oneOffTotals(report.oneOff.totals)).toEqual([{ currency: 'GBP', total: null, incomplete: 1 }]);
  expect(report.oneOff.items).toEqual([]);
  expect(totals(report.planned.recurring)).toEqual([{ currency: 'GBP', monthly: null, yearly: null, incomplete: 1 }]);
  expect(report.planned.items.map(item => [item.cost, item.monthly, item.yearly])).toEqual([[null, null, null]]);
  expect(refs(report.incomplete)).toEqual(['resource:licence-new', 'resource:licence-once']);
});

test('Group with only an unknown currency', () => {
  const report = reportOf([lic('licence-a'), set(lic('licence-ops', { currency: 'unknown' }), 'spec.owner', 'group:ops')]);
  const ops = report.groups.owner.find(group => group.key === 'group:ops')!;
  expect(totals(ops.totals)).toEqual([{ currency: null, monthly: null, yearly: null, incomplete: 1 }]);
});

// Groups

test('Licence used in two zones', () => {
  const zones = set(layout(), 'spec.zones', [{ name: 'finance', title: 'Finance', color: '#9B0056' }, { name: 'delivery', title: 'Delivery', color: '#0098D4' }]);
  const report = reportOf([zones, uses('ledger', 'finance', 'resource:licence-a'), uses('forge', 'Delivery', 'resource:licence-a'), lic('licence-a', { cost: 30 })]);
  expect(report.groups.zone.map(group => ({ label: group.label, synthetic: group.synthetic, totals: totals(group.totals) })))
    .toEqual([{ label: 'Several zones', synthetic: true, totals: [{ currency: 'GBP', monthly: '30.00', yearly: '360.00', incomplete: 0 }] }]);
});

test('Unused licence', () => {
  const report = reportOf([lic('licence-a', { cost: 30 })]);
  expect(report.groups.zone.map(group => ({ key: group.key, label: group.label, synthetic: group.synthetic, monthly: shown(group.totals[0]!.monthly) })))
    .toEqual([{ key: 'no-zone', label: 'No zone', synthetic: true, monthly: '30.00' }]);
});

test('Name that looks like a synthetic group', () => {
  const report = reportOf([lic('licence-a', { paidBy: 'Not set' }), lic('licence-b')]);
  expect(report.groups.payer.map(group => ({ label: group.label, synthetic: group.synthetic, monthly: shown(group.totals[0]!.monthly) }))).toEqual([
    { label: 'Not set', synthetic: false, monthly: '10.00' },
    { label: 'Not set', synthetic: true, monthly: '10.00' },
  ]);
});

test('Zones with the same title', () => {
  const zones = set(layout(), 'spec.zones', [{ name: 'fin-b', title: 'Finance', color: '#9B0056' }, { name: 'fin-a', title: 'Finance', color: '#0098D4' }]);
  const documents = [uses('one', 'fin-b', 'resource:licence-b'), uses('two', 'FIN-A', 'resource:licence-a'), lic('licence-a'), lic('licence-b')];
  const orders = [reportOf([zones, ...documents]), reportOf([zones, ...[...documents].reverse()])];
  for (const report of orders) expect(report.groups.zone.map(group => [group.key, group.label])).toEqual([['fin-a', 'Finance'], ['fin-b', 'Finance']]);
});
