/** Local host for the browser test (test/browser/site.spec.ts): builds examples/northwind with the
 * built CLI into a new temporary folder, then serves its `full/` and `staff/` sites under /full/ and
 * /staff/ of one origin, as a host behind the proxy would.
 *
 * Run through `npm run test:browser` (Playwright starts it as its webServer); needs `npm run build`
 * first. Port: STACKLEDGER_BROWSER_PORT, default 4410. Like the hosts in docs/site.md it redirects a
 * folder path without a trailing slash to the path with one, serves index.html for folders, sends the
 * headers of `_headers`, and answers 404 for anything else (including the output folder's root).
 * The temporary folder is removed when the process ends.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.STACKLEDGER_BROWSER_PORT ?? 4410);
const base = mkdtempSync(join(tmpdir(), 'stackledger-browser-'));
const out = join(base, 'out');
execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'build', join(root, 'examples', 'northwind'), '--out', out, '--date', '2027-06-01'], { stdio: 'inherit' });

/** `_headers` lines under `/*` as [name, value] pairs. */
const headers = readFileSync(join(out, '_headers'), 'utf8').split('\n').slice(1).filter(Boolean)
  .map(line => {
    const at = line.indexOf(':');
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function isFolder(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  const site = /^\/(full|staff)(\/|$)/.exec(path)?.[1];
  const file = normalize(join(out, path));
  if (!site || !file.startsWith(join(out, site)) || file.includes(`${sep}.`)) {
    response.writeHead(404).end('Not found');
    return;
  }
  if (isFolder(file) && !path.endsWith('/')) {
    response.writeHead(301, { Location: `${path}/` }).end();
    return;
  }
  const target = isFolder(file) ? join(file, 'index.html') : file;
  try {
    const body = readFileSync(target);
    response.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream', ...Object.fromEntries(headers) });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const stop = () => {
  server.close();
  rmSync(base, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.listen(port, '127.0.0.1', () => console.log(`Serving ${out} at http://127.0.0.1:${port}/full/ and /staff/`));
