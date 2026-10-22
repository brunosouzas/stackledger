/** The skill set of `stackledger build` (build-command spec: Skill folders, Skills settings with
 * problems, Skill folder errors, One page per skill item, Output folder and the skill set, Skills
 * build report). Used by src/site/command.ts; only reads.
 *
 * Why each step is where it is: the command runs every exit-2 check before any exit-1 check, and every
 * check before anything is written, so a wrong folder never empties a published Skills section.
 * - skillsInUse (exit 2): the folders in use, `--skills` first, else `spec.skills.folders` of a Settings
 *   without error, resolved from the catalogue folder; then the set is read. A folder that cannot be
 *   read is a usage error naming it as written (and `spec.skills.folders` when it comes from there).
 * - refuseSkillsOutput (exit 2): an output folder that is or holds a folder in use or a file the set was
 *   read from, or is inside a skill folder or a folder's top-level `agents/`.
 * - skillsStops (exit 1): a broken Settings with a `spec.skills` key, a folder with nothing found, two
 *   items of one kind with one page file name.
 * Configured folders are read with the catalogue folder as the current folder, so problems and messages
 * show the paths as written in the Settings; pages show only paths below each folder.
 */
import { join, relative, resolve, sep } from 'node:path';
import { withoutControls } from '../control.js';
import { CommandStop } from '../errors.js';
import type { MapGeometry } from '../map/layout.js';
import type { Loaded } from '../source.js';
import type { Catalogue } from '../validate.js';
import { settingsInError } from '../views.js';
import { pageFileName } from '../skills/mermaid.js';
import { NOTHING_FOUND, readSkillSet, type SkillSet } from '../skills/source.js';
import { SkillsFolderError } from '../skills/walk.js';
import { within } from './paths.js';
import type { FsOps } from './fs-ops.js';

const COMMAND = 'stackledger build';
const SETTINGS_KEY = 'spec.skills.folders';
const AGENTS_FOLDER = 'agents';

export interface SkillsInUse {
  set?: SkillSet;
  /** Real paths of the folders in use. */
  folders: string[];
  /** A broken Settings holds a `spec.skills` key: exit 1 once the exit-2 checks have passed. */
  brokenSettings: boolean;
  /** Report lines known before the build (a Settings file that could not be parsed). */
  notes: string[];
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The folders in use and the set read from them; throws a usage error (exit 2) for a folder that cannot be read. */
export async function skillsInUse(option: string[], loaded: Loaded, catalogue: Catalogue, catalogueFolder: string, ops: FsOps): Promise<SkillsInUse> {
  let folders: string[], cwd: string, configured = false;
  if (option.length) {
    folders = option; cwd = process.cwd();
  } else if (settingsInError(catalogue)) {
    const keyed = loaded.sources.some(source => typeof source.value.kind === 'string' && source.value.kind.toLowerCase() === 'settings'
      && Object.hasOwn(object(source.value.spec), 'skills'));
    if (keyed) return { folders: [], brokenSettings: true, notes: [] };
    const notes = loaded.settingsUnread ? ['Skill folders could not be read from the settings: a file that may hold a Settings cannot be parsed; run stackledger validate'] : [];
    return { folders: [], brokenSettings: false, notes };
  } else {
    folders = catalogue.served.settings[0]?.spec.skills?.folders ?? [];
    cwd = catalogueFolder; configured = true;
  }
  if (!folders.length) return { folders: [], brokenSettings: false, notes: [] };
  let set: SkillSet;
  try { set = await readSkillSet(folders, { cwd }); } catch (error) {
    if (error instanceof SkillsFolderError) throw new Error(configured ? `${error.message} (${SETTINGS_KEY})` : error.message);
    throw error;
  }
  return { set, folders: folders.map(folder => ops.realpath(resolve(cwd, folder))), brokenSettings: false, notes: [] };
}

/** Refuse an output folder (its real path `target`) that would touch the skill set (exit 2). */
export function refuseSkillsOutput(target: string, skills: SkillsInUse, ops: FsOps): void {
  if (!skills.set) return;
  for (const folder of skills.folders) {
    if (within(folder, target)) throw new Error('Output folder must not be a skills folder or contain one');
    let agents = join(folder, AGENTS_FOLDER);
    try { agents = ops.realpath(agents); } catch { /* No agents folder: its plain path is checked. */ }
    // As `skills map`: the first folder below the skills folder, in any case (APFS and NTFS ignore case).
    const first = within(target, folder) ? relative(folder, target).split(sep)[0] : undefined;
    if (within(target, agents) || first?.toLowerCase() === AGENTS_FOLDER) throw new Error('Output folder must not be the agents folder of a skills folder or inside it');
  }
  for (const found of skills.set.found) {
    if (within(found, target)) throw new Error(`Output folder must not hold a skill folder, agent file or file of the skill set: ${found}`);
    if (within(target, found)) throw new Error(`Output folder must not be inside a skill folder of the set: ${found}`);
  }
}

/** The exit-1 stops, after every exit-2 check and before anything is written. */
export function skillsStops(skills: SkillsInUse): void {
  if (skills.brokenSettings) {
    throw new CommandStop(`${COMMAND}: the Settings has an error and sets spec.skills; run stackledger validate. The published sites are not changed`);
  }
  if (!skills.set) return;
  const empty = skills.set.problems.find(problem => problem.message.startsWith(NOTHING_FOUND));
  if (empty) throw new CommandStop(`${COMMAND}: ${withoutControls(empty.path)}: ${NOTHING_FOUND}; the published sites are not changed`);
  const pages = new Map<string, string>();
  const items = [...skills.set.skills.map(skill => [skill.kind, skill.name, skill.path] as const), ...skills.set.agents.map(agent => ['agent', agent.name, agent.path] as const)];
  for (const [kind, name, path] of items) {
    const key = `${kind}:${pageFileName(name)}`, earlier = pages.get(key);
    if (earlier !== undefined) throw new CommandStop(`${COMMAND}: ${withoutControls(earlier)} and ${withoutControls(path)} give the same page name; rename one. The published sites are not changed`);
    pages.set(key, path);
  }
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

/** The report lines of the skill set: counts, problems, then the skills map's suggestions and unrouted hops. */
export function skillsReport(set: SkillSet, geometry: MapGeometry): string[] {
  const { skills, playbooks, agents, rules, errors, warnings } = set.summary;
  const lines = [`Skills: ${plural(skills, 'skill')}, ${plural(playbooks, 'playbook')}, ${plural(agents, 'agent')}, ${plural(rules, 'rule')}`];
  if (errors || warnings) lines.push(`Skill set: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}; run stackledger skills validate for details`);
  // The map-file key the person pastes: kind and name, control characters removed.
  const names = new Map(geometry.stations.map(station => [station.ref, station.name]));
  const key = (ref: string) => withoutControls(`${ref.slice(0, ref.indexOf(':'))}:${names.get(ref) ?? ref.slice(ref.indexOf(':') + 1)}`);
  if (geometry.suggestions.length) {
    lines.push('Suggested positions for the skills map (MapLayout spec.stations in stackledger-skills.yaml):');
    for (const suggestion of geometry.suggestions) lines.push(`    ${key(suggestion.ref)}: [${suggestion.point[0]}, ${suggestion.point[1]}]`);
  }
  for (const hop of geometry.unrouted) {
    for (const line of hop.lines) lines.push(`Unrouted hop on the skills map: ${line} ${key(hop.from)} -> ${key(hop.to)} (drawn straight)`);
  }
  return lines;
}
