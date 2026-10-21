/** The generic proxy example, examples/hosting/Caddyfile, in front of a built Northwind site
 * (hosting-recipes spec). Run npm run build && npm test, with `caddy` on PATH; without it the test
 * is skipped and says so (CI installs a pinned Caddy, see .github/workflows/test.yml).
 *
 * Caddy runs the example with its site address, auth upstream and site root replaced by test
 * values, on free local ports. A small Node server stands in for oauth2-proxy's /oauth2/auth: the
 * test header X-Test-Session picks the answer (absent: 401, not signed in; otherwise 202 with the
 * X-Auth-Request-Groups the test chose, or none). It can be stopped to test "auth service down".
 * Caddy's config, data and home folders are temporary; both processes are stopped in afterAll.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative } from 'node:path';
import { tempFolder, removeFolder } from './package-helpers.js';
import { toolOrSkip } from '../tools.js';
import { cli, root } from './helpers.js';

const caddy = toolOrSkip('caddy', 'hosting-caddy.test.ts');
const example = readFileSync(join(root, 'examples', 'hosting', 'Caddyfile'), 'utf8');
/** The fictitious values in the example that the test replaces. */
const placeholders = { site: 'catalogue.example.org', auth: '127.0.0.1:4180', root: '/srv/stackledger/publish' };

/** Groups the stand-in returns per X-Test-Session value; null means signed in without groups. */
const sessions: Record<string, string | null> = { staff: 'staff', finance: 'staff,finance', contractors: 'contractors', nogroups: null };

const freePort = () => new Promise<number>(resolve => {
  const probe = createServer().listen(0, '127.0.0.1', () => { const { port } = probe.address() as AddressInfo; probe.close(() => resolve(port)); });
});

describe.runIf(caddy)('Caddy in front of oauth2-proxy (examples/hosting/Caddyfile)', () => {
  let proxy: ChildProcess | undefined, auth: Server | undefined, base = '', publish = '', caddyLog = '';
  let fullAsset = '', staffAsset = '', work = '';

  beforeAll(async () => {
    // A built Northwind site, published as the template does: only the four entries.
    work = tempFolder('hosting');
    const out = join(work, 'out');
    publish = join(work, 'publish');
    const built = spawnSync(process.execPath, [cli, 'build', join(root, 'examples', 'northwind'), '--out', out, '--date', '2027-06-01'], { encoding: 'utf8', timeout: 240_000, env: { ...process.env, NODE_OPTIONS: '' } });
    if (built.status !== 0) throw new Error(`build failed: ${built.stderr}`);
    mkdirSync(publish);
    for (const entry of ['full', 'staff', '_headers', 'robots.txt']) cpSync(join(out, entry), join(publish, entry), { recursive: true });
    const asset = (site: string) => {
      const files = readdirSync(join(publish, site), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() && /\.(css|js)$/.test(entry.name));
      return `/${relative(publish, join(files[0]!.parentPath, files[0]!.name))}`;
    };
    fullAsset = asset('full'); staffAsset = asset('staff');

    // The oauth2-proxy stand-in.
    auth = createServer((request, response) => {
      const session = request.headers['x-test-session'];
      if (request.url?.split('?')[0] !== '/oauth2/auth' || typeof session !== 'string' || !(session in sessions)) {
        response.statusCode = 401; response.end('stand-in: not signed in'); return;
      }
      const groups = sessions[session];
      if (groups !== null) response.setHeader('X-Auth-Request-Groups', groups!);
      response.statusCode = 202; response.end();
    });
    await new Promise<void>(resolve => auth!.listen(0, '127.0.0.1', resolve));
    const authPort = (auth.address() as AddressInfo).port, port = await freePort();

    for (const value of Object.values(placeholders)) if (!example.includes(value)) throw new Error(`examples/hosting/Caddyfile no longer holds ${value}`);
    const config = `{\n\tadmin off\n\tauto_https off\n}\n\n${example
      .replaceAll(placeholders.site, `http://127.0.0.1:${port}`)
      .replaceAll(placeholders.auth, `127.0.0.1:${authPort}`)
      .replaceAll(placeholders.root, publish)}`;
    const file = join(work, 'Caddyfile');
    writeFileSync(file, config);
    const home = join(work, 'caddy-home');
    mkdirSync(home);
    proxy = spawn(caddy!, ['run', '--config', file, '--adapter', 'caddyfile'], {
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_DATA_HOME: join(home, 'data') }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    proxy.stdout!.on('data', chunk => { caddyLog += chunk; });
    proxy.stderr!.on('data', chunk => { caddyLog += chunk; });
    base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; ; attempt++) {
      try { await fetch(`${base}/`, { redirect: 'manual' }); break; } catch {
        if (attempt > 100 || proxy.exitCode !== null) throw new Error(`Caddy did not start:\n${caddyLog}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, 300_000);

  afterAll(async () => {
    if (proxy && proxy.exitCode === null) {
      const stopped = new Promise<void>(resolve => proxy!.once('exit', () => resolve()));
      proxy.kill('SIGTERM'); await stopped;
    }
    await new Promise<void>(resolve => auth ? auth.close(() => resolve()) : resolve());
    removeFolder(work);
  }, 60_000);

  /** One request as `session` (undefined: no session), optionally with a forged groups header. */
  async function get(path: string, session?: string, forgedGroups?: string) {
    const headers: Record<string, string> = {};
    if (session) headers['X-Test-Session'] = session;
    if (forgedGroups) headers['X-Auth-Request-Groups'] = forgedGroups;
    const response = await fetch(`${base}${path}`, { headers, redirect: 'manual' });
    return { status: response.status, body: await response.text(), type: response.headers.get('content-type') ?? '' };
  }
  /** The file Caddy should serve for `path` (a folder serves its index.html). */
  const file = (path: string) => readFileSync(join(publish, path.endsWith('/') ? `${path}index.html` : path), 'utf8');
  /** No site content: none of the files the paths would serve appears in the body. */
  const servesNothing = (body: string) => !/<html|Northwind/i.test(body);

  test('Anonymous request: no site content on any path', async () => {
    for (const path of ['/', '/staff/', '/full/', '/full/renewals.ics', fullAsset, staffAsset]) {
      const answer = await get(path);
      expect(answer.status, path).not.toBe(200);
      expect(servesNothing(answer.body), path).toBe(true);
      // The host has no page at /; every other path names a published file.
      if (path !== '/') expect(answer.body, path).not.toBe(file(path));
    }
  });

  test('Staff identity: /staff/ is served, every /full/ path answers 403', async () => {
    const staff = await get('/staff/', 'staff');
    expect(staff.status).toBe(200);
    expect(staff.body).toBe(file('/staff/'));
    for (const path of ['/full/', '/full/renewals.ics', fullAsset]) {
      const answer = await get(path, 'staff');
      expect(answer.status, path).toBe(403);
      expect(answer.body, path).toBe('');
    }
  });

  test('Finance identity: /full/ and /staff/ are served', async () => {
    for (const path of ['/full/', '/staff/', '/full/renewals.ics']) {
      const answer = await get(path, 'finance');
      expect(answer.status, path).toBe(200);
      expect(answer.body, path).toBe(file(path));
    }
    expect((await get('/full/renewals.ics', 'finance')).type).toMatch(/^text\/calendar/);
  });

  test('Signed in without an allowed group: every path answers 403', async () => {
    for (const session of ['nogroups', 'contractors']) {
      for (const path of ['/', '/staff/', '/full/']) {
        const answer = await get(path, session);
        expect(answer.status, `${session} ${path}`).toBe(403);
        expect(answer.body, `${session} ${path}`).toBe('');
      }
    }
  });

  test('Forged group header: the client cannot claim finance', async () => {
    expect((await get('/full/', 'staff', 'finance')).status).toBe(403);
    expect((await get('/full/', 'nogroups', 'finance')).status).toBe(403);
    expect((await get('/staff/', 'nogroups', 'finance')).status).toBe(403);
    expect((await get('/staff/', 'nogroups', 'staff')).status).toBe(403);
  });

  // Last: it stops the stand-in for good.
  test('Auth service down: every path answers an error with no site content', async () => {
    await new Promise<void>(resolve => auth!.close(() => resolve()));
    auth = undefined;
    for (const session of [undefined, 'finance']) {
      for (const path of ['/', '/staff/', '/full/', '/full/renewals.ics', fullAsset]) {
        const answer = await get(path, session);
        expect(answer.status, `${session} ${path}`).toBeGreaterThanOrEqual(500);
        expect(servesNothing(answer.body), `${session} ${path}`).toBe(true);
      }
    }
  });
});
