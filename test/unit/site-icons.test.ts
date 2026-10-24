/** The site's interface icons (catalogue-site: Inline icon markup, "Icon is the design system's").
 * Run npm test.
 */
import { expect, test } from 'vitest';
import { el, toSvg, uiIcon } from '@brunosouzas/design-system';
import { iconSvg, siteIcons } from '../../src/site/ui-icons.js';

const COLOURS = { zoomIn: 'currentColor', zoomOut: 'currentColor', reset: 'currentColor', download: 'currentColor', sun: 'color.white', moon: 'color.ink' } as const;

test("Icon is the design system's", () => {
  const icons = siteIcons();
  expect(Object.keys(icons).sort()).toEqual(Object.keys(COLOURS).sort());
  for (const [name, colour] of Object.entries(COLOURS)) {
    const root = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' };
    const expected = toSvg(el('svg', root, ...uiIcon({ name, x: 0, y: 0, colour }).body));
    expect(icons[name as keyof typeof COLOURS], name).toBe(expected);
    expect(iconSvg(name as keyof typeof COLOURS)).toBe(expected);
  }
  // The button icons follow the text colour; the switch keeps token colours.
  for (const name of ['zoomIn', 'zoomOut', 'reset', 'download'] as const) expect(icons[name]).toContain('fill="currentColor" stroke="currentColor"');
  expect(icons.sun).toContain('fill="#FFFFFF"');
  expect(icons.moon).toContain('fill="#0A1033"');
});
