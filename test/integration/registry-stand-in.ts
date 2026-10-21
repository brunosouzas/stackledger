/** A local stand-in for the npm registry that serves one packed tarball as its package, for the
 * package install test. Why: npm reads a package's npm-shrinkwrap.json only when the registry says
 * the version has one (`_hasShrinkwrap`); `npm install ./file.tgz` ignores it and resolves every
 * dependency afresh. Serving the tarball the way the registry would makes the install follow the
 * path `npx stackledger@<version>` takes for users. Every other package document is fetched from
 * registry.npmjs.org; npm downloads their tarballs from there directly (--replace-registry-host never).
 * Used by test/integration/package-install.test.ts; it needs the network.
 */
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';

const upstream = 'https://registry.npmjs.org';

export interface StandIn { url: string; close(): Promise<void> }

export async function serveTarball(tarball: string): Promise<StandIn> {
  const bytes = readFileSync(tarball);
  const extracted = spawnSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' });
  if (extracted.status !== 0) throw new Error(`cannot read package.json from ${tarball}: ${extracted.stderr}`);
  const manifest = JSON.parse(extracted.stdout) as { name: string; version: string };
  const hasShrinkwrap = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).stdout.split('\n').includes('package/npm-shrinkwrap.json');
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  const server: Server = createServer((request, response) => {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (request.url === `/${manifest.name}`) {
      const version = { ...manifest, _hasShrinkwrap: hasShrinkwrap, dist: { tarball: `${base}/${manifest.name}.tgz`, integrity } };
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ name: manifest.name, 'dist-tags': { latest: manifest.version }, versions: { [manifest.version]: version } }));
    } else if (request.url === `/${manifest.name}.tgz`) {
      response.end(bytes);
    } else {
      // Any other package document comes from the real registry; a failure is passed on to npm.
      fetch(upstream + request.url, { headers: { accept: request.headers.accept ?? 'application/json' } })
        .then(async answer => {
          response.statusCode = answer.status;
          response.setHeader('content-type', answer.headers.get('content-type') ?? 'application/json');
          response.end(Buffer.from(await answer.arrayBuffer()));
        })
        .catch((error: Error) => { response.statusCode = 502; response.end(`stand-in registry: ${error.message}`); });
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}
