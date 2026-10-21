/** Catalogue validation and SVG map library. Build with npm run build.
 * Validate inputs, apply a view, build its model, lay out geometry and render with Theme data.
 * Invalid catalogue documents become problems; unexpected invalid SVG geometry throws. */
export { validateFolder, validateLoaded, validateSources } from './validate.js';
export type { Catalogue, Result, Summary, Served, OtherResource } from './validate.js';
export type { Entity, Component, Licence, Line, MapLayout, Settings } from './schema.js';
export type { Problem } from './source.js';

export { buildMapModel } from './map/model.js';
export { layoutMap } from './map/layout.js';
export { renderSvg } from './map/svg.js';
export { themes, inkOf } from './map/themes.js';
export type { MapModel, MapLine, MapStation, Point } from './map/model.js';
export type { MapGeometry } from './map/layout.js';
export type { Theme, Ink } from './map/themes.js';
