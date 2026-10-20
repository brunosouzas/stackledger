/** `stackledger report <folder> [--date YYYY-MM-DD] [--days N] [--format text|json|csv|ics]`
 * (report-command spec). Called by src/cli.ts; run node dist/cli.js report examples/northwind.
 *
 * Like `stackledger map`: usage and folder errors throw a plain Error before anything is written
 * (exit 2 with usage, from src/cli.ts); a catalogue with errors is still reported from what the
 * `full` view serves, with the counts line of src/map/command.ts on stderr. The whole report is
 * built in memory first, so a failure while computing or serialising it (such as an amount no JSON
 * number holds) leaves stdout empty and exits 1 with one line. A failure while writing stdout (the
 * reader closed the pipe) also exits 1 with one line; bytes already written may remain.
 *
 * Only reads the catalogue folder; no network, no other file.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { InternalError, internal } from './errors.js';
import { buildGraph, isDate, localDate } from './graph.js';
import { calendarNamespace, renderCalendar } from './ics.js';
import { problemCounts } from './map/command.js';
import { AmountTooLarge, formatCsv, formatJson, formatText } from './report-formats.js';
import { buildReport, MAX_DAYS, type Report } from './reports.js';
import { siteTitle } from './site/data.js';
import { loadFolder } from './source.js';
import { validateLoaded, type Catalogue } from './validate.js';
import { applyView, resolveHidden } from './views.js';

export const REPORT_FORMATS = ['text', 'json', 'csv', 'ics'] as const;
type ReportFormat = typeof REPORT_FORMATS[number];

export const DEFAULT_DAYS = 90;
const WHOLE_NUMBER = /^\d+$/;

interface ReportArgs { folder: string; date: string; days: number; format: ReportFormat }

/** Parse the command's arguments; throws a usage error for anything the spec refuses. */
function parseReportArgs(args: string[]): ReportArgs {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: { date: { type: 'string' }, days: { type: 'string' }, format: { type: 'string' } },
  });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  const date = values.date ?? localDate();
  if (!isDate(date)) throw new Error('Report date must be a real YYYY-MM-DD date');
  const daysText = values.days ?? String(DEFAULT_DAYS);
  const days = WHOLE_NUMBER.test(daysText) ? Number(daysText) : Number.NaN;
  if (!(days >= 0 && days <= MAX_DAYS)) throw new Error(`--days must be a whole number from 0 to ${MAX_DAYS}`);
  const format = values.format ?? 'text';
  if (!REPORT_FORMATS.includes(format as ReportFormat)) throw new Error(`Unknown format; allowed formats: ${REPORT_FORMATS.join(', ')}`);
  return { folder, date, days, format: format as ReportFormat };
}

function render(report: Report, format: ReportFormat, catalogue: Catalogue): string {
  if (format === 'json') return formatJson(report);
  if (format === 'csv') return formatCsv(report);
  if (format === 'ics') return renderCalendar(report, { title: siteTitle(catalogue), namespace: calendarNamespace(catalogue) });
  return formatText(report);
}

/** Write all of `text` to stdout, or throw InternalError when the stream fails (EPIPE). */
async function writeStdout(text: string): Promise<void> {
  await new Promise<void>((done, fail) => {
    // The stream reports a closed pipe both to the write callback and as an 'error' event; without
    // a listener the event would crash the process with a stack trace instead of one line.
    const onError = (error: Error) => fail(error);
    process.stdout.on('error', onError);
    process.stdout.write(text, error => {
      if (error) fail(error);
      else {
        process.stdout.off('error', onError);
        done();
      }
    });
  }).catch((error: NodeJS.ErrnoException) => {
    throw new InternalError(`stackledger report: cannot write the report to stdout (${error.code ?? error.message})`);
  });
}

export async function reportCommand(args: string[]): Promise<void> {
  const options = parseReportArgs(args);
  const loaded = await loadFolder(resolve(options.folder));
  const catalogue = validateLoaded(loaded);
  const counts = problemCounts('report', catalogue);
  if (counts.length) process.stderr.write(counts.join('\n') + '\n');

  // Arguments and the folder are checked above: a failure from here on is exit 1, never usage.
  let output: string;
  try {
    const graph = buildGraph(applyView(catalogue.served, 'full', resolveHidden(catalogue)));
    output = render(buildReport(graph, options.date, options.days), options.format, catalogue);
  } catch (error) {
    if (error instanceof AmountTooLarge) throw new InternalError(`stackledger report: ${error.message}`);
    throw internal('report', error);
  }
  await writeStdout(output);
}
