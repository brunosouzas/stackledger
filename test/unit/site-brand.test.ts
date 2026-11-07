/** The site's static art is the design system's pieces (catalogue-site: Brand mark, Home banner art, Home links,
 * Parent brand endorsement; catalogue: Home settings). Files are written by scripts/site-art.mjs. Run npm test. */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { coverTree, ledgerMark, linkIcon, LINK_ICON_NAMES, symbol, toSvg, validateCoverSpec } from '@brunosouzas/design-system';
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

test('Favicon is the page mark', () => {
  const rects = elements(read('site/public/favicon.svg')).filter(element => element.tagName !== 'svg' && element.tagName !== 'g');
  const page = rects[0]!;
  expect(page.tagName).toBe('rect');
  expect(['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke', 'stroke-width'].map(name => page.getAttribute(name))).toEqual(['0.625', '0.625', '30.75', '30.75', '6.6', '#FFFFFF', '#121212', '1.25']);
  expect(rects.filter(element => element.tagName === 'rect')).toHaveLength(1);
});

test('Dark mark is the dark ledgerMark', () => {
  const mark = read('site/public/brand-mark-dark.svg');
  expect(size(mark)).toEqual(['0 0 32 32', '32', '32']);
  expect(shapes(mark)).toEqual(shapes(body(ledgerMark({ x: 0, y: 0, size: 32, surface: 'dark' }))));
  const rects = elements(mark).filter(element => element.tagName === 'rect');
  expect(rects).toHaveLength(1);
  expect(rects[0]!.getAttribute('stroke')).toBe('#ADA79D');
});

test("Banner file is the design system's banner", () => {
  const spec = banner();
  expect(validateCoverSpec(spec)).toEqual([]);
  expect(spec.format).toBe('banner');
  expect(spec.background).toBe('neutral');
  const of = (name: string) => spec.pieces.filter((piece: { piece: string }) => piece.piece === name);
  expect(of('ledgerMark').map((piece: { size: number }) => piece.size)).toEqual([180]);
  expect(of('pipe').map((piece: { fill: string }) => piece.fill)).toEqual(['illustration.accent', 'brand.light.stackledgerAccent', 'color.ink']);
  expect(of('stationMarker').length).toBeGreaterThan(0);
  expect(of('sinal')).toHaveLength(1);
  const kinds = new Set(spec.pieces.map((piece: { piece: string }) => piece.piece));
  expect([...kinds].sort()).toEqual(['ledgerMark', 'pipe', 'sinal', 'stationMarker']);
  const file = read('site/public/home-banner.svg');
  expect(size(file)).toEqual(['0 0 1200 420', '1200', '420']);
  expect(shapes(file)).toEqual(shapes(toSvg(coverTree(spec))));
});

test('Banner has no words and no motion', () => {
  const names = elements(read('site/public/home-banner.svg')).map(element => element.tagName);
  for (const name of ['text', 'tspan', 'animate', 'animateTransform', 'animateMotion', 'set']) expect(names, name).not.toContain(name);
});

// catalogue-site "Parent brand endorsement": the footer's symbol files, and the README's copies.
test("Symbol files are the design system's", () => {
  for (const surface of ['light', 'dark'] as const) {
    const file = read(`site/public/symbol-${surface}.svg`);
    expect(size(file), surface).toEqual(['0 0 32 32', '32', '32']);
    expect(shapes(file), surface).toEqual(shapes(body(symbol({ x: 0, y: 0, surface }))));
    expect(read(`docs/images/symbol-${surface}.svg`), surface).toBe(file);
  }
  expect(read('site/public/symbol-light.svg')).not.toBe(read('site/public/symbol-dark.svg'));
});

test('Symbol files are inert', () => {
  for (const surface of ['light', 'dark']) expect(activeParts(read(`site/public/symbol-${surface}.svg`)), surface).toEqual([]);
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
  const files = ['site/public/home-banner.svg', 'site/public/brand-mark-dark.svg', 'site/public/favicon.svg', 'site/public/symbol-light.svg', 'site/public/symbol-dark.svg',
    ...readdirSync(join(repo, 'site/public/link-icons')).map((name: string) => `site/public/link-icons/${name}`)];
  for (const path of files) expect(activeParts(read(path)), path).toEqual([]);
});

test('Icon names match the design system', () => {
  expect([...HOME_LINK_ICONS].sort()).toEqual([...LINK_ICON_NAMES].sort());
});
