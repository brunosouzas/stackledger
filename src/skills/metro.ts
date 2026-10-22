/** The skills metro map's drawing data (metro-map spec: Station references, Skills map input, Skills
 * map drawing, Skills map zones). Call buildSkillsMapModel(set), then layoutMap and renderSvg from
 * src/map/ as for a software map. Pure: no I/O, and the result depends on no view and no date.
 *
 * Why this shape:
 * - Station references use the item's page file name (`skill:<file>`), never the raw name: names may
 *   hold characters XML replaces with U+FFFD, so two names could share one `data-ref`; file names are
 *   ASCII and unique per kind. Labels and titles carry the name, cleaned of control and format characters.
 * - The served lines and layout (src/skills/lines.ts) are resolved against the set again here: a stop or
 *   zone whose check failed simply names no item of its kind and is skipped, so nothing is drawn twice.
 * - Zones are the layout's playbook zones; a station joins every zone whose members hold its item.
 */
import { compareText } from '../identity.js';
import type { MapLine, MapModel, MapStation, MapZone, Point } from '../map/model.js';
import { splitReference, zoneMembers, type ItemKind } from './lines.js';
import { pageFileName } from './mermaid.js';
import type { SkillSet } from './source.js';

/** Control characters (C0, DEL, C1) and format characters (zero-width, bidirectional, tag characters). */
const UNSAFE = /[\p{Cc}\p{Cf}]/gu;
/** A name or title for the map: control and format characters removed. */
export const cleanText = (text: string): string => text.replace(UNSAFE, '');

/** The station reference of an item: its kind and page file name. */
export const stationRef = (kind: ItemKind, name: string): string => `${kind}:${pageFileName(name)}`;

/** Lines with a code first (upper-cased, by code point), then lines without; ties by name, as on a software map. */
function compareLines(one: SkillSet['map']['lines'][number], two: SkillSet['map']['lines'][number]): number {
  const first = one.spec.code, second = two.spec.code;
  return (first === undefined ? 1 : 0) - (second === undefined ? 1 : 0)
    || compareText(first?.toUpperCase() ?? '', second?.toUpperCase() ?? '')
    || compareText(one.metadata.name, two.metadata.name);
}

export function buildSkillsMapModel(set: Pick<SkillSet, 'skills' | 'agents' | 'map'>): MapModel {
  const items = new Map<string, { kind: ItemKind; name: string }>();
  for (const skill of set.skills) items.set(`${skill.kind}:${skill.name}`, { kind: skill.kind, name: skill.name });
  for (const agent of set.agents) items.set(`agent:${agent.name}`, { kind: 'agent', name: agent.name });
  /** The station reference of a map-file key, or undefined when it names no item of its kind. */
  const resolve = (value: string): string | undefined => {
    const ref = splitReference(value);
    const item = ref ? items.get(`${ref.kind}:${ref.name}`) : undefined;
    return item ? stationRef(item.kind, item.name) : undefined;
  };
  const lines: MapLine[] = [...set.map.lines].sort(compareLines).map(line => ({
    ref: `line:${line.metadata.name}`,
    name: line.metadata.name,
    title: cleanText(line.metadata.title ?? '') || line.metadata.name,
    badge: line.spec.code ?? Array.from(line.metadata.name)[0]!.toUpperCase(),
    color: line.spec.color,
    // A stop repeated back to back (after skipping the ones not in the set) is one stop.
    stops: line.spec.stops.flatMap(value => resolve(value) ?? []).filter((stop, index, stops) => index === 0 || stop !== stops[index - 1]),
  })).filter(line => line.stops.length >= 2);

  // Playbook zones in declaration order, each keyed by its playbook's page file name.
  const zones: MapZone[] = [];
  const zoneOf = new Map<string, string[]>();
  for (const zone of set.map.layout?.spec.zones ?? []) {
    const members = zoneMembers(set, zone.name);
    if (!members.length) continue;
    const key = pageFileName(zone.name);
    if (zones.some(earlier => earlier.name === key)) continue;
    zones.push({ name: key, title: cleanText(zone.title) || cleanText(zone.name) || key, color: zone.color });
    for (const member of members) {
      const ref = resolve(member);
      if (ref) zoneOf.set(ref, [...(zoneOf.get(ref) ?? []), key]);
    }
  }

  const drawn = new Set(lines.flatMap(line => line.stops));
  const stations: MapStation[] = [...items.values()]
    .filter(item => drawn.has(stationRef(item.kind, item.name)))
    .map(item => {
      const ref = stationRef(item.kind, item.name);
      return { ref, name: item.name, title: cleanText(item.name), lines: lines.filter(line => line.stops.includes(ref)).map(line => line.ref),
        deprecated: false, zones: zoneOf.get(ref) ?? [], licence: 'none' as const, renewal: false };
    })
    .sort((one, two) => compareText(one.ref, two.ref));

  const positions = new Map<string, Point>();
  const occupied: Point[] = [];
  const seen = new Set<string>();
  const cells = new Set<string>();
  for (const [value, point] of Object.entries(set.map.layout?.spec.stations ?? {})) {
    occupied.push([...point]);
    const ref = resolve(value);
    const cell = point.join(',');
    if (ref && !seen.has(ref) && !cells.has(cell)) positions.set(ref, [...point]);
    if (ref) seen.add(ref);
    // Keys naming no item still reserve their cell, as on a software map.
    cells.add(cell);
  }
  return { kind: 'skills', view: 'full', lines, stations, positions, occupied, zones };
}
