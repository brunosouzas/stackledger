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
