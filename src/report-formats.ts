/** Text, JSON and CSV forms of a licence report (report-command spec, Formats, CSV rows, Safe CSV).
 * Used by src/report-command.ts; the calendar form is src/ics.ts.
 *
 * - formatText(report): plain tables for a terminal. Catalogue text has its control characters
 *   replaced by spaces, so a title cannot move the cursor or inject terminal escapes.
 * - formatJson(report): the shape documented in docs/reports.md. Amounts are numbers rounded to two
 *   decimals, null where no amount exists. An amount that no JSON number holds exactly throws
 *   AmountTooLarge, naming the licence (or the total) it belongs to.
 * - formatCsv(report): one quoted row per active, to-confirm or to-buy licence, in reference order.
 *   A field that a spreadsheet would read as a formula gets a leading `'`. This protects the file
 *   as written; a spreadsheet that saves it again may undo it.
 */
import { formatAmount, jsonNumber, type Amount } from './money.js';
import type { Group, LicenceLink, OneOffRow, Report, RenewalEntry, TotalRow } from './reports.js';

/** An amount of the report that cannot be written faithfully as a JSON number. */
export class AmountTooLarge extends Error {
  override name = 'AmountTooLarge';
}

// Text

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const NONE = '-';

/** Catalogue text safe for a terminal: one line, no control characters. */
function plain(value: string): string {
  return value.replace(CONTROL, ' ');
}

const shown = (amount: Amount | null): string => (amount === null ? NONE : formatAmount(amount));
const currencyLabel = (currency: string | null): string => currency ?? 'unknown';

/** Columns padded to their widest cell; columns listed in `right` are aligned right (amounts). */
function table(header: string[], rows: string[][], right: ReadonlySet<number> = new Set()): string[] {
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map(row => row[column]!.length)));
  const line = (cells: string[]) => cells
    .map((cell, column) => (right.has(column) ? cell.padStart(widths[column]!) : cell.padEnd(widths[column]!)))
    .join('  ')
    .trimEnd();
  return [header, ...rows].map(line);
}

const AMOUNTS_FROM = (first: number, count: number) => new Set(Array.from({ length: count }, (_, i) => first + i));

function section(title: string, rows: string[][], header: string[], right?: ReadonlySet<number>): string[] {
  return ['', title, ...(rows.length ? table(header, rows, right) : ['None.'])];
}

function renewalRows(entries: RenewalEntry[]): string[][] {
  return entries.map(entry => [
    entry.renewsOn, entry.ref, plain(entry.title), plain(entry.vendor), entry.cycle,
    entry.cost === null ? 'unknown' : formatAmount(entry.cost), currencyLabel(entry.currency),
  ]);
}

function totalRows(rows: TotalRow[]): string[][] {
  return rows.map(row => [currencyLabel(row.currency), shown(row.monthly), shown(row.yearly), String(row.incomplete)]);
}

function oneOffRows(rows: OneOffRow[]): string[][] {
  return rows.map(row => [currencyLabel(row.currency), shown(row.total), String(row.incomplete)]);
}

function groupRows(groups: Group[]): string[][] {
  return groups.flatMap(group => group.totals.map(row => [plain(group.label), ...totalRows([row])[0]!]));
}

const RENEWAL_HEADER = ['Date', 'Licence', 'Title', 'Vendor', 'Cycle', 'Cost', 'Currency'];
const TOTAL_HEADER = ['Currency', 'Per month', 'Per year', 'Incomplete'];
const ONE_OFF_HEADER = ['Currency', 'Total', 'Incomplete'];

export function formatText(report: Report): string {
  const lines = [`Licence report for ${report.date}: renewals up to ${report.to} (${report.days} days)`];
  if (report.licences === 0) return [...lines, '', 'There are no licences.'].join('\n') + '\n';
  const link = (entry: LicenceLink) => [entry.ref, plain(entry.title)];
  lines.push(
    ...section('Renewals', renewalRows(report.renewals), RENEWAL_HEADER, new Set([5])),
    ...section('Overdue', renewalRows(report.overdue), RENEWAL_HEADER, new Set([5])),
    ...section('Unknown renewal dates', report.unknownDates.map(link), ['Licence', 'Title']),
    ...section('Recurring cost', totalRows(report.recurring), TOTAL_HEADER, AMOUNTS_FROM(1, 3)),
    ...section('By owner', groupRows(report.groups.owner), ['Owner', ...TOTAL_HEADER], AMOUNTS_FROM(2, 3)),
    ...section('By payer', groupRows(report.groups.payer), ['Payer', ...TOTAL_HEADER], AMOUNTS_FROM(2, 3)),
    ...section('By zone', groupRows(report.groups.zone), ['Zone', ...TOTAL_HEADER], AMOUNTS_FROM(2, 3)),
    ...section('One-off', report.oneOff.items.map(item => [...link(item), formatAmount(item.cost), item.currency, item.renewsOn ?? NONE]),
      ['Licence', 'Title', 'Cost', 'Currency', 'Renews on'], new Set([2])),
    ...section('One-off totals', oneOffRows(report.oneOff.totals), ONE_OFF_HEADER, AMOUNTS_FROM(1, 2)),
    ...section('Planned purchases', report.planned.items.map(item => [
      ...link(item), item.cycle, shown(item.cost), currencyLabel(item.currency), shown(item.monthly), shown(item.yearly),
    ]), ['Licence', 'Title', 'Cycle', 'Cost', 'Currency', 'Per month', 'Per year'], new Set([3, 5, 6])),
    ...section('Planned recurring totals', totalRows(report.planned.recurring), TOTAL_HEADER, AMOUNTS_FROM(1, 3)),
    ...section('Planned one-off totals', oneOffRows(report.planned.oneOff), ONE_OFF_HEADER, AMOUNTS_FROM(1, 2)),
    ...section('Incomplete licences', report.incomplete.map(item => [...link(item), item.status, item.unknown.join(', ')]),
      ['Licence', 'Title', 'Status', 'Unknown']),
  );
  return lines.join('\n') + '\n';
}

// JSON

/** Converts amounts to JSON numbers, naming the owner of an amount that does not fit. */
function numbers(owner: string) {
  return (amount: Amount | null): number | null => {
    if (amount === null) return null;
    const value = jsonNumber(amount);
    if (value === undefined) throw new AmountTooLarge(`An amount of ${owner} cannot be written exactly as a JSON number`);
    return value;
  };
}

function totalJson(rows: TotalRow[], owner: string) {
  return rows.map(row => {
    const number = numbers(`the ${currencyLabel(row.currency)} total of ${owner}`);
    return { currency: row.currency, monthly: number(row.monthly), yearly: number(row.yearly), incomplete: row.incomplete };
  });
}

function oneOffJson(rows: OneOffRow[], owner: string) {
  return rows.map(row => ({ currency: row.currency, total: numbers(`the ${currencyLabel(row.currency)} total of ${owner}`)(row.total), incomplete: row.incomplete }));
}

function renewalJson(entry: RenewalEntry) {
  return {
    ref: entry.ref, title: entry.title, vendor: entry.vendor, status: entry.status, cycle: entry.cycle,
    renewsOn: entry.renewsOn, cost: numbers(entry.ref)(entry.cost), currency: entry.currency,
  };
}

function groupJson(groups: Group[], grouping: string) {
  return groups.map(group => ({ key: group.key, label: group.label, synthetic: group.synthetic, totals: totalJson(group.totals, `${grouping} group ${group.label}`) }));
}

/** Every licence's own amounts first, so a licence with an absurd cost is the one named. */
function checkLicences(report: Report): void {
  for (const row of report.rows) {
    const number = numbers(row.ref);
    number(row.cost === 'unknown' ? null : row.cost);
    number(row.monthly);
    number(row.yearly);
  }
}

export function formatJson(report: Report): string {
  checkLicences(report);
  const value = {
    date: report.date, days: report.days, to: report.to,
    renewals: report.renewals.map(renewalJson),
    overdue: report.overdue.map(renewalJson),
    unknownDates: report.unknownDates.map(entry => entry.ref),
    recurring: totalJson(report.recurring, 'the recurring cost'),
    groups: {
      owner: groupJson(report.groups.owner, 'owner'),
      payer: groupJson(report.groups.payer, 'payer'),
      zone: groupJson(report.groups.zone, 'zone'),
    },
    oneOff: {
      items: report.oneOff.items.map(item => ({ ref: item.ref, title: item.title, cost: numbers(item.ref)(item.cost), currency: item.currency, renewsOn: item.renewsOn })),
      totals: oneOffJson(report.oneOff.totals, 'the one-off costs'),
    },
    planned: {
      items: report.planned.items.map(item => {
        const number = numbers(item.ref);
        return { ref: item.ref, title: item.title, cycle: item.cycle, cost: number(item.cost), currency: item.currency, monthly: number(item.monthly), yearly: number(item.yearly) };
      }),
      recurring: totalJson(report.planned.recurring, 'the planned recurring cost'),
      oneOff: oneOffJson(report.planned.oneOff, 'the planned one-off costs'),
    },
    incomplete: report.incomplete.map(item => ({ ref: item.ref, title: item.title, status: item.status, unknown: item.unknown })),
  };
  return JSON.stringify(value, null, 2) + '\n';
}

// CSV

export const CSV_HEADER = ['ref', 'title', 'vendor', 'status', 'cycle', 'cost', 'currency', 'monthly', 'yearly', 'renewsOn', 'owner', 'paidBy', 'zone', 'counted'];
/** First characters that make a spreadsheet read a cell as a formula, including full-width forms. */
const FORMULA_START = /^[=+\-@\t\r\n＝＋－＠]/;

/** One CSV field: quoted, quotes doubled, formula starts neutralised with a leading `'`. */
export function csvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function formatCsv(report: Report): string {
  const rows = report.rows.map(row => [
    row.ref, row.title, row.vendor, row.status, row.cycle,
    row.cost === 'unknown' ? 'unknown' : formatAmount(row.cost), row.currency,
    row.monthly === null ? '' : formatAmount(row.monthly), row.yearly === null ? '' : formatAmount(row.yearly),
    row.renewsOn, row.owner, row.paidBy ?? '', row.zones.join(';'), String(row.counted),
  ]);
  // RFC 4180 line ends.
  return [CSV_HEADER, ...rows].map(cells => cells.map(csvField).join(',')).join('\r\n') + '\r\n';
}
