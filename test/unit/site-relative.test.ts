/** relative.ts on synthetic built files: the rewrite makes Astro's asset URLs relative, and the scan
 * rejects every URL form and inline code it does not allow (site-security, Relative URLs and
 * No inline code; the spike's negative control as a test). Run npm test.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relativise, scan } from '../../src/site/relative.js';
import { POLICY } from '../../src/site/policy.js';
import { folder } from '../helpers.js';

const csp = `<meta http-equiv="Content-Security-Policy" content="${POLICY.replaceAll("'", '&#39;')}">`;
const page = (body: string, head = csp) => `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

test('Astro asset URLs become relative to the file that holds them', () => {
  const site = folder({
    'index.html': page('<link rel="stylesheet" href="/_astro/site.css"><script type="module" src="/_astro/map.js"></script>'),
    'software/editor/index.html': page('<img srcset="/_astro/a.png 1x, /_astro/b.png 2x" src="/_astro/a.png" alt="">'),
    '_astro/site.css': '@font-face{src:url(/_astro/heebo.woff2)}@import "/_astro/more.css";',
    '_astro/map.js': 'import{a}from"./shared.js";a();',
  });
  relativise(site);
  expect(readFileSync(join(site, 'index.html'), 'utf8')).toContain('href="_astro/site.css"');
  expect(readFileSync(join(site, 'index.html'), 'utf8')).toContain('src="_astro/map.js"');
  const nested = readFileSync(join(site, 'software/editor/index.html'), 'utf8');
  expect(nested).toContain('srcset="../../_astro/a.png 1x, ../../_astro/b.png 2x"');
  expect(nested).toContain('src="../../_astro/a.png"');
  expect(readFileSync(join(site, '_astro/site.css'), 'utf8')).toBe('@font-face{src:url(heebo.woff2)}@import "more.css";');
  expect(scan(site)).toEqual([]);
});

test('The scan rejects URL forms and inline code the build does not allow', () => {
  const site = folder({
    'a/index.html': page('<a href="https://example.com/">x</a><a href="//cdn.example">y</a><a href="/full/">z</a><img src="data:image/png;base64,AA" alt="">'),
    'b/index.html': page('<script>alert(1)</script><style>p{}</style><p style="color:red" onclick="x()">t</p>'),
    'c/index.html': page('<p>no policy</p>', ''),
    'site.css': 'a{background:url(https://example.com/x.png)}@import url("//cdn.example/x.css");',
    'lazy.js': 'import("./later.js");new URL("x.png",import.meta.url);fetch("/_astro/x");import{y}from"astro/runtime";',
    'leak.js': 'const path = "/out/.stackledger-tmp-abc/work-full";',
  });
  const problems = scan(site).join('\n');
  for (const expected of ['href="https://example.com/"', 'href="//cdn.example"', 'href="/full/"', 'src="data:image/png;base64,AA"',
    'inline <script>', '<style> element', 'style attribute', 'event-handler attribute onclick', 'c/index.html: CSP meta []',
    'url(https://example.com/x.png)', '@import //cdn.example/x.css', 'dynamic import(', 'import.meta.url', '/_astro/ string',
    'import specifier "astro/runtime"', 'leak.js: staging path in the output']) {
    expect(problems).toContain(expected);
  }
});

test('Escaped hostile text is not mistaken for markup', () => {
  const hostile = '&lt;img src=x onerror=alert(1)&gt; style=&quot;x&quot; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;';
  const site = folder({ 'index.html': page(`<h1>${hostile}</h1><a href="software/x/" title="${hostile}">ok</a>`) });
  expect(scan(site)).toEqual([]);
});
