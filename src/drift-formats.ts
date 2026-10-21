/** Text and JSON forms of a drift result (drift-command spec, Drift text output and Drift JSON
 * output; design D9). Used by src/drift-command.ts; pure.
 *
 * - formatDriftText(drift): the machine and `takenAt`, the counts, then one section per list (not
 *   declared, missing, not checked, shared, proposed relations), one line per entry. Empty sections are
 *   left out; with nothing to report a last line says there is no drift. Every text that comes from
 *   the catalogue or the snapshot has its C0 and C1 control characters removed, so an app title can
 *   neither break a line nor send a terminal escape; the output's own line feeds stay.
 * - formatDriftJson(drift): the D9 object with two-space indentation; U+007F–U+009F are written as
 *   `\u` escapes (JSON.stringify already escapes U+0000–U+001F), so no raw control character reaches a
 *   terminal and the values parse back unchanged.
 */
import type { Drift, ItemRef, NotDeclared } from './drift.js';

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
/** Catalogue or snapshot text safe for a terminal: control characters removed. */
const clean = (value: string): string => value.replace(CONTROL, '');

const item = (ref: ItemRef): string => `${ref.source} ${clean(ref.id)}${ref.path === null ? '' : ` (${clean(ref.path)})`}`;

function notDeclaredLine(entry: NotDeclared): string {
  let line = `${entry.source}  ${clean(entry.id)}`;
  if (entry.versions.length) line += ` ${entry.versions.map(clean).join(', ')}`;
  if (entry.title !== null) line += `  ${clean(entry.title)}`;
  if (entry.path !== null) line += ` (${clean(entry.path)})`;
  line += entry.annotation === null ? `  ${entry.note ?? ''}` : `  -> ${clean(entry.annotation)}`;
  if (entry.suggestedComponents.length) line += `  (probably belongs to ${entry.suggestedComponents.map(clean).join(', ')})`;
  return line;
}

export function formatDriftText(drift: Drift): string {
  const { machine, takenAt } = drift.snapshot, c = drift.counts;
  const lines = [
    `Drift of ${clean(machine.name)} (user ${clean(machine.user)}, macOS ${machine.macos === null ? 'unknown' : clean(machine.macos)}), snapshot taken ${clean(takenAt)}`,
    `Counts: items ${c.items}, matched ${c.matched}, not declared ${c.notDeclared}, dependencies ${c.dependencies}, macOS items ${c.macos}, `
      + `missing ${c.missing}, not checked ${c.notChecked}, shared ${c.shared}, proposed relations ${c.proposedRelations}, `
      + `components without annotations ${c.componentsWithoutAnnotations}`,
  ];
  const section = (title: string, entries: string[]) => { if (entries.length) lines.push('', title, ...entries); };
  section('Not declared', drift.notDeclared.map(notDeclaredLine));
  section('Missing', drift.missing.map(entry => `missing  ${clean(entry.component)}  ${entry.source} ${clean(entry.id)}${entry.incomplete ? ' (incomplete source)' : ''}`));
  section('Not checked', drift.notChecked.map(entry => `not checked  ${clean(entry.component)}  ${entry.source} ${clean(entry.id)} (${entry.status})`));
  section('Shared', drift.shared.map(entry => `shared  ${item(entry)}  ${entry.components.map(clean).join(', ')}`));
  section('Proposed relations', drift.proposedRelations.map(relation => `propose  ${clean(relation.from)} dependsOn ${clean(relation.to)}  `
    + `(${relation.reasons.map(reason => `${item(reason.from)} needs ${item(reason.to)}`).join('; ')})`));
  if (lines.length === 2) lines.push('', 'No drift: every listed item is declared and every identifier is installed.');
  return `${lines.join('\n')}\n`;
}

export function formatDriftJson(drift: Drift): string {
  const json = JSON.stringify(drift, null, 2).replace(/[\u007f-\u009f]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return `${json}\n`;
}
