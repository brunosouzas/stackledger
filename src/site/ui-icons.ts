/** The site's interface icons: the design system's uiIcon, as SVG text inlined in the page's HTML at
 * build time. Button icons paint with currentColor, so they follow the button's text colour when it
 * inverts on hover and when pressed; the theme switch keeps token colours (sun white, moon ink).
 * Inline, never an <img> or a CSS background: there the SVG is another document and currentColor
 * would not reach it. The SVG holds no style, script or URL. Pure, no I/O.
 */
import { el, toSvg, uiIcon } from '@brunosouzas/design-system';

export type IconName = 'zoomIn' | 'zoomOut' | 'reset' | 'download' | 'sun' | 'moon';

const COLOURS: Record<IconName, string> = {
  zoomIn: 'currentColor', zoomOut: 'currentColor', reset: 'currentColor', download: 'currentColor',
  sun: 'color.white', moon: 'color.ink',
};

/** One icon as a 16 x 16 inline SVG, hidden from assistive technology (the button names itself). */
export function iconSvg(name: IconName, size = 16): string {
  return toSvg(el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' },
    ...uiIcon({ name, x: 0, y: 0, colour: COLOURS[name] }).body));
}

export function siteIcons(): Record<IconName, string> {
  return Object.fromEntries((Object.keys(COLOURS) as IconName[]).map(name => [name, iconSvg(name)])) as Record<IconName, string>;
}
