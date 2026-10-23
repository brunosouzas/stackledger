/** The Skills section of the built sites (skills-site spec; catalogue-site, Layout: Skills link). Build
 * first with npm run build. Each build runs the real CLI in a child process into one temporary folder,
 * removed after the file. Catalogues and skill sets are fictitious Northwind ones.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { component, licence, line, set, settings } from '../unit/helpers.js';
import { yaml } from './mcp-helpers.js';
import { cli, root } from './helpers.js';
import { agent, playbook, skill } from '../skills-helpers.js';
import { siteIcons } from '../../src/site/ui-icons.js';

const DATE = '2027-06-01';
interface Result { status: number; stderr: string }
const run = (args: string[], cwd = root): Promise<Result> => new Promise(resolve => {
  execFile(process.execPath, [cli, 'build', ...args], { cwd, env: { ...process.env, NODE_OPTIONS: '' }, timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
    (error, _stdout, stderr) => resolve({ status: error ? (typeof error.code === 'number' ? error.code : -1) : 0, stderr }));
});
function writeFolder(path: string, files: Record<string, string>): string {
  mkdirSync(path, { recursive: true });
  for (const [file, content] of Object.entries(files)) { mkdirSync(dirname(join(path, file)), { recursive: true }); writeFileSync(join(path, file), content); }
  return path;
}
/** Every file below `dir`, relative, `/`-separated. */
const files = (dir: string) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
  .map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1).split('\\').join('/'));
const html = (out: string, site: string, path: string) => readFileSync(join(out, site, path, 'index.html'), 'utf8');
const main = (text: string) => /<main[\s\S]*<\/main>/.exec(text)![0];
const stops = (name: string, names: string[]) => set(line(name), 'spec.stops', names.map(item => `component:${item}`));
const catalogueFiles = (extra: unknown[] = []) => ({ 'catalog-info.yaml': yaml(component('editor'), component('forge'), stops('ship', ['editor', 'forge']), ...extra) });

const RLO = '\u202E';
const HOSTILE_HTML = '<img src=x onerror=alert(1)>';
const HOSTILE_SCRIPT = '</script><script>alert(1)</script>';
let base = '';
let catalogue = '';
let out = '';
let plain = '';

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'stackledger-site-skills-')));
  catalogue = writeFolder(join(base, 'catalogue'), catalogueFiles());
  // A skills folder under a home-like path, as a tool folder would be (skills-site, Tool folder in the home folder).
  const kit = writeFolder(join(base, 'home', 'northwind', '.claude', 'skills'), {
    'writer/SKILL.md': skill('writer', { description: `Writes. ${HOSTILE_HTML} ${HOSTILE_SCRIPT} ${RLO}` }),
    'writer/rules.md': `# Rules\n\n## Writing ${RLO}(WR)\n\n- **WR-1** Short ${HOSTILE_SCRIPT} sentences ${RLO}.\n`,
    'developer/SKILL.md': skill('developer'), 'developer/rules.md': '# Rules\n\n## Docs (DOC)\n\n- **DOC-1** Code docs.\n',
    'documentation/SKILL.md': skill('documentation'), 'documentation/rules.md': '# Rules\n\n## Docs (DOC)\n\n- **DOC-1** Docs.\n',
    'reviewer/SKILL.md': skill('reviewer'), 'agents/reviewer.md': agent('reviewer'),
    [`w${RLO}r/SKILL.md`]: skill(`w${RLO}r`),
    'release/SKILL.md': playbook('release', 'writer ghost', 'reviewer'), 'release/rules.md': '# Rules\n\n## Release (REL)\n\n- **REL-1** Review first.\n',
    'stackledger-skills.yaml': `apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\n  title: "Pub${RLO}lish"\nspec:\n  color: "#E4002B"\n  stops: ["playbook:release", "skill:writer", "agent:reviewer"]\n`,
  });
  out = join(base, 'public');
  plain = join(base, 'plain');
  const [one, two] = await Promise.all([run([catalogue, '--out', out, '--date', DATE, '--skills', kit]), run([catalogue, '--out', plain, '--date', DATE])]);
  expect(one.status, one.stderr).toBe(0); expect(two.status, two.stderr).toBe(0);
}, 240_000);
afterAll(() => { if (base) rmSync(base, { recursive: true, force: true }); });

test('Skills link', () => {
  for (const site of ['full', 'staff']) {
    for (const page of ['', 'software/editor', 'skills', 'skills/writer']) {
      const header = /<header[\s\S]*?<\/header>/.exec(html(out, site, page))![0];
      expect(header, `${site}/${page}`).toMatch(/href="(?:\.\.\/)*skills\/"[^>]*>\s*Skills\s*</);
    }
    expect(html(plain, site, '')).not.toMatch(/skills\//);
  }
});
// catalogue-site, Layout and Home page, with a skill set.
test('Default title (Skills pages)', () => {
  for (const site of ['full', 'staff']) {
    for (const page of ['skills', 'skill-map', 'rules', 'skills/writer']) {
      const text = html(out, site, page);
      expect(text, `${site}/${page}`).toMatch(/<title>[^<]* \| stackledger<\/title>/);
      expect(text, `${site}/${page}`).toMatch(/<a class="navbar-brand" href="[^"]*"><img class="brand-mark themed-light" src="(?:\.\.\/)*favicon\.svg" alt="" width="28" height="28"><img class="brand-mark themed-dark" src="(?:\.\.\/)*brand-mark-dark\.svg" alt="" width="28" height="28">stackledger<\/a>/);
    }
  }
});
test('Title opens the home', () => {
  for (const site of ['full', 'staff']) {
    expect(html(out, site, 'skills')).toContain('<a class="navbar-brand" href="../">');
    expect(html(out, site, 'software/editor')).toContain('<a class="navbar-brand" href="../../">');
    expect(html(out, site, '')).toContain('<a class="navbar-brand" href="./">');
  }
});
test('Home without skills', () => {
  for (const site of ['full', 'staff']) {
    const home = main(html(plain, site, ''));
    expect(home).not.toContain('>Skills<'); expect(home).not.toMatch(/skills\//);
  }
});
test.concurrent('Home in full and staff', async () => {
  const counted = writeFolder(join(base, 'home-catalogue'), { 'catalog-info.yaml': yaml(
    set(component('editor'), 'spec.dependsOn', ['resource:licence-editor', 'resource:licence-forge']), component('forge'), component('vault'),
    licence('licence-editor'), licence('licence-forge'), stops('ship', ['editor', 'forge'])) });
  const kit = writeFolder(join(base, 'home-kit'), {
    'writer/SKILL.md': skill('writer'), 'writer/rules.md': '# Rules\n\n## Writing (WR)\n\n- **WR-1** One.\n- **WR-2** Two.\n- **WR-3** Three.\n',
    'editor/SKILL.md': skill('editor'), 'release/SKILL.md': playbook('release', 'writer editor', 'reviewer'),
    'release/rules.md': '# Rules\n\n## Release (REL)\n\n- **REL-1** Review first.\n', 'agents/reviewer.md': agent('reviewer'),
  });
  const target = join(base, 'home-out');
  const result = await run([counted, '--out', target, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  for (const site of ['full', 'staff']) {
    const home = main(html(target, site, ''));
    expect(home, site).toMatch(/3 components, 2 licences and 1 journey\./);
    expect(home, site).toMatch(/2 skills, 1 playbook, 1 agent and 4 rules\./);
    for (const path of ['map/', 'skills/', 'skill-map/', 'rules/']) expect(home, `${site} ${path}`).toContain(`href="${path}"`);
    expect(home.includes('href="reports/"'), site).toBe(site === 'full');
    expect(home, site).toContain('Your software and skills, mapped.');
  }
}, 180_000);
test('Item pages', () => {
  for (const site of ['full', 'staff']) for (const page of ['skills/writer', 'playbooks/release', 'agents/reviewer']) expect(existsSync(join(out, site, page, 'index.html'))).toBe(true);
});
// Its own set: `writer` and `Writer` are one folder on a case-insensitive file system (macOS, Windows).
test.concurrent('Name that is not a file name', async () => {
  const kit = writeFolder(join(base, 'upper-kit'), { 'Writer/SKILL.md': skill('Writer') });
  const target = join(base, 'upper-out');
  const result = await run([catalogue, '--out', target, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(html(target, 'full', 'skills/_577269746572')).toContain('<h1>Writer</h1>');
}, 180_000);
test('Skill and agent with one name', () => {
  expect(existsSync(join(out, 'full', 'skills', 'reviewer', 'index.html'))).toBe(true); expect(existsSync(join(out, 'full', 'agents', 'reviewer', 'index.html'))).toBe(true);
});
test('No skill set', () => {
  for (const site of ['full', 'staff']) {
    for (const folder of ['skills', 'skill-map', 'rules', 'playbooks', 'agents']) expect(existsSync(join(plain, site, folder))).toBe(false);
    for (const file of files(join(plain, site)).filter(file => file.endsWith('.html'))) {
      expect(readFileSync(join(plain, site, file), 'utf8'), file).not.toMatch(/href="[^"]*(?:skills|skill-map|rules|playbooks|agents)\//);
    }
  }
});
test('Rules page', () => {
  const nav = /<nav class="sub-nav[^"]*" aria-label="Skills">[\s\S]*?<\/nav>/.exec(html(out, 'full', 'rules'))![0];
  for (const path of ['skills/', 'skill-map/', 'rules/']) expect(nav).toContain(`href="../${path}"`);
  expect([...nav.matchAll(/aria-current="page"[^>]*>\s*([^<]+?)\s*</g)].map(match => match[1])).toEqual(['Rules']);
});
test('Both sites', () => {
  const pages = files(join(out, 'full')).filter(file => /^(skills|skill-map|rules|playbooks|agents)\/.*index\.html$/.test(file));
  expect(pages.length).toBeGreaterThan(8);
  for (const page of pages) expect(main(readFileSync(join(out, 'staff', page), 'utf8')), page).toBe(main(readFileSync(join(out, 'full', page), 'utf8')));
});
test.concurrent('Personal build', async () => {
  const cat = writeFolder(join(base, 'personal'), catalogueFiles([settings('settings', { sites: ['full'] })]));
  const kit = writeFolder(join(base, 'personal-kit'), { 'writer/SKILL.md': skill('writer') });
  const target = join(base, 'personal-out');
  const result = await run([cat, '--out', target, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(join(target, 'full', 'skills', 'writer', 'index.html'))).toBe(true); expect(existsSync(join(target, 'staff'))).toBe(false);
}, 180_000);
test.concurrent('Relative skills folder', async () => {
  const top = join(base, 'relative');
  writeFolder(join(top, 'northwind-kit'), { 'skills/writer/SKILL.md': skill('writer') });
  writeFolder(join(top, 'work'), {});
  const target = join(base, 'relative-out');
  const result = await run([catalogue, '--out', target, '--date', DATE, '--skills', '../northwind-kit'], join(top, 'work'));
  expect(result.status, result.stderr).toBe(0);
  expect(html(target, 'full', 'skills/writer')).toContain('<code>skills/writer/SKILL.md</code>');
  for (const file of files(target)) expect(readFileSync(join(target, file), 'utf8'), file).not.toContain('northwind-kit');
}, 180_000);
/** The page without the site's own images (catalogue-site "Brand mark"): class, empty alt, the only allowed attributes and a site art src. */
const SITE_IMAGE = /<img class="(?:brand-mark themed-(?:light|dark)|home-banner-art|link-icon themed-(?:light|dark))" src="(?:\.\.\/)*(?:favicon\.svg|brand-mark-dark\.svg|home-banner\.svg|link-icons\/(?:github|website|linkedin|email)-(?:light|dark)\.svg)" alt="" width="\d+" height="\d+">/g;
const withoutSiteImages = (html: string) => html.replace(SITE_IMAGE, '');

test('Description with HTML', () => {
  for (const file of files(join(out, 'full')).filter(file => file.endsWith('.html'))) expect(withoutSiteImages(readFileSync(join(out, 'full', file), 'utf8')), file).not.toMatch(/<img\b/);
  expect(html(out, 'full', 'skills/writer')).toContain('&lt;img src=x onerror=alert(1)&gt;');
});
test('Hostile script text', () => {
  for (const file of files(join(out, 'full')).filter(file => file.endsWith('.html'))) {
    for (const script of readFileSync(join(out, 'full', file), 'utf8').match(/<script\b[^>]*>/g) ?? []) expect(script, file).toMatch(/src="[^"]+\.js"/);
  }
});
test('Bidirectional override', () => {
  for (const site of ['full', 'staff']) for (const file of files(join(out, site))) expect(readFileSync(join(out, site, file), 'utf8'), file).not.toContain(RLO);
  expect(existsSync(join(out, 'full', 'skills', 'writer', 'index.html'))).toBe(true);
  // The skill named with U+202E has its page at its page file name, and its name and source path lose the character.
  expect(html(out, 'full', `skills/_${Buffer.from(`w${RLO}r`).toString('hex')}`)).toContain('<h1>wr</h1>');
});
test('Tool folder in the home folder', () => {
  expect(html(out, 'full', 'skills/writer')).toContain('<code>writer/SKILL.md</code>');
  for (const site of ['full', 'staff']) for (const file of files(join(out, site))) expect(readFileSync(join(out, site, file), 'utf8'), file).not.toContain('/home/northwind');
});
test('Shared rule ID', () => {
  const rules = html(out, 'full', 'rules');
  const developer = rules.indexOf('href="../skills/developer/"'), documentation = rules.indexOf('href="../skills/documentation/"');
  expect(developer).toBeGreaterThan(-1); expect(documentation).toBeGreaterThan(developer);
  expect(rules.match(/<code>DOC-1<\/code>/g)).toHaveLength(2);
});
test('Rule of a playbook', () => {
  expect(html(out, 'full', 'rules')).toMatch(/<code>REL-1<\/code>[\s\S]*?href="\.\.\/playbooks\/release\/"/);
});
// metro-map "Legend of a skills map", as the site shows it: the symbols are listed under the map.
test('Legend of a skills map on the site', () => {
  const symbols = /<ul class="map-symbols">([\s\S]*?)<\/ul>/.exec(html(out, 'full', 'skill-map'))![1]!;
  const labels = ['Interchange', 'Number of rules', 'Suggested position'];
  for (const label of labels) expect(symbols).toContain(label);
  expect(labels.map(label => symbols.indexOf(label))).toEqual([...labels.map(label => symbols.indexOf(label))].sort((a, b) => a - b));
  expect(symbols).not.toContain('Licence');
});
test('Relation error keeps the page', () => {
  expect(html(out, 'full', 'skills')).toContain('href="../playbooks/release/"'); expect(html(out, 'full', 'playbooks/release')).not.toContain('ghost');
});
test.concurrent('No rules and no skill lines', async () => {
  const kit = writeFolder(join(base, 'bare-kit'), { 'notes/SKILL.md': skill('notes') });
  const target = join(base, 'bare-out');
  const result = await run([catalogue, '--out', target, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(html(target, 'full', 'rules')).toContain('No rules');
  const map = html(target, 'full', 'skill-map');
  expect(map).toContain('No skill lines yet'); expect(map).toContain('stackledger-skills.yaml');
}, 180_000);
test.concurrent('Every item rejected', async () => {
  const kit = writeFolder(join(base, 'rejected-kit'), { 'notes/SKILL.md': '# no frontmatter\n', 'agents/reviewer.md': '---\nname: reviewer\n---\n' });
  const target = join(base, 'rejected-out');
  const result = await run([catalogue, '--out', target, '--date', DATE, '--skills', kit]);
  expect(result.status, result.stderr).toBe(0);
  expect(html(target, 'full', 'skills')).toContain('No skills');
  expect(html(target, 'full', 'skill-map')).toContain('No skill lines yet'); expect(html(target, 'full', 'rules')).toContain('No rules');
}, 180_000);

// catalogue-site "Interface icons": the skills map page's zoom buttons carry the same icons as the map page.
test('Zoom buttons with icons (skills map)', () => {
  const icons = siteIcons();
  for (const site of ['full', 'staff']) {
    const page = html(out, site, 'skill-map');
    for (const [zoom, icon] of [['in', icons.zoomIn], ['out', icons.zoomOut], ['reset', icons.reset]] as const) {
      const button = new RegExp(`<button[^>]*data-zoom="${zoom}"[^>]*>([\\s\\S]*?)</button>`).exec(page)![1]!;
      expect(button, `${site} ${zoom}`).toContain(icon);
    }
    expect(page).toMatch(/<button[^>]*data-zoom="in"[^>]*aria-label="Zoom in"/);
  }
});
