/** One test per mcp-server scenario, through the SDK client against dist/cli.js. Run npm run build && npm test.
 * Catalogues are fictitious (Northwind Studio); each test starts its own server on its own folder.
 */
import { test, expect } from 'vitest';
import { rmSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { run } from './helpers.js';
import { folder } from '../helpers.js';
import { component, licence, line, layout, set } from '../unit/helpers.js';
import { connect, raw, withSession, waitFor, yaml, type Session } from './mcp-helpers.js';
const fullTools = ['find_items', 'get_item', 'impact', 'gaps', 'renewals', 'validate'];
const uses = (name: string, ...refs: string[]) => set(component(name), 'spec.dependsOn', refs);
const editorLicence = (fields: Record<string, unknown> = {}) => { let value: unknown = licence('licence-editor'); for (const [k, v] of Object.entries(fields)) value = set(value, `spec.licence.${k}`, v); return value; };
const database = (description?: string) => ({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'orders-db', ...(description ? { description } : {}) }, spec: { type: 'database', owner: 'group:data' } });
const catalogue = (...documents: unknown[]) => folder({ 'catalogue.yaml': yaml(...documents) });
const ok = (result: Awaited<ReturnType<Session['call']>>) => { expect(result.isError ?? false).toBe(false); expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent); return result.structuredContent!; };
const failed = (result: Awaited<ReturnType<Session['call']>>) => { expect(result.isError).toBe(true); expect(result.content).toHaveLength(1); expect(result.structuredContent).toBeUndefined(); return result.content[0]!.text; };
const refs = (items: { ref: string }[]) => items.map(item => item.ref);
const every = (view: 'full' | 'staff') => [['find_items', {}], ['get_item', { ref: 'component:editor' }], ['impact', { ref: 'component:editor' }], ['gaps', {}],
  ...(view === 'full' ? [['renewals', { from: '2027-06-01' }], ['validate', {}]] : [])] as [string, Record<string, unknown>][];

test('Default view', async () => {
  const parent = folder({ 'catalogue/a.yaml': yaml(component('editor')) });
  const session = await connect('./catalogue', undefined, [], parent);
  try {
    expect((await session.client.listTools()).tools.map(t => t.name).sort()).toEqual([...fullTools].sort());
    expect(ok(await session.call('find_items')).catalogue).toEqual({ view: 'full', errors: 0, warnings: 0 });
    expect(await waitFor(session.stderr, 'tools')).toContain(`serving ${join(realpathSync(parent), 'catalogue')} in the full view`);
  } finally { await session.close(); }
});
test('Input closes', async () => {
  const session = await raw(catalogue(component('editor')));
  ok(await session.call('gaps')); await session.close();
  expect(await session.transport.exit).toBe(0);
});
test('No folder', () => { const result = run(['mcp']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('folder is required'); expect(result.stderr).toContain('Usage:'); });
test('Unknown view', () => { const result = run(['mcp', catalogue(component()), '--view', 'finance']); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('allowed views: full, staff'); });
test('Missing folder', () => { const result = run(['mcp', join(folder(), 'absent')]); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('folder was not found'); });
test('Other usage errors stop before serving', () => {
  const root = catalogue(component());
  for (const args of [['mcp', root, '--fast'], ['mcp', root, root], ['mcp', join(root, 'catalogue.yaml')]]) { const result = run(args); expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('Usage:'); }
});
test('Help', () => { const result = run(['mcp', '--help', '--view', 'finance']); expect(result.status).toBe(0); expect(result.stdout).toContain('stackledger mcp <folder> [--view full|staff]'); expect(result.stderr).toBe(''); });
test('Global help lists both commands', () => { const result = run(['--help']); expect(result.status).toBe(0); expect(result.stdout).toContain('stackledger validate [folder]'); expect(result.stdout).toContain('stackledger mcp <folder>'); });
test('Staff tool list', async () => {
  await withSession(catalogue(component()), 'staff', async session => { expect((await session.client.listTools()).tools.map(t => t.name).sort()).toEqual(['find_items', 'gaps', 'get_item', 'impact']); });
});
test('Read-only hint', async () => {
  for (const view of ['full', 'staff']) await withSession(catalogue(component()), view, async session => {
    const { tools } = await session.client.listTools(); expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) { expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false }); expect(tool.outputSchema).toMatchObject({ type: 'object' }); }
  });
});
test('Licence with an invalid cost', async () => {
  const root = catalogue(editorLicence({ cost: -5 }), uses('editor', 'resource:licence-editor'));
  for (const view of ['full', 'staff']) await withSession(root, view, async session => {
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:editor']);
    expect(ok(await session.call('get_item', { ref: 'component:editor' })).unresolved).toEqual(['resource:licence-editor']);
  });
});
test('Edit between calls', async () => {
  const root = catalogue(component('editor'));
  await withSession(root, undefined, async session => {
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:editor']);
    writeFileSync(join(root, 'forge.yaml'), yaml(component('forge')));
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:editor', 'component:forge']);
  });
});
test('Component with a field error', async () => {
  await withSession(catalogue(component('a'), set(component('b'), 'spec.owner', undefined), component('c')), undefined, async session => {
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:a', 'component:c']);
  });
});
test('Component holding a private key', async () => {
  await withSession(catalogue(component('editor'), set(component('keyed'), 'metadata.description', '-----BEGIN OPENSSH PRIVATE KEY-----')), undefined, async session => {
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:editor']);
    expect(failed(await session.call('get_item', { ref: 'component:keyed' }))).toContain('component:keyed');
  });
});
test('Later duplicate', async () => {
  const root = folder({ 'a.yaml': yaml(set(component('slack'), 'metadata.title', 'Earlier')), 'b.yaml': yaml(set(component('Slack'), 'metadata.title', 'Later')) });
  await withSession(root, undefined, async session => {
    expect(ok(await session.call('find_items')).items).toMatchObject([{ ref: 'component:slack', title: 'Earlier' }]);
    expect(ok(await session.call('find_items')).total).toBe(1);
  });
});
test('Dangling dependency', async () => {
  await withSession(catalogue(uses('editor', 'component:ghost')), undefined, async session => {
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:editor']);
    expect(ok(await session.call('get_item', { ref: 'component:editor' }))).toMatchObject({ dependsOn: [], unresolved: ['component:ghost'] });
  });
});
test('Database resource', async () => {
  await withSession(catalogue(database(), uses('editor', 'resource:orders-db')), undefined, async session => {
    expect(ok(await session.call('get_item', { ref: 'resource:orders-db' }))).toEqual({ catalogue: { view: 'full', errors: 0, warnings: 0 }, ref: 'resource:orders-db', kind: 'resource', type: 'database', dependants: ['component:editor'] });
  });
});
test('Counts in the full view', async () => {
  await withSession(catalogue(uses('editor', 'component:ghost')), 'full', async session => {
    for (const [name, args] of every('full')) expect(ok(await session.call(name, args)).catalogue).toEqual({ view: 'full', errors: 1, warnings: 0 });
  });
});
test('No counts in the staff view', async () => {
  await withSession(catalogue(uses('editor', 'component:ghost')), 'staff', async session => {
    for (const [name, args] of every('staff')) expect(ok(await session.call(name, args)).catalogue).toEqual({ view: 'staff' });
  });
});
test('Same call twice', async () => {
  await withSession(catalogue(component('vault'), uses('forge', 'component:vault'), uses('editor', 'component:forge')), undefined, async session => {
    const first = await session.call('impact', { ref: 'component:vault' }), second = await session.call('impact', { ref: 'component:vault' });
    expect(second.content[0]!.text).toBe(first.content[0]!.text); expect(JSON.stringify(second.structuredContent)).toBe(JSON.stringify(first.structuredContent));
  });
});
test('Folder removed while serving', async () => {
  const root = catalogue(component('editor'));
  await withSession(root, undefined, async session => {
    rmSync(root, { recursive: true, force: true });
    expect(failed(await session.call('find_items'))).toContain('folder was not found');
    mkdirSync(dirname(join(root, 'a.yaml')), { recursive: true }); writeFileSync(join(root, 'a.yaml'), yaml(component('forge')));
    expect(refs(ok(await session.call('find_items')).items)).toEqual(['component:forge']);
  });
});
test('Missing argument', async () => {
  await withSession(catalogue(component('editor')), undefined, async session => {
    expect(failed(await session.call('get_item'))).toContain('ref');
    for (const [name, args] of [['get_item', { ref: 5 }], ['find_items', { query: 7 }], ['find_items', { kind: 'system' }], ['find_items', { limit: '50' }], ['renewals', { days: 1.5 }], ['renewals', { from: 20270601 }]] as const) failed(await session.call(name, args));
  });
});
test('Reference in another case', async () => {
  await withSession(catalogue(component('editor')), undefined, async session => { expect(ok(await session.call('get_item', { ref: 'Component:default/Editor' })).ref).toBe('component:editor'); });
});
test('Unknown item', async () => {
  await withSession(catalogue(component('editor')), undefined, async session => { expect(failed(await session.call('get_item', { ref: 'component:ghost' }))).toContain('component:ghost'); });
});
test('Other namespace', async () => {
  await withSession(catalogue(component('editor')), undefined, async session => {
    expect(failed(await session.call('get_item', { ref: 'component:payments/editor' }))).toContain('component:payments/editor');
    expect(failed(await session.call('get_item', { ref: 'system:editor' }))).toContain('system:editor');
  });
});
test('Sorted dependants', async () => {
  await withSession(catalogue(editorLicence(), uses('beta', 'resource:licence-editor'), uses('Zed', 'resource:licence-editor'), uses('alpha', 'resource:licence-editor')), undefined, async session => {
    expect(ok(await session.call('get_item', { ref: 'resource:licence-editor' })).dependants).toEqual(['component:Zed', 'component:alpha', 'component:beta']);
  });
});
test('Search by vendor', async () => {
  await withSession(catalogue(editorLicence(), component('editor')), undefined, async session => {
    expect(ok(await session.call('find_items', { query: 'northwind' })).items).toEqual([{ ref: 'resource:licence-editor', kind: 'licence', type: 'licence', owner: 'user:alex' }]);
  });
});
test('Search does not match hidden fields', async () => {
  const root = catalogue(editorLicence({ note: 'renegotiate in March' }));
  await withSession(root, 'staff', async session => { expect(ok(await session.call('find_items', { query: 'renegotiate' }))).toEqual({ catalogue: { view: 'staff' }, items: [], total: 0, truncated: false }); });
  await withSession(root, 'full', async session => { expect(ok(await session.call('find_items', { query: 'renegotiate' })).total).toBe(1); });
});
test('Limit reached', async () => {
  const names = Array.from({ length: 60 }, (_, i) => `app-${String(i).padStart(2, '0')}`);
  await withSession(catalogue(...[...names].reverse().map(name => component(name))), undefined, async session => {
    const result = ok(await session.call('find_items', { limit: 50 }));
    expect(refs(result.items)).toEqual(names.slice(0, 50).map(name => `component:${name}`)); expect(result.total).toBe(60); expect(result.truncated).toBe(true);
  });
});
test('Description of a database is not searched', async () => {
  await withSession(catalogue(database('nightly backup')), undefined, async session => {
    expect(ok(await session.call('find_items', { query: 'backup' })).items).toEqual([]);
    expect(ok(await session.call('find_items', { query: 'orders' })).items).toEqual([{ ref: 'resource:orders-db', kind: 'resource', type: 'database' }]);
  });
});
test('Limit out of range', async () => {
  await withSession(catalogue(component()), undefined, async session => { const reason = failed(await session.call('find_items', { limit: 500 })); expect(reason).toContain('1 to 200'); });
});
test('Item fields', async () => {
  const zoned = set(set(component('editor'), 'metadata.title', 'Northwind Editor'), 'metadata.labels', { 'stackledger/zone': 'finance' });
  await withSession(catalogue(zoned, set(layout(), 'spec', { stations: {}, zones: [{ name: 'finance', title: 'Finance', color: '#123456' }] })), undefined, async session => {
    expect(ok(await session.call('find_items', { zone: 'FINANCE' })).items).toEqual([{ ref: 'component:editor', kind: 'component', title: 'Northwind Editor', type: 'tool', lifecycle: 'active', owner: 'user:alex', zone: 'finance' }]);
  });
});
test('Licence used by two components', async () => {
  await withSession(catalogue(editorLicence(), uses('forge', 'resource:licence-editor'), uses('editor', 'resource:licence-editor')), undefined, async session => {
    expect(ok(await session.call('get_item', { ref: 'resource:licence-editor' }))).toMatchObject({ kind: 'licence', dependants: ['component:editor', 'component:forge'], lines: [] });
  });
});
test('Staff view hides the cost', async () => {
  await withSession(catalogue(editorLicence({ seats: 2, paidBy: 'company', vaultItem: 'Northwind item', note: 'Fictitious' })), 'staff', async session => {
    const result = ok(await session.call('get_item', { ref: 'resource:licence-editor' }));
    expect(result.spec.licence).toEqual({ vendor: 'Northwind Studio', status: 'active' });
  });
});
test('Line stops', async () => {
  await withSession(catalogue(component('editor'), component('forge'), set(line('ship'), 'spec.stops', ['component:forge', 'Component:Editor'])), undefined, async session => {
    expect(ok(await session.call('get_item', { ref: 'line:ship' }))).toMatchObject({ ref: 'line:ship', kind: 'line', stops: ['component:forge', 'component:editor'] });
  });
});
test('Chain of dependants', async () => {
  await withSession(catalogue(component('vault'), uses('forge', 'component:vault'), uses('editor', 'component:forge')), undefined, async session => {
    expect(ok(await session.call('impact', { ref: 'component:vault' }))).toMatchObject({ ref: 'component:vault', dependants: [{ ref: 'component:forge', depth: 1 }, { ref: 'component:editor', depth: 2 }], truncated: false });
  });
});
test('Cycle', async () => {
  await withSession(catalogue(uses('a', 'component:b'), uses('b', 'component:a')), undefined, async session => {
    expect(ok(await session.call('impact', { ref: 'component:a' })).dependants).toEqual([{ ref: 'component:b', depth: 1 }]);
  });
});
test('Journeys affected', async () => {
  await withSession(catalogue(component('vault'), uses('editor', 'component:vault'), component('forge'), set(line('ship'), 'spec.stops', ['component:editor', 'component:forge'])), undefined, async session => {
    expect(ok(await session.call('impact', { ref: 'component:vault' })).lines).toEqual(['line:ship']);
  });
});
test('Impact of a line', async () => {
  await withSession(catalogue(component('a'), component('b'), line('ship')), undefined, async session => { expect(failed(await session.call('impact', { ref: 'line:ship' }))).toContain('line:ship'); });
});
test('More than 500 dependants', async () => {
  const many = Array.from({ length: 501 }, (_, i) => uses(`app-${String(i).padStart(3, '0')}`, 'component:vault'));
  await withSession(catalogue(component('vault'), ...many), undefined, async session => {
    const result = ok(await session.call('impact', { ref: 'component:vault' })); expect(result.dependants).toHaveLength(500); expect(result.truncated).toBe(true);
  });
});
test('Licence nobody uses', async () => {
  await withSession(catalogue(licence('licence-old'), editorLicence(), uses('editor', 'resource:licence-editor')), undefined, async session => { expect(ok(await session.call('gaps')).unusedLicences).toEqual(['resource:licence-old']); });
});
test('Component on no journey', async () => {
  await withSession(catalogue(component('a'), component('b'), component('scanner'), line('ship')), undefined, async session => { expect(ok(await session.call('gaps')).offMap).toEqual(['component:scanner']); });
});
test('Isolated despite being on a line', async () => {
  await withSession(catalogue(component('notes'), uses('editor', 'component:forge'), component('forge'), set(line('ship'), 'spec.stops', ['component:notes', 'component:editor'])), undefined, async session => {
    expect(ok(await session.call('gaps')).isolated).toEqual(['component:notes']);
  });
});
const renewing = (name: string, renewsOn: string, status = 'active') => set(set(licence(name), 'spec.licence.renewsOn', renewsOn), 'spec.licence.status', status);
test('Renewal inside the window', async () => {
  await withSession(catalogue(renewing('licence-editor', '2027-07-01')), undefined, async session => {
    const result = ok(await session.call('renewals', { from: '2027-06-01', days: 30 }));
    expect(result).toMatchObject({ from: '2027-06-01', to: '2027-07-01', overdue: [], unknown: [] }); expect(refs(result.licences)).toEqual(['resource:licence-editor']);
  });
});
test('Overdue renewal', async () => {
  await withSession(catalogue(renewing('licence-editor', '2027-05-20')), undefined, async session => { expect(refs(ok(await session.call('renewals', { from: '2027-06-01' })).overdue)).toEqual(['resource:licence-editor']); });
});
test('Cancelled licence', async () => {
  await withSession(catalogue(renewing('licence-editor', '2027-06-10', 'cancelled')), undefined, async session => { expect(ok(await session.call('renewals', { from: '2027-06-01' }))).toMatchObject({ licences: [], overdue: [], unknown: [] }); });
});
test('Renewal date unknown', async () => {
  await withSession(catalogue(renewing('licence-editor', 'unknown')), undefined, async session => { expect(ok(await session.call('renewals', { from: '2027-06-01' })).unknown).toEqual(['resource:licence-editor']); });
});
test('Days out of range', async () => {
  await withSession(catalogue(component()), undefined, async session => { expect(failed(await session.call('renewals', { days: 400 }))).toContain('0 to 366'); });
});
test('Impossible start date', async () => {
  await withSession(catalogue(component()), undefined, async session => {
    expect(failed(await session.call('renewals', { from: '2027-02-30' }))).toContain('YYYY-MM-DD');
    expect(ok(await session.call('renewals')).from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
test('Same date', async () => {
  await withSession(catalogue(renewing('b-tool', '2027-06-10'), renewing('a-tool', '2027-06-10')), undefined, async session => {
    const result = ok(await session.call('renewals', { from: '2027-06-01' }));
    expect(refs(result.licences)).toEqual(['resource:a-tool', 'resource:b-tool']);
    expect(result.licences[0]).toEqual({ ref: 'resource:a-tool', vendor: 'Northwind Studio', status: 'active', renewsOn: '2027-06-10', cycle: 'monthly', cost: 10, currency: 'GBP' });
  });
});
test('Same result as the command', async () => {
  const root = folder({ 'a.yaml': yaml(uses('editor', 'component:ghost')), 'b.yaml': yaml(set(component('forge'), 'metadata.namespace', 'payments')) });
  const command = JSON.parse(run(['validate', '--json', root]).stdout);
  await withSession(root, undefined, async session => {
    const result = ok(await session.call('validate')); expect(result.summary.errors).toBe(1);
    expect({ problems: result.problems, summary: result.summary }).toEqual(command);
  });
});
test('Clean stdout', async () => {
  const session = await raw(catalogue(component('editor')));
  for (const [name, args] of [...every('full'), ['get_item', { ref: 'component:ghost' }] as [string, Record<string, unknown>]]) await session.call(name, args);
  await session.close();
  const lines = session.transport.raw().split('\n'); expect(lines.pop()).toBe('');
  expect(lines.length).toBeGreaterThanOrEqual(8);
  for (const text of lines) expect(JSON.parse(text)).toMatchObject({ jsonrpc: '2.0' });
});
test('Start line', async () => {
  const root = catalogue(component());
  await withSession(root, 'staff', async session => {
    const lines = (await waitFor(session.stderr, '\n')).split('\n').filter(Boolean);
    expect(lines).toHaveLength(1); expect(lines[0]).toContain(root); expect(lines[0]).toContain('staff'); expect(lines[0]).toContain('4 tools');
  });
});
test('Failed call line', async () => {
  await withSession(catalogue(component()), undefined, async session => {
    await waitFor(session.stderr, 'tools\n');
    failed(await session.call('get_item', { ref: 'component:ghost' }));
    const lines = (await waitFor(session.stderr, 'get_item')).split('\n').filter(Boolean);
    expect(lines).toHaveLength(2); expect(lines[1]).toMatch(/get_item.*component:ghost/);
  });
});
