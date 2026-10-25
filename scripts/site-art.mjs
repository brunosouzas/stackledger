// Writes the art @brunosouzas/design-system draws for stackledger (catalogue-site: Home banner art, Home links, Brand
// mark; catalogue-pipeline: How it works diagram): site/public/home-banner.svg from scripts/home-banner.json,
// favicon.svg and brand-mark-dark.svg (ledgerMark), link-icons/<icon>-<light|dark>.svg (linkIcon), and
// docs/images/how-it-works.svg, the body diagram of scripts/how-it-works.json. Both specs are checked before any file
// is written. Run: npm run build && node scripts/site-art.mjs after a package bump or a spec change;
// test/unit/site-brand.test.ts and test/unit/how-it-works.test.ts fail while a file differs. Not published
// (package.json files).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { coverTree, validateCoverSpec, ledgerMark, linkIcon, LINK_ICON_NAMES, toSvg } from '@brunosouzas/design-system';

const repo = new URL('../', import.meta.url);
const out = (path, text) => { mkdirSync(new URL('.', new URL(path, repo)), { recursive: true }); writeFileSync(new URL(path, repo), text); };
const square = (size, drawn) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${drawn.body.map(node => toSvg(node)).join('')}</svg>\n`;
const checked = name => {
  const spec = JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
  const problems = validateCoverSpec(spec);
  if (problems.length) throw new Error(`scripts/${name}: ${problems.map(p => `${p.path ?? ''} ${p.message ?? p}`).join('; ')}`);
  return spec;
};

const banner = checked('home-banner.json');
const diagram = checked('how-it-works.json');
out('site/public/home-banner.svg', `${toSvg(coverTree(banner))}\n`);
out('site/public/favicon.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32 })));
out('site/public/brand-mark-dark.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32, surface: 'dark' })));
for (const icon of LINK_ICON_NAMES) for (const surface of ['light', 'dark']) out(`site/public/link-icons/${icon}-${surface}.svg`, square(46, linkIcon({ icon, x: 0, y: 0, surface })));
out('docs/images/how-it-works.svg', `${toSvg(coverTree(diagram))}\n`);
console.log('site art and how-it-works diagram written');
