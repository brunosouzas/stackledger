/** The site's static art is the design system's pieces (catalogue-site: Brand mark, Home banner art, Home links;
 * catalogue: Home settings). Files are written by scripts/site-art.mjs. Run npm test. */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { coverTree, ledgerMark, linkIcon, LINK_ICON_NAMES, toSvg, validateCoverSpec } from '@brunosouzas/design-system';
import { HOME_LINK_ICONS } from '../../src/schema.js';
import { activeParts, parseSvg } from './svg-helpers.js';

const repo = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');
const elements = (svg: string) => Array.from(parseSvg(svg).getElementsByTagName('*'));
const shapes = (svg: string) => elements(svg)
  .filter(element => element.tagName !== 'svg')
  .map(element => [element.tagName, Object.fromEntries(Array.from(element.attributes).map(attr => [attr.name, attr.value])), (element as any).childElementCount ? '' : element.textContent]);
const body = (drawn: { body: readonly any[] }) => `<svg xmlns="http://www.w3.org/2000/svg">${drawn.body.map(node => toSvg(node)).join('')}</svg>`;
const size = (svg: string) => { const root = parseSvg(svg).documentElement!; return [root.getAttribute('viewBox'), root.getAttribute('width'), root.getAttribute('height')]; };
const banner = () => JSON.parse(read('scripts/home-banner.json'));

test('Favicon is the mark', () => {
  const favicon = read('site/public/favicon.svg');
  expect(size(favicon)).toEqual(['0 0 32 32', '32', '32']);
  expect(shapes(favicon)).toEqual(shapes(body(ledgerMark({ x: 0, y: 0, size: 32 }))));
});

test('Dark mark is the dark ledgerMark', () => {
  const mark = read('site/public/brand-mark-dark.svg');
  expect(size(mark)).toEqual(['0 0 32 32', '32', '32']);
  expect(shapes(mark)).toEqual(shapes(body(ledgerMark({ x: 0, y: 0, size: 32, surface: 'dark' }))));
});

test("Banner file is the design system's banner", () => {
  const spec = banner();
  expect(validateCoverSpec(spec)).toEqual([]);
  expect(spec.format).toBe('banner');
  const badges = spec.pieces.filter((piece: { piece: string }) => piece.piece === 'lineBadge');
  expect(badges).toHaveLength(3);
  for (const badge of badges) expect(badge).not.toHaveProperty('text');
  expect(spec.pieces.some((piece: { piece: string }) => piece.piece === 'ledgerMark')).toBe(false);
  const file = read('site/public/home-banner.svg');
  expect(size(file)).toEqual(['0 0 1200 420', '1200', '420']);
  expect(shapes(file)).toEqual(shapes(toSvg(coverTree(spec))));
});

test("Link icon files are the design system's", () => {
  expect(readdirSync(join(repo, 'site/public/link-icons')).sort()).toEqual(LINK_ICON_NAMES.flatMap(name => [`${name}-dark.svg`, `${name}-light.svg`]).sort());
  for (const icon of LINK_ICON_NAMES) for (const surface of ['light', 'dark'] as const) {
    const file = read(`site/public/link-icons/${icon}-${surface}.svg`);
    expect(size(file), `${icon}-${surface}`).toEqual(['0 0 46 46', '46', '46']);
    expect(shapes(file), `${icon}-${surface}`).toEqual(shapes(body(linkIcon({ icon, x: 0, y: 0, surface }))));
  }
});

test('Site art is inert: the check itself', () => {
  const mark = read('site/public/brand-mark-dark.svg');
  expect(activeParts(mark)).toEqual([]);
  for (const bad of ['fill="URL(https://example.org/x.svg#p)"', 'fill="url( https://example.org/x )"', 'onload="alert(1)"', 'style="fill:red"', 'fill="u\\72l(x)"']) {
    expect(activeParts(mark.replace('<svg ', `<svg ${bad} `)), bad).not.toEqual([]);
  }
});

test('Site art is inert', () => {
  const files = ['site/public/home-banner.svg', 'site/public/brand-mark-dark.svg', 'site/public/favicon.svg',
    ...readdirSync(join(repo, 'site/public/link-icons')).map((name: string) => `site/public/link-icons/${name}`)];
  for (const path of files) expect(activeParts(read(path)), path).toEqual([]);
});

test('Icon names match the design system', () => {
  expect([...HOME_LINK_ICONS].sort()).toEqual([...LINK_ICON_NAMES].sort());
});
