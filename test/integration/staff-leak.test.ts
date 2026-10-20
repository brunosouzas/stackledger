/** Staff leak test: distinctive hidden values never reach any raw staff byte. Run npm run build && npm test.
 * Values sit in hidden licence fields and in places no allow-list keeps: spec.cost on a licence,
 * spec.licence on a component, a licence's spec.dependsOn and a licence that fails its field checks.
 */
import { test, expect } from 'vitest';
import { folder } from '../helpers.js';
import { component, licence, line, set } from '../unit/helpers.js';
import { raw, yaml } from './mcp-helpers.js';
const hidden = ['98765', 'QZX', '2031-07-19', '97531', 'PAYER-OMEGA', 'VAULT-SIGMA', 'ZETA-NOTE', 'one-off', '87654', 'DEPENDS-54321', '76543', 'COMPONENT-LICENCE-NOTE', 'UNLISTED-65432', 'LICENCE-LIFECYCLE', '2030-01-01', 'BROKEN-NOTE'];
function fixture(): string {
  let editorLicence: unknown = licence('licence-editor');
  for (const [field, value] of Object.entries({ cycle: 'one-off', cost: 98765, currency: 'QZX', renewsOn: '2031-07-19', seats: 97531, paidBy: 'PAYER-OMEGA', vaultItem: 'VAULT-SIGMA', note: 'ZETA-NOTE' })) editorLicence = set(editorLicence, `spec.licence.${field}`, value);
  editorLicence = set(set(set(editorLicence, 'spec.cost', 87654), 'spec.dependsOn', ['DEPENDS-54321']), 'spec.lifecycle', 'LICENCE-LIFECYCLE');
  const chat = set(licence('licence-chat'), 'spec.licence.renewsOn', '2030-01-01');
  const broken = set(set(licence('licence-broken'), 'spec.licence.cost', -5), 'spec.licence.note', 'BROKEN-NOTE');
  const editor = set(set(set(component('editor'), 'spec.dependsOn', ['resource:licence-editor', 'component:forge']), 'spec.licence', { cost: 76543, note: 'COMPONENT-LICENCE-NOTE' }), 'spec.price', 'UNLISTED-65432');
  return folder({ 'catalogue.yaml': yaml(editor, component('forge'), editorLicence, chat, broken, set(line('ship'), 'spec.stops', ['component:editor', 'component:forge'])) });
}
test('No trace of the cost', async () => {
  const session = await raw(fixture(), 'staff');
  const calls: [string, Record<string, unknown>][] = [['find_items', {}], ['find_items', { kind: 'licence' }], ['find_items', { kind: 'component', limit: 1 }], ['find_items', { zone: 'delivery' }],
    ['find_items', { limit: 500 }], ['find_items', { kind: 'system' }], ['find_items', { query: 5 }], ['get_item', {}], ['get_item', { ref: 'component:ghost' }], ['get_item', { ref: 'resource:licence-broken' }],
    ['impact', { ref: 'line:ship' }], ['impact', { ref: 7 }], ['gaps', {}], ['gaps', { extra: true }], ['renewals', { from: '2027-06-01' }], ['validate', {}]];
  for (const value of hidden) calls.push(['find_items', { query: value }]);
  for (const ref of ['component:editor', 'component:forge', 'resource:licence-editor', 'resource:licence-chat', 'line:ship']) calls.push(['get_item', { ref }], ['impact', { ref }]);
  const results = [];
  for (const [name, args] of calls) results.push({ name, args, result: await session.call(name, args) });
  await session.close();
  const bytes = session.transport.raw() + session.transport.stderr;
  for (const value of hidden) expect(bytes, value).not.toContain(value);
  // The session really answered: visible values are present and searches for hidden ones match nothing.
  expect(bytes).toContain('Northwind Studio'); expect(results.filter(r => r.result.isError)).toHaveLength(11);
  for (const { result } of results.filter(r => hidden.includes(r.args.query as string))) expect(result.structuredContent).toMatchObject({ items: [], total: 0 });
  expect(results.filter(r => hidden.includes(r.args.query as string))).toHaveLength(hidden.length);
  expect(await session.transport.exit).toBe(0);
});
/** Two catalogues that differ only in hidden or dropped values must give byte-identical staff answers. */
function variant(values: { cost: number; renewsOn: [string, string, string]; note: string; seats: number; misplaced: number; vendor?: string; status?: string }, settings?: string): string {
  const licences = ['licence-a', 'licence-b', 'licence-c'].map((name, i) => {
    let value: unknown = licence(name);
    for (const [field, v] of Object.entries({ cost: values.cost + i, renewsOn: values.renewsOn[i], note: values.note, seats: values.seats, ...(values.vendor ? { vendor: values.vendor } : {}), ...(values.status ? { status: values.status } : {}) })) value = set(value, `spec.licence.${field}`, v);
    return set(set(value, 'spec.cost', values.misplaced), 'spec.dependsOn', [`resource:x-${values.misplaced}`]);
  });
  const editor = set(set(component('editor'), 'spec.dependsOn', ['resource:licence-b']), 'spec.licence', { cost: values.misplaced });
  return folder({ 'catalogue.yaml': yaml(editor, component('forge'), ...licences, set(line('ship'), 'spec.stops', ['component:editor', 'component:forge'])), ...(settings ? { 'stackledger.yaml': settings } : {}) });
}
async function answers(root: string): Promise<string[]> {
  const session = await raw(root, 'staff');
  const calls: [string, Record<string, unknown>][] = [['find_items', {}], ['find_items', { kind: 'licence' }], ['find_items', { kind: 'licence', limit: 2 }], ['find_items', { query: 'licence' }], ['find_items', { query: 'a' }], ['gaps', {}], ['get_item', { ref: 'resource:licence-z' }]];
  for (const ref of ['component:editor', 'component:forge', 'resource:licence-a', 'resource:licence-b', 'resource:licence-c', 'line:ship']) calls.push(['get_item', { ref }], ['impact', { ref }]);
  const texts = [];
  for (const [name, args] of calls) texts.push((await session.call(name, args)).content[0]!.text);
  await session.close(); return texts;
}
test('Hidden values change no staff answer', async () => {
  const first = { cost: 10, renewsOn: ['2027-01-01', '2027-06-01', '2027-12-01'] as [string, string, string], note: 'renew early', seats: 3, misplaced: 11111 };
  const second = { cost: 90000, renewsOn: ['2029-12-01', '2028-06-01', '2027-03-01'] as [string, string, string], note: 'zzz final term', seats: 400, misplaced: 99999 };
  expect(await answers(variant(second))).toEqual(await answers(variant(first)));
  const hideAll = 'apiVersion: stackledger/v1alpha1\nkind: Settings\nmetadata: {name: settings}\nspec: {views: {staff: {hide: [vendor, status, cost, renewsOn, note, seats]}}}\n';
  const custom = await answers(variant({ ...first, vendor: 'Northwind Studio', status: 'active' }, hideAll));
  expect(await answers(variant({ ...second, vendor: 'Zeta Supplies', status: 'expired' }, hideAll))).toEqual(custom);
  expect(custom.join('\n')).not.toContain('Northwind Studio');
});
