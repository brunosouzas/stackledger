/** All visual constants for the two supported themes. The renderers consume only Theme data.
 * Both themes follow the illustrated diagrams of brunosouzas.com: ink outlines, pipe lines with an
 * ink casing, hard offset shadows (indigo with a light rim on the dark navy) and the Lato font stack.
 * Extend data for later styles; no name-based renderer branches. No fonts or other assets are
 * fetched at render time: the stack names Lato, which the site ships, then system fonts.
 */
import type { Box } from './labels.js';

export interface Theme {
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
  zoneOpacity: number;
  /** Zone titles mix the zone colour with white by this amount (0 keeps the catalogue colour). */
  zoneTitleTint: number;
  casing: { enabled: boolean; color: string; extraWidth: number };
  shadow: { enabled: boolean; color: string; dx: number; dy: number };
  /** A light band around the ink outline of stickers, so the outline reads on a dark background. */
  rim: { enabled: boolean; color: string; width: number };
}

// Unquoted family names are valid CSS and keep quote characters out of SVG attributes.
const FONT = 'Lato, Helvetica Neue, Helvetica, Arial, sans-serif';
const INK = '#0A1033';

export const themes: Readonly<Record<'light' | 'dark', Theme>> = {
  light: {
    background: '#EEF2FF',
    text: INK,
    muted: '#5B6694',
    grid: '#E0E7FB',
    header: INK,
    headerText: '#FFFFFF',
    station: '#FFFFFF',
    outline: INK,
    outlineWidth: 3,
    licence: '#FFD25A',
    renewal: '#FF8A3D',
    badgeText: '#FFFFFF',
    panel: '#FFFFFF',
    accent: '#8FB2FF',
    font: FONT,
    lineWidth: 12,
    zoneOpacity: 0.12,
    zoneTitleTint: 0,
    casing: { enabled: true, color: INK, extraWidth: 6 },
    shadow: { enabled: true, color: INK, dx: 3.5, dy: 3.5 },
    rim: { enabled: false, color: '#EEF1FF', width: 1 },
  },
  dark: {
    background: '#14215A',
    text: '#EEF1FF',
    muted: '#8F9BD0',
    grid: '#1C2D74',
    header: INK,
    headerText: '#FFFFFF',
    station: '#FFFFFF',
    outline: INK,
    outlineWidth: 3,
    licence: '#FFD25A',
    renewal: '#FF8A3D',
    badgeText: '#FFFFFF',
    panel: '#1C2D74',
    accent: '#8FB2FF',
    font: FONT,
    lineWidth: 12,
    zoneOpacity: 0.22,
    zoneTitleTint: 0.6,
    casing: { enabled: true, color: INK, extraWidth: 6 },
    shadow: { enabled: true, color: '#4C5CB8', dx: 3.5, dy: 3.5 },
    rim: { enabled: true, color: '#EEF1FF', width: 1 },
  },
};

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
