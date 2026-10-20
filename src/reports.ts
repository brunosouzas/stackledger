/** The licence report (licence-reports spec, design D1 and D3): renewals, recurring cost per
 * currency and per group, one-off and planned costs, and incomplete licences.
 *
 * Why one pure model: the Reports page, `stackledger report` (text, JSON, CSV) and the calendar
 * file all show the same numbers, so they all read buildReport(graph, date, days). The graph must
 * be built from the `full` view (src/views.ts); the staff site never calls this module.
 *
 * Rules, in short (docs/reports.md has the long form):
 * - `active` and `to-confirm` licences count; `to-buy` ones are planned; `cancelled` and `expired`
 *   ones are in no list and no total.
 * - `cost` is the price of one cycle for the whole licence; seats never multiply it. Monthly costs
 *   ×12 per year, yearly ÷12 per month, `none` costs zero. Amounts are exact (src/money.ts).
 * - A licence whose cycle, cost or currency is `unknown` adds to no amount; it is listed as
 *   incomplete and counted on its currency's total row (or the unknown-currency row).
 * - Groups (owner, payer, zone) hold the recurring totals of counted licences. Synthetic groups
 *   (`Not set`, `Several zones`, `No zone`) have keys that can never equal a real value, and come last.
 *
 * Every list is sorted, so the output does not depend on the order of the catalogue's documents.
 */
import { compareRefs, compareText, isDate } from './identity.js';
import { renewals as findRenewals, type Graph, type Item, type Renewal } from './graph.js';
import { add, amountOf, divide, multiply, ZERO, type Amount } from './money.js';

type LicenceItem = Extract<Item, { kind: 'licence' }>;
type Details = LicenceItem['entity']['spec']['licence'];

/** Fields whose `unknown` value makes a licence incomplete, in catalogue order. */
export type UnknownField = 'cycle' | 'cost' | 'currency';

export interface LicenceLink { ref: string; title: string }
export interface RenewalEntry extends LicenceLink {
  vendor: string; status: string; cycle: string; renewsOn: string; cost: Amount | null; currency: string | null;
}
/** One currency's totals; currency null is the unknown-currency row. An amount is null when no
 * complete licence adds to it. */
export interface TotalRow { currency: string | null; monthly: Amount | null; yearly: Amount | null; incomplete: number }
export interface OneOffRow { currency: string | null; total: Amount | null; incomplete: number }
export interface Group { key: string; label: string; synthetic: boolean; totals: TotalRow[] }
export interface OneOffItem extends LicenceLink { cost: Amount; currency: string; renewsOn: string | null }
export interface PlannedItem extends LicenceLink {
  cycle: string; cost: Amount | null; currency: string | null; monthly: Amount | null; yearly: Amount | null;
}
export interface IncompleteItem extends LicenceLink { status: string; unknown: UnknownField[] }
/** One CSV row: a licence with status active, to-confirm or to-buy. */
export interface LicenceRow extends LicenceLink {
  vendor: string; status: string; cycle: string; cost: Amount | 'unknown'; currency: string; renewsOn: string;
  monthly: Amount | null; yearly: Amount | null; owner: string; paidBy: string | undefined; zones: string[]; counted: boolean;
}
export interface Report {
  date: string; days: number; to: string;
  /** Served licences of any status; zero means the catalogue has no licence at all. */
  licences: number;
  renewals: RenewalEntry[]; overdue: RenewalEntry[]; unknownDates: LicenceLink[];
  recurring: TotalRow[];
  groups: { owner: Group[]; payer: Group[]; zone: Group[] };
  oneOff: { items: OneOffItem[]; totals: OneOffRow[] };
  planned: { items: PlannedItem[]; recurring: TotalRow[]; oneOff: OneOffRow[] };
  incomplete: IncompleteItem[];
  rows: LicenceRow[];
}
export interface ReportOptions {
  /** The text an owner group shows and sorts by; the reference itself by default. */
  ownerLabel?: (owner: string) => string;
}

export const MAX_DAYS = 366;
const COUNTED = new Set(['active', 'to-confirm']);
const PLANNED = 'to-buy';
const MONTHS = 12n;

/** Synthetic groups. Their keys may look like real values; Grouping keeps them apart by the flag. */
const NOT_SET: GroupId = { key: 'not-set', label: 'Not set', synthetic: true };
const SEVERAL_ZONES: GroupId = { key: 'several-zones', label: 'Several zones', synthetic: true };
const NO_ZONE: GroupId = { key: 'no-zone', label: 'No zone', synthetic: true };

interface GroupId { key: string; label: string; synthetic: boolean }

/** A licence as the cost rules see it. */
interface Costed {
  item: LicenceItem; details: Details; link: LicenceLink;
  unknown: UnknownField[]; currency: string | null; cost: Amount | null;
  /** Recurring amounts of a complete monthly, yearly or none licence. */
  monthly: Amount | null; yearly: Amount | null;
  oneOff: boolean; complete: boolean;
}

function titleOf(item: LicenceItem): string {
  return item.entity.metadata.title ?? item.name;
}

function unknownFields(details: Details): UnknownField[] {
  const fields: UnknownField[] = [];
  if (details.cycle === 'unknown') fields.push('cycle');
  if (details.cost === 'unknown') fields.push('cost');
  if (details.currency === 'unknown') fields.push('currency');
  return fields;
}

/** Monthly and yearly amounts of one cycle's cost. */
function recurringAmounts(cycle: string, cost: Amount): { monthly: Amount; yearly: Amount } | undefined {
  if (cycle === 'monthly') return { monthly: cost, yearly: multiply(cost, MONTHS) };
  if (cycle === 'yearly') return { monthly: divide(cost, MONTHS), yearly: cost };
  if (cycle === 'none') return { monthly: ZERO, yearly: ZERO };
  return undefined;
}

function costed(item: LicenceItem): Costed {
  const details = item.entity.spec.licence;
  const unknown = unknownFields(details);
  const cost = details.cost === 'unknown' ? null : amountOf(details.cost);
  const complete = unknown.length === 0;
  const amounts = complete ? recurringAmounts(details.cycle, cost!) : undefined;
  return {
    item, details, link: { ref: item.ref, title: titleOf(item) }, unknown,
    currency: details.currency === 'unknown' ? null : details.currency, cost,
    monthly: amounts?.monthly ?? null, yearly: amounts?.yearly ?? null,
    oneOff: details.cycle === 'one-off', complete,
  };
}

const compareCurrency = (left: string | null, right: string | null): number =>
  left === right ? 0 : left === null ? 1 : right === null ? -1 : compareText(left, right);

const plus = (total: Amount | null, amount: Amount): Amount => (total === null ? amount : add(total, amount));

/** Recurring total rows, one per currency, built licence by licence. */
class RecurringTotals {
  private readonly rows = new Map<string | null, TotalRow>();

  add(licence: Costed): void {
    const row = this.row(licence.currency);
    if (!licence.complete) {
      row.incomplete++;
      return;
    }
    row.monthly = plus(row.monthly, licence.monthly!);
    row.yearly = plus(row.yearly, licence.yearly!);
  }

  list(): TotalRow[] {
    return [...this.rows.values()].sort((one, two) => compareCurrency(one.currency, two.currency));
  }

  private row(currency: string | null): TotalRow {
    let row = this.rows.get(currency);
    if (!row) this.rows.set(currency, (row = { currency, monthly: null, yearly: null, incomplete: 0 }));
    return row;
  }
}

/** One-off total rows, one per currency. */
class OneOffTotals {
  private readonly rows = new Map<string | null, OneOffRow>();

  add(licence: Costed): void {
    let row = this.rows.get(licence.currency);
    if (!row) this.rows.set(licence.currency, (row = { currency: licence.currency, total: null, incomplete: 0 }));
    if (licence.complete) row.total = plus(row.total, licence.cost!);
    else row.incomplete++;
  }

  list(): OneOffRow[] {
    return [...this.rows.values()].sort((one, two) => compareCurrency(one.currency, two.currency));
  }
}

/** Recurring totals per group of one grouping (owner, payer or zone). */
class Grouping {
  private readonly groups = new Map<string, { id: GroupId; totals: RecurringTotals }>();

  add(id: GroupId, licence: Costed): void {
    // `real:` and `synthetic:` prefixes keep a payer named "Not set" apart from the missing payer.
    const mapKey = `${id.synthetic ? 'synthetic' : 'real'}:${id.key}`;
    let group = this.groups.get(mapKey);
    if (!group) this.groups.set(mapKey, (group = { id, totals: new RecurringTotals() }));
    group.totals.add(licence);
  }

  list(): Group[] {
    return [...this.groups.values()]
      .map(({ id, totals }) => ({ key: id.key, label: id.label, synthetic: id.synthetic, totals: totals.list() }))
      .sort((one, two) => Number(one.synthetic) - Number(two.synthetic) || compareText(one.label, two.label) || compareText(one.key, two.key));
  }
}

/** Declared zones of the served layout by lower-cased name; the first declaration wins. */
function declaredZones(graph: Graph): Map<string, { name: string; title: string }> {
  const zones = new Map<string, { name: string; title: string }>();
  for (const zone of graph.view.layout?.spec.zones ?? []) {
    const key = zone.name.toLowerCase();
    if (!zones.has(key)) zones.set(key, { name: key, title: zone.title });
  }
  return zones;
}

/** Lower-cased names of the declared zones of the served components that use a licence, sorted. */
function zonesOf(graph: Graph, item: LicenceItem, declared: ReadonlyMap<string, unknown>): string[] {
  const zones = new Set<string>();
  for (const key of graph.dependants.get(item.key) ?? []) {
    const user = graph.items.get(key);
    if (user?.kind !== 'component') continue;
    const label = user.entity.metadata.labels?.['stackledger/zone'];
    // A label that names no declared zone counts as no zone.
    if (typeof label === 'string' && declared.has(label.toLowerCase())) zones.add(label.toLowerCase());
  }
  return [...zones].sort(compareText);
}

function zoneGroup(zones: string[], declared: ReadonlyMap<string, { name: string; title: string }>): GroupId {
  if (zones.length === 0) return NO_ZONE;
  if (zones.length > 1) return SEVERAL_ZONES;
  const zone = declared.get(zones[0]!)!;
  return { key: zone.name, label: zone.title, synthetic: false };
}

function renewalEntry(renewal: Renewal, graph: Graph): RenewalEntry {
  const item = graph.items.get(renewal.ref.toLowerCase()) as LicenceItem;
  return {
    ref: renewal.ref, title: titleOf(item), vendor: renewal.vendor, status: renewal.status, cycle: renewal.cycle,
    renewsOn: renewal.renewsOn, cost: renewal.cost === 'unknown' ? null : amountOf(renewal.cost),
    currency: renewal.currency === 'unknown' ? null : renewal.currency,
  };
}

function plannedItem(licence: Costed): PlannedItem {
  return {
    ...licence.link, cycle: licence.details.cycle, cost: licence.cost, currency: licence.currency,
    monthly: licence.monthly, yearly: licence.yearly,
  };
}

function licenceRow(licence: Costed, zones: string[]): LicenceRow {
  const { details } = licence;
  return {
    ...licence.link, vendor: details.vendor, status: details.status, cycle: details.cycle,
    cost: licence.cost ?? 'unknown', currency: details.currency, renewsOn: details.renewsOn,
    monthly: licence.monthly, yearly: licence.yearly, owner: licence.item.entity.spec.owner, paidBy: details.paidBy, zones,
    counted: COUNTED.has(details.status) && licence.complete && !licence.oneOff,
  };
}

/** The report of a `full`-view graph for a report date and a window of `days` days (0 to 366). */
export function buildReport(graph: Graph, date: string, days: number, options: ReportOptions = {}): Report {
  if (!isDate(date)) throw new Error('The report date must be a real YYYY-MM-DD date');
  if (!Number.isInteger(days) || days < 0 || days > MAX_DAYS) throw new Error(`The window must be from 0 to ${MAX_DAYS} days`);
  const ownerLabel = options.ownerLabel ?? ((owner: string) => owner);
  const declared = declaredZones(graph);
  const licences = [...graph.items.values()]
    .filter((item): item is LicenceItem => item.kind === 'licence')
    .sort((one, two) => compareRefs(one.ref, two.ref));

  const recurring = new RecurringTotals(), oneOffTotals = new OneOffTotals();
  const plannedRecurring = new RecurringTotals(), plannedOneOff = new OneOffTotals();
  const byOwner = new Grouping(), byPayer = new Grouping(), byZone = new Grouping();
  const oneOffItems: OneOffItem[] = [], plannedItems: PlannedItem[] = [], incomplete: IncompleteItem[] = [], rows: LicenceRow[] = [];

  for (const item of licences) {
    const counted = COUNTED.has(item.entity.spec.licence.status);
    if (!counted && item.entity.spec.licence.status !== PLANNED) continue;
    const licence = costed(item);
    const zones = zonesOf(graph, item, declared);
    rows.push(licenceRow(licence, zones));
    if (!licence.complete) incomplete.push({ ...licence.link, status: licence.details.status, unknown: licence.unknown });
    if (!counted) {
      plannedItems.push(plannedItem(licence));
      (licence.oneOff ? plannedOneOff : plannedRecurring).add(licence);
      continue;
    }
    if (licence.oneOff) {
      oneOffTotals.add(licence);
      if (licence.complete) oneOffItems.push({ ...licence.link, cost: licence.cost!, currency: licence.currency!, renewsOn: isDate(licence.details.renewsOn) ? licence.details.renewsOn : null });
      continue;
    }
    recurring.add(licence);
    const owner = item.entity.spec.owner;
    byOwner.add({ key: owner, label: ownerLabel(owner), synthetic: false }, licence);
    const payer = licence.details.paidBy;
    byPayer.add(payer === undefined ? NOT_SET : { key: payer, label: payer, synthetic: false }, licence);
    byZone.add(zoneGroup(zones, declared), licence);
  }

  const window = findRenewals(graph, date, days);
  const linkOf = (ref: string): LicenceLink => ({ ref, title: titleOf(graph.items.get(ref.toLowerCase()) as LicenceItem) });
  return {
    date, days, to: window.to, licences: licences.length,
    renewals: window.licences.map(renewal => renewalEntry(renewal, graph)),
    overdue: window.overdue.map(renewal => renewalEntry(renewal, graph)),
    unknownDates: window.unknown.map(linkOf),
    recurring: recurring.list(),
    groups: { owner: byOwner.list(), payer: byPayer.list(), zone: byZone.list() },
    oneOff: { items: oneOffItems, totals: oneOffTotals.list() },
    planned: { items: plannedItems, recurring: plannedRecurring.list(), oneOff: plannedOneOff.list() },
    incomplete, rows,
  };
}
