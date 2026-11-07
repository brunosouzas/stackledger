// Writes the art @brunosouzas/design-system draws for stackledger (catalogue-site: Home banner art, Home links, Brand
// mark, Parent brand endorsement; catalogue-pipeline: How it works diagram): site/public/home-banner.svg from
// scripts/home-banner.json, favicon.svg and brand-mark-dark.svg (ledgerMark), link-icons/<icon>-<light|dark>.svg
// (linkIcon), symbol-<light|dark>.svg (the parent brand's symbol, also copied to docs/images/ for the README), and
// docs/images/how-it-works.svg, the body diagram of scripts/how-it-works.json with its Source faces embedded by the
// package's embedFonts (GitHub shows it as a standalone image, which never loads a page's fonts). Every file is drawn
// in memory first: an invalid spec or a font file embedFonts cannot read stops the script, naming it, before any
// file is written. Run: npm run build && node scripts/site-art.mjs after a package bump or a spec change;
// test/unit/site-brand.test.ts and test/unit/how-it-works.test.ts fail while a file differs. Not published
// (package.json files).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { coverTree, validateCoverSpec, ledgerMark, linkIcon, LINK_ICON_NAMES, symbol, toSvg } from '@brunosouzas/design-system';
import { embedFonts } from '@brunosouzas/design-system/fonts';

const repo = new URL('../', import.meta.url);
const square = (size, drawn) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${drawn.body.map(node => toSvg(node)).join('')}</svg>\n`;
const checked = name => {
  const spec = JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
  const problems = validateCoverSpec(spec);
  if (problems.length) throw new Error(`scripts/${name}: ${problems.map(p => `${p.path ?? ''} ${p.message ?? p}`).join('; ')}`);
  return spec;
};

try {
  const banner = checked('home-banner.json');
  const diagram = checked('how-it-works.json');
  const files = new Map();
  files.set('site/public/home-banner.svg', `${toSvg(coverTree(banner))}\n`);
  files.set('site/public/favicon.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32 })));
  files.set('site/public/brand-mark-dark.svg', square(32, ledgerMark({ x: 0, y: 0, size: 32, surface: 'dark' })));
  for (const icon of LINK_ICON_NAMES) for (const surface of ['light', 'dark']) files.set(`site/public/link-icons/${icon}-${surface}.svg`, square(46, linkIcon({ icon, x: 0, y: 0, surface })));
  for (const surface of ['light', 'dark']) {
    const drawn = square(32, symbol({ x: 0, y: 0, surface }));
    files.set(`site/public/symbol-${surface}.svg`, drawn);
    files.set(`docs/images/symbol-${surface}.svg`, drawn);
  }
  files.set('docs/images/how-it-works.svg', `${toSvg(await embedFonts(coverTree(diagram)))}\n`);
  for (const [path, text] of files) {
    mkdirSync(new URL('.', new URL(path, repo)), { recursive: true });
    writeFileSync(new URL(path, repo), text);
  }
  console.log('site art and how-it-works diagram written');
} catch (error) {
  process.stderr.write(`site-art: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
