/** Build-output tests of both sites (catalogue-site task 3.4): every catalogue-site and site-security
 * scenario that can be checked on the built files, and the site scenarios of licence-reports (task 3.1). Build first with npm run build; the sites are
 * built once per fixture in beforeAll (in parallel child processes) and then only read.
 * Fixtures are fictitious; hidden values are distinctive so that any leak shows.
 */
import { existsSync } from 'node:fs';
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
  // Valid home links next to the colour error: the error drops them too (Broken settings, no links).
  'stackledger.yaml': settingsFile({ site: { title: 'Northwind software', colors: { primary: 'red', accent: '#E4002B' },
    home: { links: [{ title: 'Articles', url: 'https://example.org/articles/', icon: 'github' }] } } }),
};

const hostileComponent = '<img src=x onerror=alert(1)>';
const hostileLine = '</script><script>alert(1)</script>';
const hostileCatalogue = {
  'catalogue.yaml': yaml(set(component('editor'), 'metadata.title', hostileComponent), component('forge'),
    set(stops('ship', ['editor', 'forge']), 'metadata.title', hostileLine)),
};

// catalogue-site, Home page and Home links: the example with home text and links, and a catalogue with nothing in it.
const HOSTILE_LINK = '<script>alert(1)</script>';
// The fictitious example with home text and links added to its Settings (spec.site.home).
const HOME_SETTINGS = `  site:
    home:
      text: Northwind tools
      links:
        - { title: Articles, url: "https://example.org/articles/", description: What I write }
        - { title: Team wiki, url: "http://wiki.example.org/" }
        - { title: "${HOSTILE_LINK}", url: "https://example.org/?a=1&b=2" }
`;
// catalogue-site "Home links": one link with an icon, one without.
const ICON_SETTINGS = `  site:
    home:
      links:
        - { title: Source, url: "https://github.example.com/northwind/", icon: github }
        - { title: Blog, url: "https://blog.example.com/" }
`;
const emptyCatalogue = { 'stackledger.yaml': settingsFile({}) };

// catalogue-site "Diagram box titles": a title of spaces is valid in the catalogue.
const blankCatalogue = { 'catalogue.yaml': yaml(set(depends(component('forge'), ['component:vault']), 'metadata.title', ' '), component('vault'), depends(component('editor'), ['component:forge'])) };

let main: Built, other: Built, customA: Built, customB: Built, broken: Built, hostile: Built, example: Built, linked: Built, empty: Built, blank: Built, iconed: Built;

beforeAll(async () => {
  const exampleFiles = Object.fromEntries(['catalog-info.yaml', 'stackledger.yaml'].map(file => [file, read(join(root, 'examples/northwind'), file)]));
  [main, other, customA, customB, broken, hostile, example, linked, empty, blank, iconed] = await Promise.all([
    buildSites(mainCatalogue(DEFAULT_HIDDEN), '2027-06-01'),
    buildSites(mainCatalogue(OTHER_HIDDEN), '2031-01-01'),
    buildSites(customHidden('Northwind Studio', 'to-confirm'), '2027-06-01'),
    buildSites(customHidden('Zeta Supplies', 'expired'), '2027-06-01'),
    buildSites(brokenCatalogue),
    buildSites(hostileCatalogue),
    buildSites(exampleFiles),
    buildSites({ ...exampleFiles, 'stackledger.yaml': exampleFiles['stackledger.yaml']! + HOME_SETTINGS }),
    buildSites(emptyCatalogue),
    buildSites(blankCatalogue),
    buildSites({ ...exampleFiles, 'stackledger.yaml': exampleFiles['stackledger.yaml']! + ICON_SETTINGS }),
  ]);
}, 180_000);

// Removing eleven built sites can take more than the default 10 s while other test files run.
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
    expect(read(site, 'map/index.html')).toContain('No journeys yet');
    expect(read(site, 'journeys/index.html')).toContain('There are no journeys yet.');
  }
});

test('Site title', () => {
  for (const site of [main.full, main.staff]) {
    for (const page of pages(site)) {
      const html = read(site, page);
      // The home's title is the site title alone (catalogue-site, Home page chrome).
      expect(html, page).toMatch(page === 'index.html' ? /<title>Northwind software<\/title>/ : /<title>[^<]* \| Northwind software<\/title>/);
      expect(html, page).toMatch(/<a class="navbar-brand" href="[^"]*"><img class="brand-mark themed-light" src="(?:\.\.\/)*favicon\.svg" alt="" width="28" height="28"><img class="brand-mark themed-dark" src="(?:\.\.\/)*brand-mark-dark\.svg" alt="" width="28" height="28">Northwind software<\/a>/);
    }
  }
});

test('View in the footer', () => {
  for (const page of pages(main.staff)) expect(read(main.staff, page), page).toMatch(/<footer[\s\S]*staff view · stackledger \d+\.\d+\.\d+/);
  expect(read(main.full, 'index.html')).toMatch(/<footer[\s\S]*full view · stackledger/);
});

/** A custom property of the light theme (top-level :root rules, last wins) and of the chosen dark theme. */
function themeVar(site: string, name: string): { light: string | undefined; dark: string | undefined } {
  const css = [...tree(site)].filter(([file]) => file.endsWith('.css')).map(([, text]) => text).join('\n');
  let light: string | undefined, dark: string | undefined, depth = 0, selector = '';
  for (const match of css.matchAll(/([^{}]*)([{}])/g)) {
    if (match[2] === '{') {
      if (depth === 0) selector = match[1]!.trim();
      depth++;
      continue;
    }
    if (depth === 1) {
      const value = new RegExp(`${name}:\\s*([^;}]+)`).exec(match[1]!)?.[1]?.trim().toLowerCase();
      if (value && selector === ':root') light = value;
      if (value && /^:root\[data-theme=("?)dark\1\]$/.test(selector)) dark = value;
    }
    depth--;
  }
  return { light, dark };
}
const accents = (site: string) => themeVar(site, '--color-accent');

test('Accent override', () => {
  expect(accents(main.full)).toEqual({ light: '#e4002b', dark: '#9da8ff' });
  expect(accents(main.staff)).toEqual({ light: '#e4002b', dark: '#9da8ff' });
});

test('Broken settings', () => {
  for (const site of [broken.full, broken.staff]) {
    expect(accents(site)).toEqual({ light: '#000f9f', dark: '#9da8ff' });
    expect(read(site, 'map/index.html')).toContain('<title>Map | stackledger</title>');
    expect(read(site, 'map/index.html')).not.toContain('Northwind software');
  }
});

// catalogue-site "Site tokens from the design system".
test('Palette from the design system', () => {
  for (const site of [example.full, example.staff]) {
    expect(themeVar(site, '--ds-site-light-body').light).toMatch(/^#fff(?:fff)?$/);
    expect(themeVar(site, '--ds-site-dark-body').light).toBe('#1c1c1c');
    expect(themeVar(site, '--color-body')).toEqual({ light: 'var(--ds-site-light-body)', dark: 'var(--ds-site-dark-body)' });
    expect(themeVar(site, '--font-primary').light).toBe('var(--ds-site-font-primary)');
    expect(themeVar(site, '--font-secondary').light).toBe('var(--ds-site-font-secondary)');
  }
});

test("Accent stays stackledger's", () => {
  for (const site of [example.full, example.staff]) expect(accents(site)).toEqual({ light: '#000f9f', dark: '#9da8ff' });
});

// catalogue-site "Brand mark": the header shows the mark before a custom title.
test('Header mark with a custom title', () => {
  for (const site of [main.full, main.staff]) {
    for (const page of ['index.html', 'map/index.html', 'software/editor/index.html']) {
      const html = read(site, page);
      expect(html, page).toMatch(/<a class="navbar-brand" href="[^"]*"><img class="brand-mark themed-light" src="(?:\.\.\/)*favicon\.svg" alt="" width="28" height="28"><img class="brand-mark themed-dark" src="(?:\.\.\/)*brand-mark-dark\.svg" alt="" width="28" height="28">Northwind software<\/a>/);
      // The two header marks; the home adds the banner (Home banner art).
      expect([...html.matchAll(/<img\b/g)], page).toHaveLength(page === 'index.html' ? 3 : 2);
    }
  }
});

// catalogue-site "Diagram box titles": the build succeeds and every neighbourhood diagram shows the reference.
test('Blank title', () => {
  for (const site of [blank.full, blank.staff]) {
    for (const page of ['software/forge/index.html', 'software/vault/index.html', 'software/editor/index.html']) {
      const html = read(site, page);
      const box = /<g data-ref="component:forge">[\s\S]*?<\/g>/.exec(html)![0];
      expect(box, page).toContain('>component:forge</text>');
    }
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
  expect(rows).toHaveLength(17 + 14);
  expect(html).not.toMatch(/<tr[^>]*hidden/);
  expect(html).toMatch(/data-list-tools hidden/);
});

test('Map page legends in HTML, not in the map', () => {
  for (const site of [example.full, example.staff]) {
    const html = read(site, 'map/index.html');
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

const REPORTS_LINK = /<a class="sub-link" href="(?:\.\.\/)*reports\/"[^>]*>\s*Reports\s*<\/a>/;
const subNav = (html: string) => /<nav class="sub-nav[^"]*" aria-label="Software">[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';

test('Reports link', () => {
  // The home has no sub-navigation (Home page chrome); its Software card links Reports in full only.
  for (const page of pages(main.full).filter(page => page !== 'index.html')) expect(subNav(read(main.full, page)), page).toMatch(REPORTS_LINK);
  for (const page of pages(main.staff)) expect(read(main.staff, page), page).not.toContain('Reports');
  // Relative from a nested page too.
  expect(subNav(read(main.full, 'software/editor/index.html'))).toMatch(/href="\.\.\/\.\.\/reports\/"/);
});

const homeMain = (html: string) => /<main[\s\S]*<\/main>/.exec(html)![0];

test('Map at /map/', () => {
  for (const site of [example.full, example.staff]) {
    expect(read(site, 'map/index.html')).toContain('data-ref="component:slack"');
    const home = read(site, 'index.html');
    expect(home).not.toContain('map-canvas');
    for (const page of pages(site)) {
      const html = read(site, page);
      for (const [, target] of html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>\s*Map\s*<\/a>/g)) {
        // Every "Map" link to the software map targets map/ (the Skills division has its own skill-map/).
        if (!target!.endsWith('skill-map/')) expect(target, page).toMatch(/(?:^|\/)map\/$/);
      }
    }
  }
});

test('Default title', () => {
  for (const site of [example.full, example.staff, broken.full, broken.staff]) {
    for (const page of pages(site)) {
      const html = read(site, page);
      expect(html, page).toMatch(page === 'index.html' ? /<title>stackledger<\/title>/ : /<title>[^<]* \| stackledger<\/title>/);
      expect(html, page).toMatch(/<a class="navbar-brand" href="[^"]*"><img class="brand-mark themed-light" src="(?:\.\.\/)*favicon\.svg" alt="" width="28" height="28"><img class="brand-mark themed-dark" src="(?:\.\.\/)*brand-mark-dark\.svg" alt="" width="28" height="28">stackledger<\/a>/);
    }
  }
});

test('Home chrome', () => {
  for (const site of [main.full, main.staff, example.full]) {
    const html = read(site, 'index.html');
    expect(html).not.toContain('class="sub-nav');
    const header = /<header[\s\S]*?<\/header>/.exec(html)![0];
    expect(header).not.toContain('aria-current');
  }
  expect(read(main.full, 'index.html')).toContain('<title>Northwind software</title>');
});

test('Home text', () => {
  const html = homeMain(read(linked.full, 'index.html'));
  expect(html).toContain('Northwind tools');
  expect(html).not.toContain('Your software and skills, mapped.');
  expect(homeMain(read(example.full, 'index.html'))).toContain('Your software and skills, mapped.');
});

test('Empty catalogue', () => {
  for (const site of [empty.full, empty.staff]) {
    const html = homeMain(read(site, 'index.html'));
    expect(html).toMatch(/0 components, 0 licences and 0 journeys\./);
  }
});

test('Two links', () => {
  for (const site of [linked.full, linked.staff]) {
    const html = homeMain(read(site, 'index.html'));
    expect(html).toContain('<h2>Links</h2>');
    const anchors = [...html.matchAll(/<a href="(https?:[^"]*)"([^>]*)>([^<]*)<\/a>/g)].map(match => ({ href: decode(match[1]!), attrs: match[2]!, text: match[3]! }));
    expect(anchors.map(anchor => anchor.href)).toEqual(['https://example.org/articles/', 'http://wiki.example.org/', 'https://example.org/?a=1&b=2']);
    expect(anchors.map(anchor => anchor.text).slice(0, 2)).toEqual(['Articles', 'Team wiki']);
    for (const anchor of anchors) { expect(anchor.attrs).toContain('rel="noopener noreferrer"'); expect(anchor.attrs).not.toContain('target'); }
    expect(html.indexOf('What I write')).toBeGreaterThan(html.indexOf('>Articles<'));
    expect(html.indexOf('What I write')).toBeLessThan(html.indexOf('>Team wiki<'));
  }
  expect(homeMain(read(example.full, 'index.html'))).not.toContain('<h2>Links</h2>');
});

// catalogue-site "Home banner art": after the h1 and the text, a decorative image from the site's folder.
test('Banner on the home', () => {
  for (const site of [example.full, example.staff, linked.full]) {
    const banner = /<section class="home-banner">([\s\S]*?)<\/section>/.exec(read(site, 'index.html'))![1]!;
    expect(banner).toMatch(/<h1>[^<]+<\/h1>\s*<p class="lead">[^<]+<\/p>\s*<img class="home-banner-art" src="home-banner\.svg" alt="" width="1200" height="420">/);
    expect(existsSync(join(site, 'home-banner.svg'))).toBe(true);
  }
});

test('Link with an icon', () => {
  for (const site of [iconed.full, iconed.staff]) {
    const html = homeMain(read(site, 'index.html'));
    const anchor = (title: string) => new RegExp(`<a href="[^"]*" rel="noopener noreferrer">(.*?)${title}</a>`).exec(html)![1]!;
    expect(anchor('Source')).toBe('<img class="link-icon themed-light" src="link-icons/github-light.svg" alt="" width="24" height="24"><img class="link-icon themed-dark" src="link-icons/github-dark.svg" alt="" width="24" height="24">');
    expect(anchor('Blog')).toBe('');
    for (const file of ['github-light.svg', 'github-dark.svg']) expect(existsSync(join(site, 'link-icons', file))).toBe(true);
  }
});

test('Icon with broken settings', () => {
  for (const site of [broken.full, broken.staff]) expect(homeMain(read(site, 'index.html'))).not.toContain('link-icon');
});

test('Broken settings, no links', () => {
  for (const site of [broken.full, broken.staff]) {
    const html = homeMain(read(site, 'index.html'));
    expect(html).not.toContain('<h2>Links</h2>');
    expect(html).not.toContain('example.org');
    expect(html).toContain('Your software and skills, mapped.');
  }
});

test('Hostile link text', () => {
  const html = read(linked.full, 'index.html');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain(HOSTILE_LINK);
});

// site-security, No external requests: the configured links are the only absolute URLs, on the home only.
test('Home links are the only external URLs', () => {
  const external = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
  for (const site of [linked.full, linked.staff]) {
    const found: string[] = [];
    for (const [file, content] of tree(site)) {
      if (!file.endsWith('.html')) continue;
      for (const tag of tagsOf(content)) {
        for (const attr of attrsOf(tag.attrs)) {
          if (['href', 'src', 'action', 'formaction', 'poster', 'data'].includes(attr.name) && external.test(decode(attr.value))) found.push(`${file} ${tag.name} ${attr.name} ${decode(attr.value)}`);
        }
      }
    }
    expect(found).toEqual(['index.html a href https://example.org/articles/', 'index.html a href http://wiki.example.org/', 'index.html a href https://example.org/?a=1&b=2']);
  }
});

test('Software sub-navigation', () => {
  for (const page of ['journeys/index.html', 'journeys/ship/index.html']) {
    const html = read(main.full, page);
    const header = /<header[\s\S]*?<\/header>/.exec(html)![0];
    expect(header).toMatch(/aria-current="page"[^>]*>\s*Software|>\s*Software\s*<\/a>/);
    expect(header).not.toContain('Journeys');
    const nav = subNav(html);
    for (const title of ['Map', 'List', 'Journeys']) expect(nav, page).toMatch(new RegExp(`>\\s*${title}\\s*<`));
    expect(nav, page).toMatch(/href="(?:\.\.\/)+map\/"[^>]*>\s*Map\s*</);
    const marked = [...nav.matchAll(/<a [^>]*aria-current="page"[^>]*>\s*([^<]+?)\s*</g)].map(match => match[1]);
    expect(marked, page).toEqual(page === 'journeys/index.html' ? ['Journeys'] : []);
  }
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
  expect(recurring).toContain('<tr><td>GBP</td><td class="amount">131.50</td><td class="amount">1578.00</td><td class="amount">1</td></tr>');
  expect(recurring).toContain('<tr><td>USD</td><td class="amount">94.00</td><td class="amount">1128.00</td><td class="amount">0</td></tr>');
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

test('Lato shipped locally', () => {
  for (const site of [example.full, example.staff]) {
    const files = tree(site);
    const css = [...files.keys()].filter(file => file.endsWith('.css')).map(file => [file, files.get(file)!] as const);
    const faces = css.flatMap(([file, content]) => [...content.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(match => [file, match[1]!] as const))
      .filter(([, body]) => /font-family:\s*["']?Lato["']?/.test(body));
    expect(faces.map(([, body]) => body.match(/font-weight:\s*(\d+)/)![1]).sort()).toEqual(['400', '700', '900']);
    for (const [file, body] of faces) {
      const url = body.match(/url\(\s*["']?([^"')]+)/)![1]!;
      expect(url).not.toMatch(/^[a-z]+:|^\/\//i);
      expect(files.has(join(file, '..', url).replace(/\\/g, '/')), url).toBe(true);
    }
  }
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
