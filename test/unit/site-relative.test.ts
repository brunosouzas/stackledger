/** relative.ts on synthetic built files: the rewrite makes Astro's asset URLs relative, and the scan
 * rejects every URL form and inline code it does not allow (site-security, Relative URLs and
 * No inline code; the spike's negative control as a test). Run npm test.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeAttribute, relativise, scan } from '../../src/site/relative.js';
import { POLICY } from '../../src/site/policy.js';
import { folder } from '../helpers.js';

const csp = `<meta http-equiv="Content-Security-Policy" content="${POLICY.replaceAll("'", '&#39;')}">`;
const page = (body: string, head = csp) => `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}</body></html>`;

// site-security, No external requests: a home link's URL passes only as an a href of the root index.html.
test('Link URL outside the home', () => {
  const url = 'https://example.org/articles/?a=1&b=2';
  const escaped = url.replaceAll('&', '&amp;');
  const site = folder({
    'index.html': page(`<a href="${escaped}" rel="noopener noreferrer">Articles</a><img src="${escaped}" alt="">`),
    'software/index.html': page(`<a href="${escaped}">Articles</a>`),
  });
  const problems = scan(site, [], [url]);
  expect(problems).toEqual([`index.html: src="${url}"`, `software/index.html: href="${url}"`]);
  // Without the list, the home anchor is refused too; an unlisted URL on the home is still refused.
  expect(scan(site)).toContain(`index.html: href="${url}"`);
  // A quoted `>` does not end the tag early: the absolute URL after it is still seen.
  const quoted = folder({ 'software/index.html': page('<a href="https://evil.example/a>b">x</a>') });
  expect(scan(quoted)).toEqual(['software/index.html: href="https://evil.example/a>b"']);
  const other = folder({ 'index.html': page('<a href="https://other.example/">x</a>') });
  expect(scan(other, [], [url])).toEqual(['index.html: href="https://other.example/"']);
});
// site-security, No external requests: over a city backdrop, the OpenStreetMap copyright URL passes only
// as an a href of map/index.html.
test('Credit URL outside the map page', () => {
  const url = 'https://www.openstreetmap.org/copyright';
  const anchor = `<a href="${url}" rel="noopener noreferrer">OpenStreetMap contributors</a>`;
  const site = folder({
    'map/index.html': page(anchor),
    'index.html': page(anchor),
    'software/index.html': page(`<img src="${url}" alt="">`),
  });
  expect(scan(site, [], [], true)).toEqual([`index.html: href="${url}"`, `software/index.html: src="${url}"`]);
  // Without a city backdrop the map page's anchor is refused too.
  expect(scan(site)).toContain(`map/index.html: href="${url}"`);
  // A src on the map page, or another URL there, is still refused.
  const other = folder({ 'map/index.html': page(`<img src="${url}" alt=""><a href="https://www.openstreetmap.org/">x</a>`) });
  expect(scan(other, [], [], true)).toEqual([`map/index.html: src="${url}"`, 'map/index.html: href="https://www.openstreetmap.org/"']);
});
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
  const problems = scan(site, ['/out/.stackledger-tmp-abc']).join('\n');
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

test('The scan rejects relative URLs that resolve outside the site folder', () => {
  const site = folder({
    'software/editor/index.html': page('<a href="../../../full/licences/private/">x</a><img src="../../_astro/ok.png" alt=""><img srcset="../../_astro/a.png 1x, ../../../b.png 2x" alt="">'),
    'index.html': page('<a href="..">up</a><a href="software/%2e%2e/%2e%2e/full/">dots</a><a href="software/..%2F..%2Ffull/">slash</a><a href="..\\full\\">back</a>'),
    '_astro/site.css': 'a{background:url(../../full/x.png)}@import "../../staff/x.css";b{background:url(ok.png)}i{background:url("../_astro/ok.png")}',
    '_astro/map.js': 'import{a}from"../../full/licences.js";export{b}from"./shared.js";import"../ok.js";',
  });
  const problems = scan(site);
  expect(problems).toEqual([
    '_astro/map.js: import specifier "../../full/licences.js" leaves the site folder',
    '_astro/site.css: url(../../full/x.png) leaves the site folder',
    '_astro/site.css: @import ../../staff/x.css leaves the site folder',
    'index.html: href=".." leaves the site folder',
    'index.html: href="software/%2e%2e/%2e%2e/full/" leaves the site folder',
    'index.html: href="software/..%2F..%2Ffull/" leaves the site folder',
    'index.html: href="..\\full\\" leaves the site folder',
    'software/editor/index.html: href="../../../full/licences/private/" leaves the site folder',
    'software/editor/index.html: srcset part "../../../b.png 2x" leaves the site folder',
  ]);
});

test('Catalogue text naming staging folders is not a leak; the build\'s own paths are', () => {
  const site = folder({
    'index.html': page('<p>Clean up .stackledger-tmp-* after a crashed build</p>'),
    'leak.js': 'const path = "/out/.stackledger-tmp-3f9a/work-full/src";',
  });
  expect(scan(site, ['/out/.stackledger-tmp-3f9a', '/out/.stackledger-tmp-3f9a/work-full'])).toEqual(['leak.js: staging path in the output']);
});

test('Character references are decoded as a browser decodes them', () => {
  expect(decodeAttribute('&#47;&#x2F;&#X2f;&sol;&colon;&Tab;&NewLine;&amp;&#46&#0;&#x110000;&#128;')).toEqual({
    text: '////:\t\n&.\ufffd\ufffd\u20ac',
    unknown: [],
  });
  // A named reference needs its semicolon; an unknown name is reported, not guessed.
  expect(decodeAttribute('&sol x &copy; &frasl;')).toEqual({ text: '&sol x &copy; &frasl;', unknown: ['&copy;', '&frasl;'] });
});

test('The scan decodes character references and drops tabs and newlines before it checks a URL', () => {
  const tab = '\t';
  const site = folder({
    'index.html': page([
      '<a href="&#47;full/">a</a>',
      '<a href="&#x2F;&#x2F;evil.example/">b</a>',
      '<a href="ht&Tab;tps://x/root/">c</a>',
      `<a href="ht${tab}tps://x/root/">d</a>`,
      '<a href="&sol;&sol;evil.example">e</a>',
      '<a href="javascript&colon;alert(1)">f</a>',
      '<a href="&#46;&#46;/full/">g</a>',
      '<a href="&NewLine;/full/">h</a>',
      '<a href="&#47">i</a>',
      '<a href="x&frasl;y">j</a>',
    ].join('')),
  });
  expect(scan(site)).toEqual([
    'index.html: href="/full/"',
    'index.html: href="//evil.example/"',
    `index.html: href="ht${tab}tps://x/root/"`,
    `index.html: href="ht${tab}tps://x/root/"`,
    'index.html: href="//evil.example"',
    'index.html: href="javascript:alert(1)"',
    'index.html: href="../full/" leaves the site folder',
    'index.html: href="\n/full/"',
    'index.html: href="/"',
    'index.html: href="x&frasl;y" has an unknown character reference &frasl;',
  ]);
});

test('Relative URLs with query strings, fragments and escaped ampersands still pass', () => {
  const site = folder({
    'index.html': page('<a href="software/?view=table&amp;sort=name#licences">a</a><a href="?q=a&#38;b=c#top">b</a><a href="#main">c</a><a href="">d</a>'),
    'software/editor/index.html': page('<a href="../../journeys/?line=ship&amp;from=editor#stop-2">a</a><a href="./#neighbourhood">b</a><a href="../">c</a>'),
    '_astro/site.css': 'a{background:url("icons.svg#map")}',
  });
  expect(scan(site)).toEqual([]);
});

test('A CSS URL holding an escape is refused', () => {
  const site = folder({ '_astro/site.css': 'a{background:url(\\2f full/x.png)}' });
  expect(scan(site)).toEqual(['_astro/site.css: url(\\2f full/x.png) has a CSS escape']);
});

test('A no-break space does not split a srcset candidate', () => {
  const site = folder({ 'software/editor/index.html': page('<img srcset="ok\u00a0/../../../../full/x.png 1x" alt="">') });
  expect(scan(site)).toEqual(['software/editor/index.html: srcset part "ok\u00a0/../../../../full/x.png 1x" leaves the site folder']);
});

test('An import specifier holding a string escape is refused', () => {
  const site = folder({ '_astro/map.js': 'import "./\\x2e\\x2e/\\x2e\\x2e/full/x.js";' });
  expect(scan(site)).toEqual(['_astro/map.js: import specifier "./\\x2e\\x2e/\\x2e\\x2e/full/x.js" has a string escape']);
});
