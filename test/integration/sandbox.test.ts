/** Permission-model proof: same result offline/read-only, plus fixture hashes. Build first.
 * Network denial needs --allow-net support; older Node versions explicitly skip that scenario.
 */
import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { run, demo, root } from './helpers.js';
import { folder } from '../helpers.js';
import { connect } from './mcp-helpers.js';
function hashes(path: string, relative = ''): Record<string, string> {
 const result: Record<string, string> = {};
 for (const name of readdirSync(join(path, relative)).sort()) {
   const file = join(relative, name), absolute = join(path, file);
   if (statSync(absolute).isDirectory()) Object.assign(result, hashes(path, file));
   else result[file] = createHash('sha256').update(readFileSync(absolute)).digest('hex');
 }
 return result;
}
function flags(path: string): string[] { return ['--permission', `--allow-fs-read=${join(root, 'dist')}`, `--allow-fs-read=${join(root, 'node_modules')}`, `--allow-fs-read=${path}`]; }
test('Read-only', () => {
 const fixture = folder(); cpSync(demo, fixture, { recursive: true });
 const before = hashes(fixture), unrestricted = run(['validate', fixture]);
 const restricted = run(['validate', fixture], root, flags(fixture));
 expect(restricted.status).toBe(unrestricted.status); expect(restricted.stdout).toBe(unrestricted.stdout); expect(restricted.status).toBe(0); expect(hashes(fixture)).toEqual(before);
 // Verify this sandbox really denies writes, not merely a no-op CLI under a permissive flag.
 const probe = spawnSync(process.execPath, [...flags(fixture), '-e', 'require("node:fs").writeFileSync(process.argv[1], "not allowed")', join(fixture, 'forbidden')], { encoding: 'utf8' });
 expect(probe.status).not.toBe(0); expect(probe.stderr).toContain('ERR_ACCESS_DENIED'); expect(hashes(fixture)).toEqual(before);
});
const networkSupported = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' }).stdout.includes('--allow-net');
test('Offline run', context => {
 if (!networkSupported) { context.skip('Node does not expose --allow-net; network permission check unavailable'); return; }
 const restricted = run(['validate', demo], root, flags(demo)); const unrestricted = run(['validate', demo]);
 expect(restricted.status).toBe(unrestricted.status); expect(restricted.stdout).toBe(unrestricted.stdout); expect(restricted.status).toBe(0);
 const probe = spawnSync(process.execPath, [...flags(demo), '-e', 'fetch("https://example.invalid").catch(error => { console.error(error.cause?.code ?? error.code); process.exitCode = 1; })'], { encoding: 'utf8' });
 expect(probe.status).not.toBe(0); expect(probe.stderr).toContain('ERR_ACCESS_DENIED');
});
test('Sandboxed session', async context => {
 const fixture = folder(); cpSync(demo, fixture, { recursive: true }); const before = hashes(fixture);
 // Same flags as above: read access to dist, node_modules and the folder only; no write; no network where Node has --allow-net.
 for (const view of ['full', 'staff']) {
  const session = await connect(fixture, view, flags(fixture));
  try {
   const { tools } = await session.client.listTools(); expect(tools).toHaveLength(view === 'full' ? 6 : 4);
   const args: Record<string, Record<string, unknown>> = { get_item: { ref: 'component:editor' }, impact: { ref: 'resource:licence-editor' }, renewals: { from: '2027-06-01' } };
   for (const tool of tools) { const result = await session.call(tool.name, args[tool.name] ?? {}); expect(result.isError ?? false, `${view} ${tool.name}`).toBe(false); }
   expect(session.stderr()).not.toContain('ERR_ACCESS_DENIED');
  } finally { await session.close(); }
 }
 expect(hashes(fixture)).toEqual(before);
 if (!networkSupported) context.annotate('Node does not expose --allow-net; the session ran without the network restriction');
});
