/** Read-only map command. Called by src/cli.ts; run node dist/cli.js map <folder>.
 * Usage/root failures throw before stdout; layout/render failures throw InternalError (exit 1).
 * Recoverable catalogue errors are diagnostics.
 * stdout is exactly one SVG and one newline. No catalogue file is ever changed.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadFolder, type Loaded } from '../source.js';
import { validateLoaded, type Catalogue } from '../validate.js';
import { applyView, resolveHidden, viewNames, type ViewName } from '../views.js';
import { isDate, localDate } from '../graph.js';
import { buildMapModel } from './model.js';
import { layoutMap, type MapGeometry } from './layout.js';
import { renderSvg } from './svg.js';
import { inkOf, themes } from './themes.js';
import { internal } from '../errors.js';

const plural = (count: number, word: string): string => `${count} ${count === 1 ? word : `${word}s`}`;

/** The counts line of a catalogue with errors or warnings, as `stackledger <command>` writes it; none when clean. */
export function problemCounts(command: string, catalogue: Catalogue): string[] {
  const { errors, warnings } = catalogue.summary;
  if (!errors && !warnings) return [];
  return [`stackledger ${command}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}; run stackledger validate for details`];
}

/** The map's diagnostic lines: an unused layout, suggested positions and unrouted hops (shared with build). */
export function mapNotes(loaded: Loaded, catalogue: Catalogue, geometry: MapGeometry): string[] {
  const notes: string[] = [];
  if (!catalogue.served.layouts.length && loaded.sources.some(source => source.value.kind === 'MapLayout')) {
    notes.push('Stored positions are not used because the layout has errors');
  }
  if (geometry.suggestions.length) {
    notes.push('Suggested positions for MapLayout spec.stations:');
    for (const suggestion of geometry.suggestions) notes.push(`    ${suggestion.ref}: [${suggestion.point[0]}, ${suggestion.point[1]}]`);
  }
  for (const hop of geometry.unrouted) {
    for (const line of hop.lines) notes.push(`Unrouted hop: ${line} ${hop.from} -> ${hop.to} (drawn straight)`);
  }
  return notes;
}

export async function mapCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: { view: { type: 'string' }, theme: { type: 'string' }, date: { type: 'string' } },
  });
  const [, folder, ...extra] = positionals;
  if (!folder) throw new Error('A catalogue folder is required');
  if (extra.length) throw new Error('Only one folder is accepted');
  const view = values.view ?? 'full';
  const themeName = values.theme ?? 'light';
  const date = values.date ?? localDate();
  if (!viewNames.includes(view as ViewName)) throw new Error(`Unknown view; allowed views: ${viewNames.join(', ')}`);
  if (themeName !== 'light' && themeName !== 'dark') throw new Error('Unknown theme; allowed themes: light, dark');
  if (!isDate(date)) throw new Error('Map date must be a real YYYY-MM-DD date');

  const loaded = await loadFolder(resolve(folder));
  const catalogue = validateLoaded(loaded);
  const theme = themes[themeName];
  const served = applyView(catalogue.served, view as ViewName, resolveHidden(catalogue));
  // Render before publishing bytes: unexpected geometry errors must leave stdout empty.
  // Arguments and the folder are checked above, so a failure here is a bug, not a usage error.
  let geometry: MapGeometry;
  let svg: string;
  try {
    geometry = layoutMap(buildMapModel(served, date), theme.lineWidth, inkOf(theme));
    svg = renderSvg(geometry, theme);
  } catch (error) {
    throw internal('map', error);
  }

  const diagnostics: string[] = [];
  if (view === 'full') diagnostics.push(...problemCounts('map', catalogue));
  diagnostics.push(...mapNotes(loaded, catalogue, geometry));
  if (diagnostics.length) process.stderr.write(diagnostics.join('\n') + '\n');
  process.stdout.write(svg + '\n');
}
