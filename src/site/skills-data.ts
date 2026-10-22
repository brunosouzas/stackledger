/** SkillsData: the plain JSON object the Skills pages read (skills-site spec), built once per build
 * from one skill set and copied into every view's SiteData, so the Skills pages' `main` is the same in
 * the `full` and `staff` sites. Call buildSkillsData(set).
 *
 * Why: pages never import the skills code. Every text, link, list and SVG they show is prepared here:
 * - Relations and "Reached through" come from src/skills/graph.ts, as `stackledger skills map` draws them.
 * - Links are paths from the site's root without a leading slash, under the kind folders with the item's
 *   page file name (`skills/writer/`), so every URL is lowercase ASCII and no name collides with a page.
 * - Text is cleaned of control and format characters; descriptions are one line, cut at 1,024 code points.
 * - A source file is shown as its path below its given folder; no absolute path or folder argument is
 *   ever put in the data, so the output does not depend on where the folders are.
 * Nothing comes from the catalogue view, so the staff guarantees are untouched.
 */
import { compareText } from '../identity.js';
import { layoutMap, type MapGeometry } from '../map/layout.js';
import { relations, renderRelations, MAX_SIDE_ITEMS } from '../map/relations.js';
import { renderLineBadge } from '../map/strip.js';
import { renderSvg, renderSymbol } from '../map/svg.js';
import { inkOf, themes, widestInk, type Theme } from '../map/themes.js';
import { buildGraph, compareListed, incoming, outgoing, reachedThrough, type MapNode, type NodeKind, type RelationKind } from '../skills/graph.js';
import { KIND_FOLDERS, pageFileName } from '../skills/mermaid.js';
import { buildSkillsMapModel, cleanText, stationRef } from '../skills/metro.js';
import type { SkillSet } from '../skills/source.js';

export interface Themed { light: string; dark: string }
export interface ItemLink { ref: string; name: string; kind: NodeKind; href: string }
export interface RelationLink extends ItemLink { relation: RelationKind }
export interface LineChip { ref: string; slug: string; title: string; badge: string; color: string; badgeSvg: string }
export interface RuleRow { id: string; group: string; text: string; why: string; check: string }
export interface SkillItemPage extends ItemLink {
  file: string; description: string;
  /** Absent when a side has more than MAX_SIDE_ITEMS relations; `relationCount` says how many there are. */
  diagram?: Themed; relationCount: number;
  broughtInBy: RelationLink[]; bringsIn: RelationLink[]; reachedThrough: ItemLink[];
  lines: LineChip[]; rules: RuleRow[]; files: string[];
}
export interface SkillsRow extends ItemLink { description: string; rules: number }
export interface RuleIndexRow { id: string; text: string; group: string; owner: ItemLink }
export interface SkillsData {
  counts: { skills: number; playbooks: number; agents: number; rules: number };
  rows: SkillsRow[];
  items: SkillItemPage[];
  rules: RuleIndexRow[];
  map: Themed & { empty: boolean; lines: (LineChip & { stops: ItemLink[] })[]; zones: { name: string; title: string }[]; symbols: (Themed & { label: string })[] };
}

const UNSAFE = /[\p{Cc}\p{Cf}]/gu;
const MAX_DESCRIPTION_CODE_POINTS = 1024;
/** A description for a page: one line, cleaned, cut to 1,023 code points and `…` when longer than 1,024. */
export function descriptionLine(text: string): string {
  const points = Array.from(text.replace(/\s+/g, ' ').replace(UNSAFE, '').trim());
  return points.length > MAX_DESCRIPTION_CODE_POINTS ? points.slice(0, MAX_DESCRIPTION_CODE_POINTS - 1).join('') + '…' : points.join('');
}
/** The page of an item, from the site's root: kind folder and page file name. */
export const itemHref = (kind: NodeKind, name: string): string => `${KIND_FOLDERS[kind]}/${pageFileName(name)}/`;
const link = (node: Pick<MapNode, 'kind' | 'name'>): ItemLink =>
  ({ ref: stationRef(node.kind, node.name), name: cleanText(node.name), kind: node.kind, href: itemHref(node.kind, node.name) });
const themed = (render: (theme: Theme) => string): Themed => ({ light: render(themes.light), dark: render(themes.dark) });

/** The page data of a skill set, and the skills map's geometry for the build report. */
export function buildSkillsData(set: SkillSet): { data: SkillsData; geometry: MapGeometry } {
  const graph = buildGraph(set);
  const model = buildSkillsMapModel(set);
  // Both themes from one geometry laid out with the widest ink, as the software map page does.
  const ink = widestInk(inkOf(themes.light), inkOf(themes.dark));
  const geometry = layoutMap(model, themes.light.lineWidth, ink);
  const darkGeometry = themes.dark.lineWidth === themes.light.lineWidth ? geometry : layoutMap(model, themes.dark.lineWidth, ink);
  const stations = new Map(model.stations.map(station => [station.ref, station]));
  const chip = (line: (typeof model.lines)[number]): LineChip =>
    ({ ref: line.ref, slug: line.name.toLowerCase(), title: line.title, badge: line.badge, color: line.color, badgeSvg: renderLineBadge(line) });
  const stopLink = (ref: string): ItemLink => {
    const station = stations.get(ref)!;
    const kind = ref.slice(0, ref.indexOf(':')) as NodeKind;
    return { ref, name: cleanText(station.name), kind, href: itemHref(kind, station.name) };
  };
  const sources = new Map<string, SkillSet['skills'][number] | SkillSet['agents'][number]>();
  for (const skill of set.skills) sources.set(`${skill.kind}:${skill.name}`, skill);
  for (const agent of set.agents) sources.set(`agent:${agent.name}`, agent);

  const listed = [...graph.nodes].sort(compareListed);
  const items: SkillItemPage[] = listed.map(node => {
    const source = sources.get(`${node.kind}:${node.name}`)!;
    const ref = stationRef(node.kind, node.name);
    const near = relations(graph, node);
    const left = incoming(graph, node), right = outgoing(graph, node);
    const rules = 'rules' in source ? source.rules : [];
    return {
      ...link(node), file: pageFileName(node.name), description: descriptionLine(node.description),
      ...(near ? { diagram: themed(theme => renderRelations(near, theme)) } : {}), relationCount: left.length + right.length,
      broughtInBy: left.map(edge => ({ ...link(edge.from), relation: edge.kind })),
      bringsIn: right.map(edge => ({ ...link(edge.to), relation: edge.kind })),
      reachedThrough: reachedThrough(graph, node).map(link),
      lines: model.lines.filter(line => line.stops.includes(ref)).map(chip),
      rules: rules.map(rule => ({ id: cleanText(rule.id), group: cleanText(rule.group ?? ''), text: cleanText(rule.text), why: cleanText(rule.why ?? ''), check: cleanText(rule.check ?? '') })),
      files: source.files.map(file => file.below),
    };
  });
  const rules: RuleIndexRow[] = items.flatMap(item => item.rules.map(rule => ({ id: rule.id, text: rule.text, group: rule.group,
    owner: { ref: item.ref, name: item.name, kind: item.kind, href: item.href } })))
    .sort((one, two) => compareText(one.id, two.id) || compareText(one.owner.name, two.owner.name));
  const count = (kind: NodeKind) => graph.nodes.filter(node => node.kind === kind).length;
  return {
    data: {
      counts: { skills: count('skill'), playbooks: count('playbook'), agents: count('agent'), rules: rules.length },
      rows: items.map(item => ({ ref: item.ref, name: item.name, kind: item.kind, href: item.href, description: item.description, rules: item.rules.length })),
      items, rules,
      map: {
        light: renderSvg(geometry, themes.light, { chrome: false }),
        dark: renderSvg(darkGeometry, themes.dark, { chrome: false }),
        empty: model.lines.length === 0,
        lines: model.lines.map(line => ({ ...chip(line), stops: line.stops.map(stopLink) })),
        zones: geometry.zones.map(zone => ({ name: zone.name, title: zone.title })),
        symbols: geometry.legend.symbols.map(symbol => ({ label: symbol[0]!.toUpperCase() + symbol.slice(1), ...themed(theme => renderSymbol(symbol, theme)) })),
      },
    },
    geometry,
  };
}
export { MAX_SIDE_ITEMS };
