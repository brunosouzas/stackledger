/** catalogue-site "Brand mark": the favicon is the design system's ledgerMark. Run npm test. */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ledgerMark, toSvg } from '@brunosouzas/design-system';
import { parseSvg } from './svg-helpers.js';

const shapes = (svg: string) => Array.from(parseSvg(svg).getElementsByTagName('*'))
  .filter(element => element.tagName !== 'svg')
  .map(element => [element.tagName, Object.fromEntries(Array.from(element.attributes).map(attr => [attr.name, attr.value]))]);

test('Favicon is the mark', () => {
  const favicon = readFileSync(join(import.meta.dirname, '../../site/public/favicon.svg'), 'utf8');
  const root = parseSvg(favicon).documentElement;
  expect([root.getAttribute('viewBox'), root.getAttribute('width'), root.getAttribute('height')]).toEqual(['0 0 32 32', '32', '32']);
  const mark = ledgerMark({ x: 0, y: 0, size: 32 });
  const expected = `<svg xmlns="http://www.w3.org/2000/svg">${mark.body.map(node => toSvg(node)).join('')}</svg>`;
  expect(shapes(favicon)).toEqual(shapes(expected));
});
