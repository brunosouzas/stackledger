/** The shape of a bundled city backdrop (metro-map: Backdrop data). Generated modules such as london.ts
 * export one; src/map/svg.ts draws it. Coordinates are whole metres, y up. */
export interface Backdrop {
  name: string;
  /** The OpenStreetMap extract date (Overpass timestamp). */
  extractDate: string;
  /** Bounding box of every point, y up: x and y are the minimums. */
  box: { x: number; y: number; w: number; h: number };
  /** Rings of the water, each flat [x0, y0, x1, y1, ...], open; outer rings counter-clockwise, holes clockwise. */
  water: readonly (readonly number[])[];
  /** Rings of the parks, in the same form. */
  park: readonly (readonly number[])[];
}
