/** Build-output tests of both sites (catalogue-site task 3.4): every catalogue-site and site-security
 * scenario that can be checked on the built files, and the site scenarios of licence-reports (task 3.1). Build first with npm run build; the sites are
 * built once per fixture in beforeAll (in parallel child processes) and then only read.
 * Fixtures are fictitious; hidden values are distinctive so that any leak shows.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import { join } from 'node:path';
import { component, licence, line, set, settings } from '../unit/helpers.js';
import { yaml } from './mcp-helpers.js';
import { root } from './helpers.js';
import { buildSites, cleanup, pages, read, tree, type Built } from './site-helpers.js';

const POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const DEFAULT_HIDDEN = { cycle: 'one-off', cost: 98765, currency: 'QZX', renewsOn: '2031-07-19', seats: 97531, paidBy: 'PAYER-OMEGA', vaultItem: 'VAULT-SIGMA', note: 'ZETA-NOTE' };
const OTHER_HIDDEN = { cycle: 'monthly', cost: 12, currency: 'EUR', renewsOn: '2027-06-10', seats: 2, paidBy: 'PAYER-B', vaultItem: 'VAULT-B', note: 'NOTE-B' };

const depends = (document: unknown, refs: string[]) => set(document, 'spec.dependsOn', refs);
const stops = (name: string, names: string[]) => set(line(name), 'spec.stops', names.map(item => `component:${item}`));
const settingsFile = (spec: unknown) => yaml(settings('settings', spec));

function licenceWith(name: string, fields: Record<string, unknown>): unknown {
  let document: unknown = licence(name);
  for (const [field, value] of Object.entries(fields)) document = set(document, `spec.licence.${field}`, value);
  return document;
}

/** The main fixture: editor -> forge -> vault, forge -> orders-db, lines ship, design and old. */
function mainCatalogue(hidden: Record<string, unknown>): Record<string, string> {
  return {
    'catalogue.yaml': yaml(
      depends(set(component('editor'), 'metadata.title', 'Northwind Editor'), ['resource:licence-editor', 'component:forge']),
      depends(component('forge'), ['component:vault', 'resource:orders-db']),
      component('vault'), component('slack'), component('linear'), component('figma'),
      { apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'orders-db' }, spec: { type: 'database', owner: 'user:alex' } },
      licenceWith('licence-editor', hidden),
      stops('ship', ['linear', 'editor', 'slack']),
      set(stops('design', ['figma', 'editor', 'slack']), 'spec.color', '#0098D4'),
      // "old" keeps one served stop: ghost does not exist (an error), so the line is not drawn.
      set(stops('old', ['editor', 'ghost']), 'spec.color', '#00782A'),
    ),
    'stackledger.yaml': settingsFile({ site: { title: 'Northwind software', colors: { accent: '#E4002B' } } }),
  };
}

function customHidden(vendor: string, status: string): Record<string, string> {
  const lifecycle = (name: string) => set(component(name), 'spec.lifecycle', 'production');
  return {
    'catalogue.yaml': yaml(depends(lifecycle('editor'), ['resource:licence-editor']), lifecycle('forge'),
      licenceWith('licence-editor', { vendor, status }), stops('ship', ['editor', 'forge'])),
    'stackledger.yaml': settingsFile({ views: { staff: { hide: ['vendor', 'status'] } } }),
  };
}

const brokenCatalogue = {
  'catalogue.yaml': yaml(depends(component('editor'), ['resource:licence-editor']), component('forge'), licenceWith('licence-editor', DEFAULT_HIDDEN)),
  'stackledger.yaml': settingsFile({ site: { title: 'Northwind software', colors: { primary: 'red', accent: '#E4002B' } } }),
};

const hostileComponent = '<img src=x onerror=alert(1)>';
const hostileLine = '</script><script>alert(1)</script>';
const hostileCatalogue = {
  'catalogue.yaml': yaml(set(component('editor'), 'metadata.title', hostileComponent), component('forge'),
    set(stops('ship', ['editor', 'forge']), 'metadata.title', hostileLine)),
};

let main: Built, other: Built, customA: Built, customB: Built, broken: Built, hostile: Built, example: Built;

beforeAll(async () => {
  const exampleFiles = Object.fromEntries(['catalog-info.yaml', 'stackledger.yaml'].map(file => [file, read(join(root, 'examples/northwind'), file)]));
  [main, other, customA, customB, broken, hostile, example] = await Promise.all([
    buildSites(mainCatalogue(DEFAULT_HIDDEN), '2027-06-01'),
    buildSites(mainCatalogue(OTHER_HIDDEN), '2031-01-01'),
    buildSites(customHidden('Northwind Studio', 'to-confirm'), '2027-06-01'),
    buildSites(customHidden('Zeta Supplies', 'expired'), '2027-06-01'),
    buildSites(brokenCatalogue),
    buildSites(hostileCatalogue),
    buildSites(exampleFiles),
  ]);
}, 180_000);

// Removing seven built sites can take more than the default 10 s while other test files run.
afterAll(cleanup, 60_000);

const tagsOf = (html: string) => [...html.matchAll(/<([A-Za-z][A-Za-z0-9:-]*)((?:\s[^<>]*?)?)\/?>/g)].map(match => ({ name: match[1]!.toLowerCase(), attrs: match[2] ?? '' }));
const attrsOf = (text: string) => [...text.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map(match => ({ name: match[1]!.toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' }));
const decode = (value: string) => value.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');

// catalogue-site

test('Item pages', () => {
  for (const site of [main.full, main.staff]) {
    for (const page of ['software/editor/index.html', 'software/forge/index.html', 'licences/licence-editor/index.html']) expect(pages(site)).toContain(page);
  }
  expect(pages(main.full)).not.toContain('licences/orders-db/index.html');
});

test('No journeys', () => {
  for (const site of [broken.full, broken.staff]) {
    expect(read(site, 'index.html')).toContain('No journeys yet');
    expect(read(site, 'journeys/index.html')).toContain('There are no journeys yet.');
  }
});

test('Site title', () => {
  for (const site of [main.full, main.staff]) {
    for (const page of pages(site)) {
      const html = read(site, page);
      expect(html, page).toMatch(/<title>[^<]* \| Northwind software<\/title>/);
      expect(html, page).toMatch(/<a class="navbar-brand" href="[^"]*">Northwind software<\/a>/);
    }
  }
});

test('View in the footer', () => {
  for (const page of pages(main.staff)) expect(read(main.staff, page), page).toMatch(/<footer[\s\S]*staff view · stackledger \d+\.\d+\.\d+/);
  expect(read(main.full, 'index.html')).toMatch(/<footer[\s\S]*full view · stackledger/);
});

/** --color-accent of the light theme (top-level :root rules, last wins) and of the chosen dark theme. */
function accents(site: string): { light: string | undefined; dark: string | undefined } {
  const css = [...tree(site)].filter(([file]) => file.endsWith('.css')).map(([, text]) => text).join('\n');
  let light: string | undefined, dark: string | undefined, depth = 0, selector = '';
  for (const match of css.matchAll(/([^{}]*)([{}])/g)) {
    if (match[2] === '{') {
      if (depth === 0) selector = match[1]!.trim();
      depth++;
      continue;
    }
    if (depth === 1) {
      const value = /--color-accent:\s*([^;}]+)/.exec(match[1]!)?.[1]?.trim().toLowerCase();
      if (value && selector === ':root') light = value;
      if (value && /^:root\[data-theme=("?)dark\1\]$/.test(selector)) dark = value;
    }
    depth--;
  }
  return { light, dark };
}

test('Accent override', () => {
  expect(accents(main.full)).toEqual({ light: '#e4002b', dark: '#9da8ff' });
  expect(accents(main.staff)).toEqual({ light: '#e4002b', dark: '#9da8ff' });
});

test('Broken settings', () => {
  for (const site of [broken.full, broken.staff]) {
    expect(accents(site)).toEqual({ light: '#000f9f', dark: '#9da8ff' });
    expect(read(site, 'index.html')).toContain('<title>Map | Software map</title>');
    expect(read(site, 'index.html')).not.toContain('Northwind software');
  }
});

test('Journeys', () => {
  const html = read(main.full, 'software/editor/index.html');
  expect(html).toContain('href="../../journeys/design/"');
  expect(html).toContain('href="../../journeys/ship/"');
});

test('Line with one served stop', () => {
  for (const site of [main.full, main.staff]) {
    const html = read(site, 'software/editor/index.html');
    expect(html).toContain('<span>old</span>');
    expect(html).not.toContain('journeys/old/');
    expect(pages(site)).not.toContain('journeys/old/index.html');
  }
});

test('Staff licence page', () => {
  const html = read(main.staff, 'licences/licence-editor/index.html');
  expect(html).toContain('<dt>Vendor</dt><dd>Northwind Studio</dd>');
  expect(html).toContain('<dt>Status</dt><dd>active</dd>');
  for (const label of ['Cost', 'Currency', 'Cycle', 'Renews on', 'Paid by', 'Seats', 'Vault item', 'Note']) expect(html).not.toContain(`<dt>${label}</dt>`);
  for (const value of Object.values(DEFAULT_HIDDEN)) expect(html).not.toContain(String(value));
  // The full site shows them.
  expect(read(main.full, 'licences/licence-editor/index.html')).toContain('<dt>Cost</dt><dd>98765</dd>');
});

test('Indirect dependant', () => {
  const html = read(main.full, 'software/vault/index.html');
  expect(html).toContain('<td><a href="../../software/forge/">forge</a></td><td>1</td>');
  expect(html).toContain('<td><a href="../../software/editor/">Northwind Editor</a></td><td>2</td>');
});

test('Interchange on a strip', () => {
  const html = read(main.full, 'journeys/ship/index.html');
  // The strip shows slack's stop with the design badge, which links to the design journey.
  expect(html).toMatch(/<g data-ref="component:slack" data-line="line:ship line:design">/);
  expect(html).toMatch(/<g data-ref="line:design" data-line="line:design"><title>design<\/title>/);
  const list = /<ol class="stop-list">([\s\S]*?)<\/ol>/.exec(html)![1]!;
  expect(list).toContain('<a href="../../software/slack/">slack</a>');
  expect(list).toContain('<a href="../../journeys/design/">design</a>');
});

test('Diagram alternative', () => {
  const html = read(main.full, 'software/forge/index.html');
  expect(html).toMatch(/<div class="diagram[^"]* themed-light"><svg [^>]*role="img"/);
  const dependencies = /<ul class="plain-list" data-dependencies>([\s\S]*?)<\/ul>/.exec(html)![1]!;
  expect(dependencies).toContain('<span>orders-db</span>');
  expect(dependencies).toContain('<a href="../../software/vault/">vault</a>');
  const dependants = /<ul class="plain-list" data-dependants>([\s\S]*?)<\/ul>/.exec(html)![1]!;
  expect(dependants).toContain('<a href="../../software/editor/">Northwind Editor</a>');
});

test('Without JavaScript (table present)', () => {
  const html = read(example.full, 'software/index.html');
  const rows = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)![1]!.match(/<tr>/g) ?? [];
  expect(rows).toHaveLength(17 + 13);
  expect(html).not.toMatch(/<tr[^>]*hidden/);
  expect(html).toMatch(/data-list-tools hidden/);
});

test('Map page legends in HTML, not in the map', () => {
  for (const site of [example.full, example.staff]) {
    const html = read(site, 'index.html');
    const svg = /<div class="map-canvas themed-light">([\s\S]*?)<\/div>/.exec(html)![1]!;
    for (const chrome of ['Lines (journeys)', '>Symbols<', 'stackledger · ']) expect(svg).not.toContain(chrome);
    expect(svg).toContain('data-ref="component:slack"');
    // The line chips are the legend, shown without JavaScript too; the symbols are listed under them.
    expect(html).toMatch(/<div class="map-lines" data-map-lines>/);
    const symbols = /<ul class="map-symbols">([\s\S]*?)<\/ul>/.exec(html)![1]!;
    for (const label of ['Interchange', 'Licence', 'Licence to buy']) expect(symbols).toContain(label);
    expect(symbols.includes('Renewal within 30 days')).toBe(site === example.full);
  }
});

test('Owners by name', () => {
  for (const site of [example.full, example.staff]) {
    expect(read(site, 'software/slack/index.html')).toContain('<dt>Owner</dt><dd>Northwind team</dd>');
    expect(read(site, 'licences/licence-slack/index.html')).toContain('<dt>Owner</dt><dd>Northwind team</dd>');
    const list = read(site, 'software/index.html');
    expect(list).toContain('<td data-column="owner">Northwind team</td>');
    expect(list).toContain('<option value="Northwind team">Northwind team</option>');
    expect(list).not.toContain('group:northwind');
  }
  // Without an owner document, the reference itself is shown.
  expect(read(main.full, 'software/editor/index.html')).toContain('<dt>Owner</dt><dd>user:alex</dd>');
});

test('Reports in full only', () => {
  for (const built of [main, example]) {
    expect(pages(built.full)).toContain('reports/index.html');
    expect(tree(built.full).has('renewals.ics')).toBe(true);
    expect(pages(built.staff)).not.toContain('reports/index.html');
    expect(tree(built.staff).has('renewals.ics')).toBe(false);
  }
});

const REPORTS_LINK = /<a class="nav-link" href="(?:\.\.\/)*reports\/"[^>]*>Reports<\/a>/;

test('Reports link', () => {
  for (const page of pages(main.full)) {
    const header = /<header[\s\S]*?<\/header>/.exec(read(main.full, page))![0];
    expect(header, page).toMatch(REPORTS_LINK);
  }
  for (const page of pages(main.staff)) expect(read(main.staff, page), page).not.toContain('>Reports<');
  // Relative from a nested page too.
  expect(read(main.full, 'software/editor/index.html')).toContain('<a class="nav-link" href="../../reports/">Reports</a>');
});

// licence-reports

test('Not in staff', () => {
  for (const built of [main, example, broken]) {
    expect(pages(built.staff).some(page => page.startsWith('reports/'))).toBe(false);
    for (const [file, content] of tree(built.staff)) {
      for (const value of ['renewals.ics', 'reports/', '>Reports<', 'Recurring cost']) expect(content.includes(value), `${file} ${value}`).toBe(false);
    }
  }
});

test('Site report date', () => {
  const html = read(example.full, 'reports/index.html');
  expect(html).toContain('Licence costs and renewals on 2027-06-01, with renewals up to 2027-08-30 (90 days).');
  const calendar = read(example.full, 'renewals.ics');
  const stamps = [...calendar.matchAll(/^DTSTAMP:(.*)\r$/gm)].map(match => match[1]);
  expect(stamps.length).toBeGreaterThan(0);
  for (const stamp of stamps) expect(stamp).toBe('20270601T000000Z');
  // Another build date moves the report with it.
  expect(read(other.full, 'reports/index.html')).toContain('renewals on 2031-01-01, with renewals up to 2031-04-01');
});

test('Page content', () => {
  const html = read(example.full, 'reports/index.html');
  const recurring = /<table data-report="recurring">([\s\S]*?)<\/table>/.exec(html)![1]!;
  expect(recurring).toContain('<th scope="col" class="amount">Per month</th><th scope="col" class="amount">Per year</th>');
  expect(recurring).toContain('<tr><td>GBP</td><td class="amount">120.00</td><td class="amount">1440.00</td><td class="amount">0</td></tr>');
  expect(html).toMatch(/<a class="btn" href="\.\.\/renewals\.ics" download="renewals\.ics">/);
  // Each licence links to its page.
  expect(html).toContain('<a href="../licences/licence-github/">');
  for (const heading of ['Renewals', 'Overdue', 'Unknown renewal dates', 'By owner', 'By payer', 'By zone', 'One-off costs', 'Planned purchases', 'Incomplete licences']) {
    expect(html, heading).toMatch(new RegExp(`<h2 id="[^"]+">${heading}</h2>`));
  }
});

test('Empty report', () => {
  expect(read(hostile.full, 'reports/index.html')).toContain('There are no licences.');
  expect(read(hostile.full, 'renewals.ics')).not.toContain('BEGIN:VEVENT');
});

// site-security

test('No trace of the cost', () => {
  for (const [file, content] of tree(main.staff)) for (const value of ['98765', 'ZETA-NOTE']) expect(content.includes(value), `${file} ${value}`).toBe(false);
  expect([...tree(main.full).values()].some(content => content.includes('98765'))).toBe(true);
});

test('Staff ignores hidden fields and the date', () => {
  expect(tree(other.staff)).toEqual(tree(main.staff));
  // The full sites do differ, so the fixtures really carry different values.
  expect(tree(other.full)).not.toEqual(tree(main.full));
});

test('Custom-hidden vendor and status', () => {
  expect(tree(customB.staff)).toEqual(tree(customA.staff));
  for (const [file, content] of tree(customA.staff)) {
    for (const value of ['Northwind Studio', 'to-confirm', '<dt>Vendor</dt>', '<dt>Status</dt>']) expect(content.includes(value), `${file} ${value}`).toBe(false);
  }
  for (const [file, content] of tree(customB.staff)) for (const value of ['Zeta Supplies', 'expired']) expect(content.includes(value), `${file} ${value}`).toBe(false);
  expect(read(customA.full, 'licences/licence-editor/index.html')).toContain('Northwind Studio');
});

test('Broken settings hide the defaults', () => {
  for (const [file, content] of tree(broken.staff)) {
    for (const value of Object.values(DEFAULT_HIDDEN)) expect(content.includes(String(value)), `${file} ${value}`).toBe(false);
  }
  expect(read(broken.full, 'licences/licence-editor/index.html')).toContain('98765');
});

test('Same policy everywhere', () => {
  for (const site of [example.full, example.staff]) {
    expect(pages(site).length).toBeGreaterThan(30);
    for (const page of pages(site)) {
      const tags = tagsOf(read(site, page));
      const policies = tags.filter(tag => tag.name === 'meta' && /http-equiv="Content-Security-Policy"/i.test(tag.attrs))
        .map(tag => decode(attrsOf(tag.attrs).find(attr => attr.name === 'content')!.value));
      expect(policies, page).toEqual([POLICY]);
      for (const tag of tags) {
        if (tag.name === 'script') expect(attrsOf(tag.attrs).some(attr => attr.name === 'src'), page).toBe(true);
        expect(tag.name, page).not.toBe('style');
        for (const attr of attrsOf(tag.attrs)) {
          expect(attr.name, page).not.toBe('style');
          expect(attr.name.startsWith('on'), `${page} ${attr.name}`).toBe(false);
        }
      }
      expect(read(site, page), page).toContain('<meta name="robots" content="noindex, nofollow">');
    }
  }
});

test('Only local URLs', () => {
  const external = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
  let checked = 0;
  for (const site of [example.full, example.staff]) {
    for (const [file, content] of tree(site)) {
      if (file.endsWith('.html')) {
        for (const tag of tagsOf(content)) {
          for (const attr of attrsOf(tag.attrs)) {
            if (['href', 'src', 'action', 'formaction', 'poster', 'data'].includes(attr.name)) {
              expect(attr.value, `${file} ${attr.name}`).not.toMatch(external);
              checked++;
            }
            if (attr.name === 'srcset') for (const part of attr.value.split(',')) expect(part.trim(), file).not.toMatch(external);
            if (attr.name === 'xmlns') expect(attr.value).toBe('http://www.w3.org/2000/svg');
          }
        }
      }
      if (file.endsWith('.css')) {
        for (const match of content.matchAll(/url\(\s*["']?([^"')]*)/g)) expect(match[1]!.trim(), file).not.toMatch(external);
        for (const match of content.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]*)/g)) expect(match[1], file).not.toMatch(external);
        checked += [...content.matchAll(/url\(/g)].length;
      }
    }
  }
  // Every page has its stylesheet, scripts, icon and links; the fonts are CSS url()s.
  expect(checked).toBeGreaterThan(1000);
});

const HEADERS = `/*
  Content-Security-Policy: ${POLICY}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;

test('Root headers', () => {
  for (const dir of [example.root, example.full, example.staff]) expect(read(dir, '_headers')).toBe(HEADERS);
  expect(read(example.root, '.stackledger-build')).toBe('This folder is written by stackledger build. The next build replaces it.\n');
});

test('Root robots', () => {
  for (const dir of [example.root, example.full, example.staff]) expect(read(dir, 'robots.txt')).toBe('User-agent: *\nDisallow: /\n');
});

test('Hostile title', () => {
  for (const site of [hostile.full, hostile.staff]) {
    let shown = 0;
    for (const page of pages(site)) {
      const html = read(site, page);
      for (const tag of tagsOf(html)) {
        if (tag.name === 'img') expect(tag.attrs, page).not.toMatch(/onerror/i);
        if (tag.name === 'script') expect(tag.attrs, page).toMatch(/^ type="module" src="(?:\.\.\/)*_astro\/[^"]+\.js"$/);
      }
      expect(html).not.toContain(hostileComponent);
      expect(html).not.toContain(hostileLine);
      if (html.includes('&lt;img src=x onerror=alert(1)&gt;') || html.includes('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;')) shown++;
    }
    expect(shown).toBeGreaterThan(3);
    expect(read(site, 'software/editor/index.html')).toContain('<h1>&lt;img src=x onerror=alert(1)&gt;</h1>');
    expect(read(site, 'journeys/ship/index.html')).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;</h1>');
  }
});
