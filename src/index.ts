/** Catalogue validation library. Build with npm run build; invalid inputs become problems. */
export { validateFolder, validateLoaded, validateSources } from './validate.js';
export type { Catalogue, Result, Summary, Served, OtherResource } from './validate.js';
export type { Entity, Component, Licence, Line, MapLayout, Settings } from './schema.js';
export type { Problem } from './source.js';
