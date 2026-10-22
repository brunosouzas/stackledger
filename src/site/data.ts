/** SiteData: the one plain JSON object a site's Astro pages read, built from one view only.
 *
 * Why: pages never import the catalogue code (design D1). Every text, link, list and SVG a page
 * shows is prepared here from applyView's output, so the staff site cannot reach a hidden value.
 * Call buildSiteData(catalogue, 'staff', version) or buildSiteData(catalogue, 'full', version, date).
 *
 * The staff data never reads the date (the map model ignores it for staff), so staff output depends
 * only on what the staff view serves. A full build without a real date throws. Links are paths from
 * the site's root without a leading slash ('software/editor/'); the layout makes them relative.
 * Owners show by name when `owners` (from src/site/owners.ts) names them, else as the raw reference.
 * The map is drawn without its title band and legend: the page shows both in HTML (`symbols`).
 *
 * The full data also carries the licence report (src/reports.ts) for the Reports page, at the map's
 * date with a 90-day window, and the full build returns the renewal calendar text (src/ics.ts) for
 * renewals.ics. Only FullSiteData has a `report` field, so staff data holding one is a type error.
 */
import { compareRefs } from '../identity.js';
import { buildGraph, impact, linesOf, summary, type Graph, type Item } from '../graph.js';
import { buildMapModel, type MapLine, type MapModel } from '../map/model.js';
import { layoutMap, type MapGeometry } from '../map/layout.js';
import { neighbourhood, renderNeighbourhood, type DiagramNode } from '../map/neighbourhood.js';
import { renderLineBadge, renderStrip, strip } from '../map/strip.js';
import { renderSvg, renderSymbol } from '../map/svg.js';
import { displayOwner } from './owners.js';
import { inkOf, themes, widestInk, type Theme } from '../map/themes.js';
import { applyView, resolveHidden, settingsInError, type ViewName } from '../views.js';
import type { Catalogue } from '../validate.js';
import { licenceFields, type Licence, type LicenceField, type SiteColorName } from '../schema.js';
import { calendarNamespace, renderCalendar } from '../ics.js';
import { formatAmount, type Amount } from '../money.js';
import type { SkillsData } from './skills-data.js';
import { buildReport, type Group, type LicenceLink, type OneOffRow, type RenewalEntry, type Report, type TotalRow } from '../reports.js';

export const DEFAULT_TITLE = 'Software map';
/** The renewal window of the site's Reports page and calendar (licence-reports, Source and date). */
export const REPORT_DAYS = 90;
export const CALENDAR_FILE = 'renewals.ics';

export interface Link { ref: string; title: string; href?: string }
export interface Field { label: string; value: string }
export interface Themed { light: string; dark: string }
export interface Impact { dependants: (Link & { depth: number })[]; lines: Link[]; truncated: boolean }
export interface LineSummary { ref: string; slug: string; title: string; badge: string; color: string; badgeSvg: string; stops: number; href: string }
export interface SoftwareRow { ref: string; href: string; title: string; kind: 'component' | 'licence'; type: string; state: string; owner: string; zone: string }
export interface ComponentPage {
  ref: string; slug: string; name: string; title: string; description?: string; type: string; lifecycle: string; owner: string; zone?: string; tags: string[];
  licences: (Link & { fields: Field[] })[]; journeys: Link[]; unresolved: string[]; impact: Impact;
  neighbourhood: Themed & { dependencies: Link[]; dependants: Link[] };
}
export interface LicencePage { ref: string; slug: string; name: string; title: string; owner: string; fields: Field[]; usedBy: Link[]; impact: Impact }
export interface JourneyPage extends LineSummary { strip: Themed; stopList: (Link & { lines: Link[] })[] }
/** Report amounts as the page shows them: two decimals, or `—` when no complete licence adds to it. */
export interface MoneyRow { currency: string; monthly: string; yearly: string; incomplete: number }
export interface OneOffMoneyRow { currency: string; total: string; incomplete: number }
export interface ReportRenewal extends Link { date: string; vendor: string; cycle: string; cost: string }
export interface ReportGrouping { key: 'owner' | 'payer' | 'zone'; title: string; column: string; groups: { label: string; synthetic: boolean; rows: MoneyRow[] }[] }
export interface ReportPage {
  date: string; to: string; days: number; empty: boolean; calendar: string;
  renewals: ReportRenewal[]; overdue: ReportRenewal[]; unknownDates: Link[];
  recurring: MoneyRow[]; groupings: ReportGrouping[];
  oneOff: { items: (Link & { cost: string; renewsOn: string })[]; totals: OneOffMoneyRow[] };
  planned: { items: (Link & { cycle: string; cost: string; monthly: string; yearly: string })[]; recurring: MoneyRow[]; oneOff: OneOffMoneyRow[] };
  incomplete: (Link & { status: string; unknown: string })[];
}
interface SiteBase {
  version: string; title: string; colors: Partial<Record<SiteColorName, string>>;
  map: Themed & { lines: LineSummary[]; zones: { name: string; title: string }[]; symbols: (Themed & { label: string })[] };
  rows: SoftwareRow[]; filters: { kind: string[]; zone: string[]; state: string[]; owner: string[] };
  components: ComponentPage[]; licences: LicencePage[]; journeys: JourneyPage[];
  /** The Skills section (src/site/skills-data.ts), the same object in every view; absent without a skill set. */
  skills?: SkillsData;
}
export interface StaffSiteData extends SiteBase { view: 'staff' }
export interface FullSiteData extends SiteBase { view: 'full'; report: ReportPage }
export type SiteData = StaffSiteData | FullSiteData;

const fieldLabels: Readonly<Record<LicenceField, string>> = {
  vendor: 'Vendor', status: 'Status', cycle: 'Cycle', cost: 'Cost', currency: 'Currency', renewsOn: 'Renews on',
  seats: 'Seats', paidBy: 'Paid by', vaultItem: 'Vault item', note: 'Note',
};

/** Page path of an item, or undefined when it has no page (other resources, lines). */
function pagePath(item: Item): string | undefined {
  if (item.kind === 'component') return `software/${item.name.toLowerCase()}/`;
  if (item.kind === 'licence') return `licences/${item.name.toLowerCase()}/`;
  return undefined;
}

function titleOf(item: Item): string {
  return summary(item).title ?? item.name;
}

/** The licence fields the view kept, in catalogue order. */
function fields(licence: Licence): Field[] {
  const details = (licence.spec.licence ?? {}) as Partial<Record<LicenceField, unknown>>;
  return licenceFields.filter(field => details[field] !== undefined).map(field => ({ label: fieldLabels[field], value: String(details[field]) }));
}

/** Title and colours from spec.site; the defaults when the Settings in use has an error. */
function siteSettings(catalogue: Catalogue): { title: string; colors: Partial<Record<SiteColorName, string>> } {
  const site = settingsInError(catalogue) ? undefined : catalogue.served.settings[0]?.spec.site;
  const colors: Partial<Record<SiteColorName, string>> = {};
  for (const [key, value] of Object.entries(site?.colors ?? {})) if (value !== undefined) colors[key as SiteColorName] = value;
  return { title: site?.title ?? DEFAULT_TITLE, colors };
}

/** The site title, as the header shows it; also the calendar name of `stackledger report --format ics`. */
export function siteTitle(catalogue: Catalogue): string {
  return siteSettings(catalogue).title;
}

class PageBuilder {
  private readonly drawn: Map<string, MapLine>;

  constructor(private readonly graph: Graph, private readonly model: MapModel, private readonly owners: ReadonlyMap<string, string>) {
    this.drawn = new Map(model.lines.map(line => [line.ref.toLowerCase(), line]));
  }

  link(ref: string): Link {
    const item = this.graph.items.get(ref.toLowerCase())!;
    const href = item.kind === 'line' ? this.lineHref(item.ref) : pagePath(item);
    return { ref: item.ref, title: titleOf(item), ...(href === undefined ? {} : { href }) };
  }

  /** A line links to its journey page only when it is drawn. */
  lineHref(ref: string): string | undefined {
    const line = this.drawn.get(ref.toLowerCase());
    return line ? `journeys/${line.name.toLowerCase()}/` : undefined;
  }

  nodeLink(node: DiagramNode): Link {
    return this.link(node.ref);
  }

  impact(item: Item): Impact {
    const result = impact(this.graph, item);
    return {
      dependants: result.dependants.map(entry => ({ ...this.link(entry.ref), depth: entry.depth })),
      lines: result.lines.map(ref => this.link(ref)),
      truncated: result.truncated,
    };
  }

  component(item: Extract<Item, { kind: 'component' }>): ComponentPage {
    const { metadata, spec } = item.entity;
    const near = neighbourhood(this.graph, item);
    const licences = (this.graph.dependsOn.get(item.key) ?? [])
      .map(ref => this.graph.items.get(ref.toLowerCase())!)
      .filter((dependency): dependency is Extract<Item, { kind: 'licence' }> => dependency.kind === 'licence')
      .sort((one, two) => compareRefs(one.ref, two.ref))
      .map(licence => ({ ...this.link(licence.ref), fields: fields(licence.entity) }));
    const zone = summary(item).zone;
    return {
      ref: item.ref, slug: item.name.toLowerCase(), name: item.name, title: titleOf(item),
      ...(metadata.description === undefined ? {} : { description: metadata.description }),
      type: spec.type, lifecycle: spec.lifecycle, owner: displayOwner(this.owners, spec.owner), ...(zone === undefined ? {} : { zone }),
      tags: (metadata.tags ?? []).filter(tag => typeof tag === 'string'),
      licences,
      journeys: linesOf(this.graph, item).map(ref => this.link(ref)),
      unresolved: [...this.graph.unresolved.get(item.key) ?? []],
      impact: this.impact(item),
      neighbourhood: {
        ...themed(theme => renderNeighbourhood(near, theme)),
        dependencies: near.dependencies.map(node => this.nodeLink(node)),
        dependants: near.dependants.map(node => this.nodeLink(node)),
      },
    };
  }

  licence(item: Extract<Item, { kind: 'licence' }>): LicencePage {
    const near = neighbourhood(this.graph, item);
    return {
      ref: item.ref, slug: item.name.toLowerCase(), name: item.name, title: titleOf(item), owner: displayOwner(this.owners, item.entity.spec.owner),
      fields: fields(item.entity),
      usedBy: near.dependants.map(node => this.nodeLink(node)),
      impact: this.impact(item),
    };
  }

  lineSummary(line: MapLine): LineSummary {
    return {
      ref: line.ref, slug: line.name.toLowerCase(), title: line.title, badge: line.badge, color: line.color,
      badgeSvg: renderLineBadge(line), stops: line.stops.length, href: this.lineHref(line.ref)!,
    };
  }

  journey(line: MapLine): JourneyPage {
    const input = strip(this.model, line);
    return {
      ...this.lineSummary(line),
      strip: themed(theme => renderStrip(input, theme)),
      stopList: input.stops.map(stop => ({ ...this.link(stop.ref), lines: stop.interchanges.map(other => this.link(other.ref)) })),
    };
  }
}

const NO_AMOUNT = '—';
const shown = (amount: Amount | null): string => (amount === null ? NO_AMOUNT : formatAmount(amount));
const currencyLabel = (currency: string | null): string => currency ?? 'Unknown currency';
const moneyRows = (rows: TotalRow[]): MoneyRow[] =>
  rows.map(row => ({ currency: currencyLabel(row.currency), monthly: shown(row.monthly), yearly: shown(row.yearly), incomplete: row.incomplete }));
const oneOffRows = (rows: OneOffRow[]): OneOffMoneyRow[] =>
  rows.map(row => ({ currency: currencyLabel(row.currency), total: shown(row.total), incomplete: row.incomplete }));
const priced = (cost: Amount | null, currency: string | null): string => (cost === null ? 'unknown' : `${formatAmount(cost)} ${currency ?? 'unknown currency'}`);

/** The Reports page's data: the report's lists with page links and shown amounts. */
function reportPage(report: Report, pages: PageBuilder): ReportPage {
  const link = (entry: LicenceLink): Link => pages.link(entry.ref);
  const renewal = (entry: RenewalEntry): ReportRenewal =>
    ({ ...link(entry), date: entry.renewsOn, vendor: entry.vendor, cycle: entry.cycle, cost: priced(entry.cost, entry.currency) });
  const grouping = (key: ReportGrouping['key'], title: string, column: string, groups: Group[]): ReportGrouping =>
    ({ key, title, column, groups: groups.map(group => ({ label: group.label, synthetic: group.synthetic, rows: moneyRows(group.totals) })) });
  return {
    date: report.date, to: report.to, days: report.days, empty: report.licences === 0, calendar: CALENDAR_FILE,
    renewals: report.renewals.map(renewal), overdue: report.overdue.map(renewal), unknownDates: report.unknownDates.map(link),
    recurring: moneyRows(report.recurring),
    groupings: [
      grouping('owner', 'By owner', 'Owner', report.groups.owner),
      grouping('payer', 'By payer', 'Paid by', report.groups.payer),
      grouping('zone', 'By zone', 'Zone', report.groups.zone),
    ],
    oneOff: {
      items: report.oneOff.items.map(item => ({ ...link(item), cost: priced(item.cost, item.currency), renewsOn: item.renewsOn ?? NO_AMOUNT })),
      totals: oneOffRows(report.oneOff.totals),
    },
    planned: {
      items: report.planned.items.map(item => ({ ...link(item), cycle: item.cycle, cost: priced(item.cost, item.currency), monthly: shown(item.monthly), yearly: shown(item.yearly) })),
      recurring: moneyRows(report.planned.recurring),
      oneOff: oneOffRows(report.planned.oneOff),
    },
    incomplete: report.incomplete.map(item => ({ ...link(item), status: item.status, unknown: item.unknown.join(', ') })),
  };
}

function themed(render: (theme: Theme) => string): Themed {
  return { light: render(themes.light), dark: render(themes.dark) };
}

function row(item: Extract<Item, { kind: 'component' | 'licence' }>, owners: ReadonlyMap<string, string>): SoftwareRow {
  const info = summary(item);
  const state = item.kind === 'component' ? item.entity.spec.lifecycle : item.entity.spec.licence?.status ?? '';
  return {
    ref: item.ref, href: pagePath(item)!, title: info.title ?? item.name, kind: item.kind,
    type: info.type ?? '', state, owner: info.owner === undefined ? '' : displayOwner(owners, info.owner), zone: info.zone ?? '',
  };
}

/** Distinct non-empty values of one column, sorted by code point, for a filter's options. */
function options(rows: SoftwareRow[], column: 'kind' | 'zone' | 'state' | 'owner'): string[] {
  return [...new Set(rows.map(entry => entry[column]).filter(value => value !== ''))].sort((one, two) => (one < two ? -1 : one > two ? 1 : 0));
}

/** SiteData of one view, plus the full map geometry for the build report (suggestions, unrouted
 * hops) and, for the full view only, the text of renewals.ics. */
export function buildSiteData(catalogue: Catalogue, view: ViewName, version: string, date?: string, owners: ReadonlyMap<string, string> = new Map()): { data: SiteData; geometry: MapGeometry; calendar?: string } {
  if (view === 'full' && date === undefined) throw new Error('A full site needs the map date');
  const served = applyView(catalogue.served, view, resolveHidden(catalogue));
  const graph = buildGraph(served);
  // The staff model never evaluates the date; pass none so nothing date-like can reach staff data.
  const model = buildMapModel(served, view === 'full' ? date! : '');
  // One ink for both copies, so labels sit in the same places and zoom moves both maps alike.
  const ink = widestInk(inkOf(themes.light), inkOf(themes.dark));
  const geometry = layoutMap(model, themes.light.lineWidth, ink);
  const darkGeometry = themes.dark.lineWidth === themes.light.lineWidth ? geometry : layoutMap(model, themes.dark.lineWidth, ink);
  const pages = new PageBuilder(graph, model, owners);
  const items = [...graph.items.values()].sort((one, two) => compareRefs(one.ref, two.ref));
  const components = items.filter((item): item is Extract<Item, { kind: 'component' }> => item.kind === 'component');
  const licences = items.filter((item): item is Extract<Item, { kind: 'licence' }> => item.kind === 'licence');
  const rows = [...components, ...licences].sort((one, two) => compareRefs(one.ref, two.ref)).map(item => row(item, owners));
  const settings = siteSettings(catalogue);
  const base: SiteBase = {
    version,
    ...settings,
    map: {
      light: renderSvg(geometry, themes.light, { chrome: false }),
      dark: renderSvg(darkGeometry, themes.dark, { chrome: false }),
      lines: model.lines.map(line => pages.lineSummary(line)),
      zones: geometry.zones.map(zone => ({ name: zone.name.toLowerCase(), title: zone.title })),
      symbols: geometry.legend.symbols.map(symbol => ({ label: symbol[0]!.toUpperCase() + symbol.slice(1), ...themed(theme => renderSymbol(symbol, theme)) })),
    },
    rows,
    filters: { kind: options(rows, 'kind'), zone: options(rows, 'zone'), state: options(rows, 'state'), owner: options(rows, 'owner') },
    components: components.map(item => pages.component(item)),
    licences: licences.map(item => pages.licence(item)),
    journeys: model.lines.map(line => pages.journey(line)),
  };
  if (view === 'staff') return { data: { view, ...base }, geometry };
  // The report exists only here, after the staff branch: nothing of it is computed for staff.
  const report = buildReport(graph, date!, REPORT_DAYS, { ownerLabel: owner => displayOwner(owners, owner) });
  const calendar = renderCalendar(report, { title: settings.title, namespace: calendarNamespace(catalogue) });
  return { data: { view, ...base, report: reportPage(report, pages) }, geometry, calendar };
}
