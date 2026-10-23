// Writes the site's static art from @brunosouzas/design-system (catalogue-site: Home banner art, Home links, Brand mark):
// site/public/home-banner.svg from scripts/home-banner.json, favicon.svg and brand-mark-dark.svg (ledgerMark), and
// link-icons/<icon>-<light|dark>.svg (linkIcon). Run: npm run build && node scripts/site-art.mjs after a package bump;
// test/unit/site-brand.test.ts fails while a file differs from its piece. Not published (package.json files).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { coverTree, validateCoverSpec, ledgerMark, linkIcon, LINK_ICON_NAMES, toSvg } from '@brunosouzas/design-system';

const root = new URL('../site/', import.meta.url);
const out = (path, text) => { mkdirSync(new URL('.', new URL(path, root)), { recursive: true }); writeFileSync(new URL(path, root), text); };
const square = (size, drawn) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${drawn.body.map(node => toSvg(node)).join('')}</svg>\n`;

const spec = JSON.parse(readFileSync(new URL('home-banner.json', import.meta.url), 'utf8'));
const problems = validateCoverSpec(spec);
if (problems.length) throw new Error(`scripts/home-banner.json: ${problems.map(p => `${p.path ?? ''} ${p.message ?? p}`).join('; ')}`);
out('public/home-banner.svg', `${toSvg(coverTree(spec))}\n`);
out('public/favicon.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32 })));
out('public/brand-mark-dark.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32, surface: 'dark' })));
for (const icon of LINK_ICON_NAMES) for (const surface of ['light', 'dark']) out(`public/link-icons/${icon}-${surface}.svg`, square(46, linkIcon({ icon, x: 0, y: 0, surface })));
console.log('site art written');
