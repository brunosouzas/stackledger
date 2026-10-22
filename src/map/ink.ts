/** The ink style's sticker: a shape with the theme's ink outline, after its hard shadow (a copy
 * moved by the theme offset, in the shadow colour) and, on dark themes, a light rim round it.
 * Shared by the map and the page diagrams; `scale` sizes outline, rim and offset to a drawing
 * (1 for the map). Pure: returns SVG text built with tag() by the given shape function.
 */
import type { Point } from './model.js';
import type { Theme } from './themes.js';
import type { Attributes } from './xml.js';

/** Draws the shape moved by `by` with the given paint attributes. */
export type Shape = (by: Point, attrs: Attributes) => string;

export function sticker(theme: Theme, shape: Shape, fill: string, scale = 1): string {
  const outline = theme.outlineWidth * scale;
  const rimmed = outline + (theme.rim.enabled ? theme.rim.width * 2 * scale : 0);
  return [
    theme.shadow.enabled ? shape([theme.shadow.dx * scale, theme.shadow.dy * scale], { fill: theme.shadow.color, stroke: theme.shadow.color, 'stroke-width': rimmed }) : '',
    theme.rim.enabled ? shape([0, 0], { fill: theme.rim.color, stroke: theme.rim.color, 'stroke-width': rimmed }) : '',
    shape([0, 0], { fill, stroke: theme.outline, 'stroke-width': outline }),
  ].join('');
}
