/** Reduce one served view to drawing data. Call buildMapModel(view, ISO date).
 * Never reads the catalogue or hidden fields; staff deliberately never evaluates the date.
 * Cross-document layout conflicts keep their source order; invalid full dates throw.
 */
import type { View } from '../views.js';
import { reference, compareRefs, isDate, compareText } from '../identity.js';

export type Point = [number, number];
export interface MapLine { ref: string; name: string; title: string; badge: string; color: string; stops: string[] }
export interface MapStation {
  ref: string;
  name: string;
  title: string;
  lines: string[];
  deprecated: boolean;
  /** The zones the station is in, in declaration order: at most one on a software map (its lower-cased
   * `stackledger/zone`), any number of playbook page file names on a skills map, where zones may overlap. */
  zones: string[];
  licence: 'none' | 'solid' | 'hollow';
  renewal: boolean;
  /** Skills map only: the number of rules of the station's skill or playbook (none or 0: no rule count). */
  rules?: number;
}
export interface MapZone { name: string; title: string; color: string }
/** A software map comes from a catalogue view; a skills map from a skill set (src/skills/metro.ts). */
export type MapKind = 'software' | 'skills';
export interface MapModel {
  /** Absent: a software map, as before skills maps existed. */
  kind?: MapKind;
  view: View['name'];
  lines: MapLine[];
  stations: MapStation[];
  positions: Map<string, Point>;
  occupied: Point[];
  zones: MapZone[];
}

type Component = View['components'][number];
type Licence = View['licences'][number];
type Line = View['lines'][number];

const DAY = 86400000;

/** Lines with a code first (upper-cased, by code point), then lines without; ties by name. */
function compareLines(one: Line, two: Line): number {
  const first = one.spec.code;
  const second = two.spec.code;
  return (first === undefined ? 1 : 0) - (second === undefined ? 1 : 0)
    || compareText(first?.toUpperCase() ?? '', second?.toUpperCase() ?? '')
    || compareText(one.metadata.name, two.metadata.name);
}

function drawnLines(view: View, components: Map<string, Component>): MapLine[] {
  return [...view.lines].sort(compareLines).map(line => ({
    ref: `line:${line.metadata.name}`,
    name: line.metadata.name,
    title: line.metadata.title ?? line.metadata.name,
    badge: line.spec.code ?? Array.from(line.metadata.name)[0]!.toUpperCase(),
    color: line.spec.color,
    // A stop repeated back to back (after skipping unserved stops) is one stop, not a zero-length hop.
    stops: line.spec.stops.flatMap(value => {
      const target = reference(value);
      const found = target?.kind === 'component' && target.namespace === 'default' ? components.get(target.key) : undefined;
      return found ? [`component:${found.metadata.name}`] : [];
    }).filter((stop, index, stops) => index === 0 || stop !== stops[index - 1]),
  })).filter(line => line.stops.length >= 2);
}

export function buildMapModel(view: View, date: string): MapModel {
  // Even a custom staff view that exposes renewsOn must remain date independent.
  if (view.name === 'full' && !isDate(date)) throw new Error('Map date must be a real YYYY-MM-DD date');
  const windowStart = view.name === 'full' ? Date.parse(`${date}T00:00:00Z`) : 0;
  const windowEnd = windowStart + 30 * DAY;
  const components = new Map(view.components.map(item => [`component:${item.metadata.name.toLowerCase()}`, item]));
  const licences = new Map(view.licences.map(item => [`resource:${item.metadata.name.toLowerCase()}`, item]));
  const lines = drawnLines(view, components);
  const drawn = new Set(lines.flatMap(line => line.stops));

  const station = (item: Component): MapStation => {
    const ref = `component:${item.metadata.name}`;
    const details = (item.spec.dependsOn ?? []).flatMap(value => {
      const target = reference(value);
      const found: Licence | undefined = target?.namespace === 'default' ? licences.get(target.key) : undefined;
      return found?.spec.licence ? [found.spec.licence] : [];
    });
    const solid = details.filter(detail => detail.status === 'active' || detail.status === 'to-confirm');
    const renewsSoon = (renewsOn: string | undefined): boolean => {
      if (renewsOn === undefined || !isDate(renewsOn)) return false;
      const time = Date.parse(`${renewsOn}T00:00:00Z`);
      return time >= windowStart && time <= windowEnd;
    };
    return {
      ref,
      name: item.metadata.name,
      title: item.metadata.title ?? item.metadata.name,
      lines: lines.filter(line => line.stops.includes(ref)).map(line => line.ref),
      deprecated: item.spec.lifecycle.toLowerCase() === 'deprecated',
      zones: [item.metadata.labels?.['stackledger/zone']?.toLowerCase()].filter((zone): zone is string => zone !== undefined),
      licence: solid.length ? 'solid' : details.some(detail => detail.status === 'to-buy') ? 'hollow' : 'none',
      renewal: view.name === 'full' && solid.some(detail => renewsSoon(detail.renewsOn)),
    };
  };
  const stations = [...components.values()]
    .filter(item => drawn.has(`component:${item.metadata.name}`))
    .map(station)
    .sort((one, two) => compareRefs(one.ref, two.ref));

  const positions = new Map<string, Point>();
  const occupied: Point[] = [];
  const seen = new Set<string>();
  const cells = new Set<string>();
  for (const [value, point] of Object.entries(view.layout?.spec.stations ?? {})) {
    occupied.push([...point]);
    const target = reference(value);
    const found = target?.namespace === 'default' ? components.get(target.key) : undefined;
    const ref = found ? `component:${found.metadata.name}` : undefined;
    const cell = point.join(',');
    if (ref && !seen.has(ref) && !cells.has(cell)) positions.set(ref, [...point]);
    if (ref) seen.add(ref);
    // Undrawn and even unresolved stored keys still reserve their cell.
    cells.add(cell);
  }
  return { view: view.name, lines, stations, positions, occupied, zones: structuredClone(view.layout?.spec.zones ?? []) };
}
