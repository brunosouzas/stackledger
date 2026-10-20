/** Synthetic map builders through the real validator/views. Run npm test; no catalogue I/O. */
import { applyView, resolveHidden, type ViewName } from '../../src/views.js';
import { check, component, line, layout, set } from './helpers.js';
export { check, component, line, layout, set };
export const viewOf = (documents: unknown[], name: ViewName = 'full') => { const c = check(...documents); return applyView(c.served, name, resolveHidden(c)); };
export const journey = (name: string, stops: string[], code?: string) => set(set(line(name), 'spec.stops', stops.map(s => `component:${s}`)), 'spec.code', code);
export const positions = (stations: Record<string, number[]>) => set(layout(), 'spec.stations', Object.fromEntries(Object.entries(stations).map(([k, p]) => [`component:${k}`, p])));
