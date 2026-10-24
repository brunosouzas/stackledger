/** Local host for the browser test (test/browser/site.spec.ts): builds examples/northwind with the
 * built CLI into a new temporary folder, then serves its `full/` and `staff/` sites under /full/ and
 * /staff/ of one origin, as a host behind the proxy would. The example is built with its skill set,
 * examples/northwind-skills (skills-site). A second, small catalogue (a zone named `Team tools`, a skill
 * set with one line, no zones and no rules, `spec.map.backdrop: london`) is built too and its full site served under /extra/.
 *
 * Run through `npm run test:browser` (Playwright starts it as its webServer); needs `npm run build`
 * first. Port: STACKLEDGER_BROWSER_PORT, default 4410. Like the hosts in docs/site.md it redirects a
 * folder path without a trailing slash to the path with one, serves index.html for folders, sends the
 * headers of `_headers`, and answers 404 for anything else (including the output folder's root).
 * The temporary folder is removed when the process ends.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.STACKLEDGER_BROWSER_PORT ?? 4410);
const base = mkdtempSync(join(tmpdir(), 'stackledger-browser-'));
const out = join(base, 'out');
execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'build', join(root, 'examples', 'northwind'), '--out', out, '--date', '2027-06-01',
  '--skills', join(root, 'examples', 'northwind-skills')], { stdio: 'inherit' });

const extra = join(base, 'extra');
const write = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text); };
const doc = (kind, name, spec, metadata = '') => `apiVersion: ${kind === 'Component' ? 'backstage.io/v1alpha1' : 'stackledger/v1alpha1'}\nkind: ${kind}\nmetadata:\n  name: ${name}\n${metadata}spec:\n${spec}`;
const team = '  labels:\n    stackledger/zone: Team tools\n';
const owned = '  type: service\n  lifecycle: production\n  owner: team-a\n';
write(join(extra, 'catalogue', 'catalog-info.yaml'), [
  doc('Component', 'wiki', owned, team), doc('Component', 'chat', owned, team), doc('Component', 'ledger', owned),
  doc('Line', 'work', '  color: "#0072CE"\n  stops: ["component:wiki", "component:chat", "component:ledger"]\n'),
  doc('MapLayout', 'layout', '  stations:\n    "component:wiki": [0, 0]\n    "component:chat": [2, 0]\n    "component:ledger": [4, 0]\n  zones:\n    - { name: Team tools, title: Team tools, color: "#F5A623" }\n'),
].join('---\n'));
// A home link with an icon (catalogue-site, Home links) and the london backdrop (catalogue-site, Map backdrop).
write(join(extra, 'catalogue', 'stackledger.yaml'), doc('Settings', 'settings', '  site:\n    home:\n      links:\n        - { title: Source, url: "https://github.example.com/northwind/", icon: github }\n  map:\n    backdrop: london\n'));
write(join(extra, 'kit', 'notes', 'SKILL.md'), '---\nname: notes\ndescription: Takes Northwind notes.\n---\n');
write(join(extra, 'kit', 'summary', 'SKILL.md'), '---\nname: summary\ndescription: Summarises Northwind notes.\n---\n');
write(join(extra, 'kit', 'stackledger-skills.yaml'), doc('Line', 'notes', '  color: "#E4002B"\n  stops: ["skill:notes", "skill:summary"]\n'));
execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'build', join(extra, 'catalogue'), '--out', join(extra, 'out'), '--date', '2027-06-01',
  '--skills', join(extra, 'kit')], { stdio: 'inherit' });

/** `_headers` lines under `/*` as [name, value] pairs. */
const headers = readFileSync(join(out, '_headers'), 'utf8').split('\n').slice(1).filter(Boolean)
  .map(line => {
    const at = line.indexOf(':');
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.ics': 'text/calendar; charset=utf-8' };

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
  const site = /^\/(full|staff|extra)(\/|$)/.exec(path)?.[1];
  // /extra/ is the small catalogue's full site.
  const top = site === 'extra' ? join(extra, 'out', 'full') : join(out, site ?? '');
  const file = site === 'extra' ? normalize(join(top, path.slice('/extra'.length))) : normalize(join(out, path));
  if (!site || !file.startsWith(top) || file.includes(`${sep}.`)) {
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
