/**
 * Tiny static file server for the spike (task 0.1). Throwaway code.
 *
 * What: serves a build output folder at http://127.0.0.1:<port>/, so the two
 * sites live at /full/ and /staff/ of one host, the way a proxy would serve them.
 * Why: the browser check must prove that no request leaves a site's prefix.
 * Run: imported by browser-check.mjs (startServer), or
 *      node serve.mjs <out> [port]   (Ctrl+C to stop).
 * What can go wrong: a folder URL without a trailing slash gets 404 on purpose
 * (the real host must redirect, see design D3); paths outside <out> get 403.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

export function startServer(root, port = 0) {
  const base = resolve(root);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      let file = resolve(join(base, pathname));
      if (file !== base && !file.startsWith(base + sep)) {
        response.writeHead(403).end();
        return;
      }
      if (pathname.endsWith('/')) file = join(file, 'index.html');
      const info = await stat(file).catch(() => undefined);
      if (!info?.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(await readFile(file));
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => resolveServer(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer(process.argv[2] ?? '.', Number(process.argv[3] ?? 8080));
  console.log(`serving on http://127.0.0.1:${server.address().port}/`);
}
