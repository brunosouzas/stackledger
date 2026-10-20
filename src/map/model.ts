/** Reduce one served view to drawing data. Call buildMapModel(view, ISO date).
 * Never reads the catalogue or hidden fields; staff deliberately never evaluates the date.
 * Cross-document layout conflicts keep their source order; invalid full dates throw.
 */
import type { View } from '../views.js';
import { reference, compareRefs, isDate, compareText } from '../identity.js';
export type Point = [number, number];
export interface MapLine { ref: string; name: string; title: string; badge: string; color: string; stops: string[] }
export interface MapStation { ref: string; name: string; title: string; lines: string[]; deprecated: boolean; zone: string | undefined; licence: 'none' | 'solid' | 'hollow'; renewal: boolean }
export interface MapZone { name: string; title: string; color: string }
export interface MapModel { view: View['name']; lines: MapLine[]; stations: MapStation[]; positions: Map<string, Point>; occupied: Point[]; zones: MapZone[] }
export function buildMapModel(view: View, date: string): MapModel {
  // Even a custom staff view that exposes renewsOn must remain date independent.
  if (view.name === 'full' && !isDate(date)) throw new Error('Map date must be a real YYYY-MM-DD date');
  const windowStart = view.name === 'full' ? Date.parse(`${date}T00:00:00Z`) : 0;
  const windowEnd = windowStart + 30 * 86400000;
  const components = new Map(view.components.map(c => [`component:${c.metadata.name.toLowerCase()}`, c]));
  const licences = new Map(view.licences.map(l => [`resource:${l.metadata.name.toLowerCase()}`, l]));
  const lines = [...view.lines].sort((a,b) => {
    const ac = a.spec.code, bc = b.spec.code;
    return (ac === undefined ? 1 : 0) - (bc === undefined ? 1 : 0)
      || compareText(ac?.toUpperCase() ?? '', bc?.toUpperCase() ?? '') || compareText(a.metadata.name,b.metadata.name);
  }).map(line => ({ ref: `line:${line.metadata.name}`, name: line.metadata.name, title: line.metadata.title ?? line.metadata.name,
    badge: line.spec.code ?? Array.from(line.metadata.name)[0]!.toUpperCase(), color: line.spec.color,
    stops: line.spec.stops.flatMap(value => { const r=reference(value); const c=r?.kind==='component' && r.namespace==='default' ? components.get(r.key) : undefined; return c ? [`component:${c.metadata.name}`] : []; })
  })).filter(line => line.stops.length >= 2);
  const drawn = new Set(lines.flatMap(l=>l.stops));
  const stations: MapStation[] = [...components.values()].filter(c=>drawn.has(`component:${c.metadata.name}`)).map((c): MapStation => {
    const details = (c.spec.dependsOn ?? []).flatMap(value => { const r=reference(value); const l=r?.namespace==='default' ? licences.get(r.key) : undefined; return l?.spec.licence ? [l.spec.licence] : []; });
    const solid = details.filter(l=>l.status==='active' || l.status==='to-confirm');
    return { ref:`component:${c.metadata.name}`, name:c.metadata.name, title:c.metadata.title ?? c.metadata.name,
      lines:lines.filter(l=>l.stops.includes(`component:${c.metadata.name}`)).map(l=>l.ref), deprecated:c.spec.lifecycle.toLowerCase()==='deprecated',
      zone:c.metadata.labels?.['stackledger/zone']?.toLowerCase(), licence:solid.length ? 'solid' : details.some(l=>l.status==='to-buy') ? 'hollow' : 'none',
      renewal:view.name==='full' && solid.some(l=>isDate(l.renewsOn) && Date.parse(`${l.renewsOn}T00:00:00Z`)>=windowStart && Date.parse(`${l.renewsOn}T00:00:00Z`)<=windowEnd) };
  }).sort((a,b)=>compareRefs(a.ref,b.ref));
  const positions = new Map<string,Point>(), occupied:Point[] = [], seen=new Set<string>(), cells=new Set<string>();
  for (const [value,point] of Object.entries(view.layout?.spec.stations ?? {})) {
    occupied.push([...point]);
    const r=reference(value), c=r?.namespace==='default' ? components.get(r.key) : undefined;
    const ref=c ? `component:${c.metadata.name}` : undefined, cell=point.join(',');
    if (ref && !seen.has(ref) && !cells.has(cell)) positions.set(ref,[...point]);
    if (ref) seen.add(ref);
    // Undrawn and even unresolved stored keys still reserve their cell.
    cells.add(cell);
  }
  return { view:view.name, lines, stations, positions, occupied, zones:structuredClone(view.layout?.spec.zones ?? []) };
}
