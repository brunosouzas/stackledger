/** The renewal calendar (licence-reports spec, Calendar file and Calendar identity and stamp):
 * one test per scenario, named after it. A small reader below unfolds and unescapes the output,
 * so each test checks what a calendar program would read. Run npm test. Data is fictitious.
 */
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { buildGraph } from '../../src/graph.js';
import { calendarNamespace, renderCalendar } from '../../src/ics.js';
import { buildReport } from '../../src/reports.js';
import { applyView, resolveHidden } from '../../src/views.js';
import { check, licence, set, settings } from './helpers.js';

const DATE = '2027-06-01';

interface Property { name: string; params: string; value: string }

function lic(name: string, fields: Record<string, unknown> = {}): unknown {
  let document: unknown = licence(name);
  for (const [field, value] of Object.entries(fields)) document = set(document, `spec.licence.${field}`, value);
  return document;
}

function calendarOf(documents: unknown[], date = DATE): string {
  const catalogue = check(...documents);
  const report = buildReport(buildGraph(applyView(catalogue.served, 'full', resolveHidden(catalogue))), date, 90);
  return renderCalendar(report, { title: 'Northwind software', namespace: calendarNamespace(catalogue) });
}

/** RFC 5545 content lines: unfold CRLF + space, then split NAME;PARAMS:VALUE. */
function unfold(text: string): Property[] {
  expect(text.endsWith('\r\n')).toBe(true);
  expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  return text.slice(0, -2).replaceAll('\r\n ', '').split('\r\n').map(line => {
    const colon = line.indexOf(':');
    const head = line.slice(0, colon);
    const semicolon = head.indexOf(';');
    return semicolon < 0 ? { name: head, params: '', value: line.slice(colon + 1) } : { name: head.slice(0, semicolon), params: head.slice(semicolon + 1), value: line.slice(colon + 1) };
  });
}

/** The text a TEXT value stands for. */
function unescape(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, character: string) => (character.toLowerCase() === 'n' ? '\n' : character));
}

/** The properties of each VEVENT, outside its VALARM, plus the alarm's properties. */
function events(text: string): { props: Map<string, Property>; alarm: Map<string, Property> }[] {
  const result: { props: Map<string, Property>; alarm: Map<string, Property> }[] = [];
  let inAlarm = false;
  for (const property of unfold(text)) {
    if (property.name === 'BEGIN' && property.value === 'VEVENT') result.push({ props: new Map(), alarm: new Map() });
    else if (property.name === 'BEGIN' && property.value === 'VALARM') inAlarm = true;
    else if (property.name === 'END' && property.value === 'VALARM') inAlarm = false;
    else if (result.length && property.name !== 'END') (inAlarm ? result.at(-1)!.alarm : result.at(-1)!.props).set(property.name, property);
  }
  return result;
}

test('Yearly renewal', () => {
  const text = calendarOf([lic('licence-editor', { cycle: 'yearly', cost: 120, renewsOn: '2027-06-30', vendor: 'Northwind Studio' })]);
  const lines = text.split('\r\n');
  expect(lines.slice(0, 5)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//stackledger//licence renewals//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Northwind software']);
  expect(text).not.toMatch(/^METHOD/m);
  const [event] = events(text);
  expect(event!.props.get('DTSTART')).toEqual({ name: 'DTSTART', params: 'VALUE=DATE', value: '20270630' });
  expect(event!.props.get('DTEND')).toEqual({ name: 'DTEND', params: 'VALUE=DATE', value: '20270701' });
  expect(event!.props.get('RRULE')!.value).toBe('FREQ=YEARLY');
  expect(event!.props.get('DTSTAMP')!.value).toBe('20270601T000000Z');
  expect(event!.props.get('SUMMARY')!.value).toBe('Renewal: licence-editor');
  expect(unescape(event!.props.get('DESCRIPTION')!.value)).toBe('Vendor: Northwind Studio\nCost: 120.00 GBP\nCycle: yearly');
  expect([...event!.alarm.values()].map(property => `${property.name}:${property.value}`)).toEqual(['ACTION:DISPLAY', 'TRIGGER:-P14D', 'DESCRIPTION:Renewal: licence-editor']);
});

test('Calendar text escaped', () => {
  const title = 'Editor, team; shared \\ seats\nsecond line';
  const text = calendarOf([set(lic('licence-editor', { renewsOn: '2027-06-30' }), 'metadata.title', title)]);
  const [event] = events(text);
  expect(event!.props.get('SUMMARY')!.value).toBe('Renewal: Editor\\, team\\; shared \\\\ seats\\nsecond line');
  expect(unescape(event!.props.get('SUMMARY')!.value)).toBe(`Renewal: ${title}`);
  expect(unescape(event!.alarm.get('DESCRIPTION')!.value)).toBe(`Renewal: ${title}`);
});

test('Long non-ASCII title', () => {
  const title = 'Licença de edição avançada é çà '.repeat(4).slice(0, 120);
  expect([...title]).toHaveLength(120);
  const text = calendarOf([set(lic('licence-editor', { renewsOn: '2027-06-30' }), 'metadata.title', title)]);
  for (const line of text.slice(0, -2).split('\r\n')) {
    const bytes = Buffer.from(line);
    expect(bytes.length, line).toBeLessThanOrEqual(75);
    // A split character would not survive decoding and encoding again.
    expect(Buffer.from(bytes.toString('utf8')).equals(bytes), line).toBe(true);
    expect(line).not.toContain('\ufffd');
  }
  expect(text).toMatch(/\r\n /);
  expect(unescape(events(text)[0]!.props.get('SUMMARY')!.value)).toBe(`Renewal: ${title}`);
});

test('Same input', () => {
  const documents = [settings('northwind'), lic('licence-editor', { renewsOn: '2027-06-30' }), lic('licence-chat', { renewsOn: '2027-07-15' })];
  const first = calendarOf(documents);
  expect(calendarOf([...documents].reverse())).toBe(first);
  expect(calendarOf(documents)).toBe(first);
  expect(events(first)).toHaveLength(2);
});

test('Two catalogues', () => {
  const editor = lic('licence-editor', { renewsOn: '2027-06-30' });
  const uidIn = (name: string) => events(calendarOf([settings(name), editor]))[0]!.props.get('UID')!.value;
  const northwind = uidIn('northwind'), contoso = uidIn('contoso');
  expect(northwind).toMatch(/^[0-9a-f]{32}@stackledger$/);
  expect(contoso).not.toBe(northwind);
  // Without a Settings document, the namespace is `catalogue`.
  expect(events(calendarOf([editor]))[0]!.props.get('UID')!.value).toBe(uidIn('catalogue'));
});

test('One-off with a date', () => {
  const text = calendarOf([lic('licence-once', { cycle: 'one-off', cost: 300, renewsOn: '2027-07-01' })]);
  const [event] = events(text);
  expect(event!.props.get('DTSTART')!.value).toBe('20270701');
  expect(event!.props.has('RRULE')).toBe(false);
  expect(unescape(event!.props.get('DESCRIPTION')!.value)).toContain('Cost: 300.00 GBP');
});
