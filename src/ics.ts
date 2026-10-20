/** The renewal calendar: iCalendar (RFC 5545) text for the renewals of a licence report
 * (licence-reports spec, Calendar file; design D4). Written by hand: the format is small and a
 * dependency would be more code to trust than this file.
 *
 * Call renderCalendar(report, { title, namespace }). `title` is the site title (X-WR-CALNAME);
 * `namespace` is calendarNamespace(catalogue): the Settings document's metadata.name, else
 * `catalogue`. One all-day event per licence of report.renewals (the window; overdue ones are not
 * repeated here), in the report's order.
 *
 * Reproducible on purpose: the UID is a hash of the namespace and the licence reference only, and
 * DTSTAMP is the report date at midnight UTC. Without a METHOD property, RFC 5545 reads DTSTAMP as
 * the time the information was last revised. The same catalogue and date give the same bytes.
 *
 * Text values escape `\`, `;`, `,` and line breaks; other control characters become spaces (the
 * format does not allow them). Lines end with CRLF and fold at 75 octets, never inside a UTF-8 sequence.
 */
import { createHash } from 'node:crypto';
import { addDays } from './graph.js';
import { formatAmount } from './money.js';
import type { Report, RenewalEntry } from './reports.js';
import type { Catalogue } from './validate.js';

export interface CalendarIdentity { title: string; namespace: string }

export const DEFAULT_NAMESPACE = 'catalogue';
const PRODUCT = '-//stackledger//licence renewals//EN';
const MAX_OCTETS = 75;
const ALARM_BEFORE = '-P14D';
const REPEATS: Readonly<Record<string, string>> = { yearly: 'FREQ=YEARLY', monthly: 'FREQ=MONTHLY' };
// Controls other than tab are not allowed in iCalendar text (RFC 5545 section 3.3.11).
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** The namespace that makes event UIDs differ between catalogues. */
export function calendarNamespace(catalogue: Pick<Catalogue, 'served'>): string {
  return catalogue.served.settings[0]?.metadata.name ?? DEFAULT_NAMESPACE;
}

/** An iCalendar TEXT value. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(CONTROL, ' ');
}

/** One content line folded at 75 octets: each continuation starts with a space, and a character
 * is never split between two lines. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (octets + size > MAX_OCTETS) {
      parts.push(current);
      // The leading space of a continuation line counts towards its 75 octets.
      current = ' ';
      octets = 1;
    }
    current += character;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n');
}

/** The first 32 hexadecimal digits of sha256(namespace + newline + reference), at stackledger. */
export function eventUid(namespace: string, ref: string): string {
  return `${createHash('sha256').update(`${namespace}\n${ref}`).digest('hex').slice(0, 32)}@stackledger`;
}

const compact = (date: string) => date.replaceAll('-', '');

function description(renewal: RenewalEntry): string {
  const cost = renewal.cost === null ? 'unknown' : formatAmount(renewal.cost);
  return [`Vendor: ${renewal.vendor}`, `Cost: ${cost} ${renewal.currency ?? 'unknown'}`, `Cycle: ${renewal.cycle}`].join('\n');
}

function event(renewal: RenewalEntry, namespace: string, stamp: string): string[] {
  const summary = escapeText(`Renewal: ${renewal.title}`);
  const repeat = REPEATS[renewal.cycle];
  return [
    'BEGIN:VEVENT',
    `UID:${eventUid(namespace, renewal.ref)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(renewal.renewsOn)}`,
    `DTEND;VALUE=DATE:${compact(addDays(renewal.renewsOn, 1))}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${escapeText(description(renewal))}`,
    ...(repeat === undefined ? [] : [`RRULE:${repeat}`]),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${ALARM_BEFORE}`,
    `DESCRIPTION:${summary}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** The calendar file of a report's renewals. */
export function renderCalendar(report: Report, identity: CalendarIdentity): string {
  const stamp = `${compact(report.date)}T000000Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(identity.title)}`,
    ...report.renewals.flatMap(renewal => event(renewal, identity.namespace, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
