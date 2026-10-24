/** The two themes, built from the tokens of @brunosouzas/design-system (metro-map: Design system
 * tokens): each `surface.<theme>`, the `map` measures and the `color` meanings of brunosouzas.com.
 * Ink outlines, pipe lines with an ink casing, hard offset shadows (indigo with a light rim on the
 * dark navy) and the Lato font stack. The pieces paint a surface's ink, the licence and renewal colours
 * and the zone opacity and title tint from the same tokens, so the renderers refuse a theme whose value
 * for any of them differs (checkInk). No fonts or other assets are fetched at render time: the stack names Lato, which the site
 * ships, then system fonts (unquoted, so no quote character reaches an SVG attribute).
 */
import { tokens } from '@brunosouzas/design-system/tokens';
import type { Box } from './labels.js';

export interface Theme {
  /** The design system surface the pieces draw on. */
  surface: 'light' | 'dark';
  background: string;
  text: string;
  muted: string;
  grid: string;
  header: string;
  headerText: string;
  station: string;
  /** Ink of outlines, casings and the text on light fills (badges keep `badgeText`). */
  outline: string;
  /** Stroke width of the ink outline around markers, badges and panels, in map units. */
  outlineWidth: number;
  licence: string;
  renewal: string;
  badgeText: string;
  panel: string;
  /** Fill of the item in the centre of the neighbourhood diagram. */
  accent: string;
  font: string;
  lineWidth: number;
  /** Radius of a bundle's centre line in a round bend (map.bendRadius). */
  bendRadius: number;
  zoneOpacity: number;
  /** Zone titles mix the zone colour with white by this amount (0 keeps the catalogue colour). */
  zoneTitleTint: number;
  casing: { enabled: boolean; color: string; extraWidth: number };
  shadow: { enabled: boolean; color: string; dx: number; dy: number };
  /** A light band around the ink outline of stickers, so the outline reads on a dark background. */
  rim: { enabled: boolean; color: string; width: number };
  /** Colours of a city backdrop (metro-map: Backdrop layer, Backdrop credit). */
  backdrop: { water: string; waterEdge: string; park: string; credit: string };
}

const M = tokens.map;
const C = tokens.color;
// The families of the design system's font.sans, without quotes.
const FONT = 'Lato, Helvetica Neue, Helvetica, Arial, sans-serif';

// TODO AB#180: replace with backdrop.* tokens. A temporary placeholder built from existing surface tokens,
// so the geometry can land before the design system release with surface.<theme>.backdrop.{water,
// waterEdge, park, credit}; the spec requires those tokens, and the tests that check them wait on AB#180.
function placeholderBackdrop(s: Readonly<Record<'grid' | 'muted' | 'panel', string>>): Theme['backdrop'] {
  return { water: s.grid, waterEdge: s.muted, park: s.panel, credit: s.muted };
}

function fromTokens(surface: 'light' | 'dark'): Theme {
  const s = tokens.surface[surface];
  return {
    surface,
    background: s.background,
    text: s.text,
    muted: s.muted,
    grid: s.grid,
    header: C.ink,
    headerText: C.white,
    station: C.white,
    outline: C.ink,
    outlineWidth: M.outline,
    licence: C.healthy,
    renewal: C.blocked,
    badgeText: C.white,
    panel: s.panel,
    accent: C.caller,
    font: FONT,
    lineWidth: M.lineWidth,
    bendRadius: M.bendRadius,
    zoneOpacity: s.zoneOpacity,
    // The zone piece tints titles on the dark surface only.
    zoneTitleTint: surface === 'dark' ? M.zoneTitleTint : 0,
    casing: { enabled: M.casing > 0, color: C.ink, extraWidth: M.casing },
    shadow: { enabled: true, color: s.shadow, dx: M.shadow, dy: M.shadow },
    rim: { enabled: s.rimWidth > 0, color: s.rim, width: s.rimWidth },
    backdrop: placeholderBackdrop(s),
  };
}

export const themes: Readonly<Record<'light' | 'dark', Theme>> = {
  light: fromTokens('light'),
  dark: fromTokens('dark'),
};

/** Throws, naming the first field that differs, when a theme's ink is not its surface's (metro-map:
 * Theme ink comes from the design system). The pieces paint outline, rim, shadow, the licence and
 * renewal colours and the zones from the tokens, and the layout counts the theme's values, so the two
 * must agree. */
export function checkInk(theme: Theme): void {
  if (theme.surface !== 'light' && theme.surface !== 'dark') throw new Error(`Theme surface must be light or dark, found ${String(theme.surface)}`);
  const own = fromTokens(theme.surface);
  const fields = ['outline', 'outlineWidth', 'shadow', 'rim', 'casing', 'lineWidth', 'bendRadius', 'licence', 'renewal', 'zoneOpacity', 'zoneTitleTint'] as const;
  for (const field of fields) {
    if (!sameValue(theme[field], own[field])) throw new Error(`Theme ${field} must be the design system's for the ${theme.surface} surface`);
  }
}

/** Equal by value: numbers, strings and booleans, or objects with the same keys holding equal values, in any order. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Object.is(a, b);
  const keys = Object.keys(b);
  return Object.keys(a).length === keys.length && keys.every(key => Object.hasOwn(a, key) && sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** How far a theme's ink reaches beyond plain geometry: the extra width of a line's casing, the
 * full width of an outline with its rim, and the shadow offset. Layout grows obstacles by it. */
export interface Ink { casing: number; outline: number; shadow: [number, number] }

export function inkOf(theme: Theme): Ink {
  return {
    casing: theme.casing.enabled ? theme.casing.extraWidth : 0,
    outline: theme.outlineWidth + (theme.rim.enabled ? theme.rim.width * 2 : 0),
    shadow: theme.shadow.enabled ? [theme.shadow.dx, theme.shadow.dy] : [0, 0],
  };
}

/** The ink that covers every given one, so one layout serves several themes. */
export function widestInk(...inks: Ink[]): Ink {
  return {
    casing: Math.max(0, ...inks.map(ink => ink.casing)),
    outline: Math.max(0, ...inks.map(ink => ink.outline)),
    shadow: [0, 1].map(axis => {
      const values = inks.map(ink => ink.shadow[axis]!);
      const most = Math.max(0, ...values);
      const least = Math.min(0, ...values);
      return Math.abs(least) > most ? least : most;
    }) as [number, number],
  };
}

/** A box as drawn with the ink: the outline (with its rim) on every side, the shadow offset beyond it. */
export function inkBox(box: Box, ink: Ink): Box {
  const half = ink.outline / 2;
  const [dx, dy] = ink.shadow;
  return { x: box.x - half + Math.min(0, dx), y: box.y - half + Math.min(0, dy), w: box.w + ink.outline + Math.abs(dx), h: box.h + ink.outline + Math.abs(dy) };
}
