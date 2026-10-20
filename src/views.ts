/** The full and staff views of a served catalogue. Used by the MCP server and the future site.
 * Staff entities are rebuilt from allow-lists, never by deleting keys, so a misplaced field cannot pass.
 * Broken settings fail closed: every licence field is hidden until they are fixed.
 */
import { licenceFields, type Component, type Licence, type Line, type MapLayout, type LicenceField } from './schema.js';
import type { Catalogue, OtherResource, Served } from './validate.js';
export type ViewName = 'full' | 'staff';
export const viewNames: readonly ViewName[] = ['full', 'staff'];
export const defaultHidden: readonly LicenceField[] = ['cost', 'currency', 'cycle', 'renewsOn', 'paidBy', 'seats', 'vaultItem', 'note'];
export interface View { name: ViewName; components: Component[]; licences: Licence[]; resources: OtherResource[]; lines: Line[]; layout?: MapLayout }
const metadataFields = ['name', 'namespace', 'title', 'description', 'labels', 'annotations', 'tags'] as const;
const settingsFiles = new Set(['stackledger.yaml', 'stackledger.yml']);

/** Whether the Settings in use has an error: a broken Settings document or any error in stackledger.yaml. */
export function settingsInError(catalogue: Pick<Catalogue, 'problems' | 'settingsBroken'>): boolean {
  const brokenFile = catalogue.problems.some(p => p.severity === 'error' && settingsFiles.has(p.path.split('/').at(-1)!.toLowerCase()));
  return catalogue.settingsBroken || brokenFile;
}
/** Hidden licence fields for the staff view: the earliest valid Settings list, the default, or all when broken. */
export function resolveHidden(catalogue: Pick<Catalogue, 'problems' | 'served' | 'settingsBroken'>): LicenceField[] {
  if (settingsInError(catalogue)) return [...licenceFields];
  const hide = catalogue.served.settings[0]?.spec.views?.staff?.hide;
  return [...(hide ?? defaultHidden)];
}
function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) if (Object.hasOwn(source, key) && source[key] !== undefined) result[key] = structuredClone(source[key]);
  return result;
}
function staffComponent(component: Component): Component {
  return { apiVersion: component.apiVersion, kind: component.kind,
    metadata: pick(component.metadata, metadataFields) as Component['metadata'],
    spec: pick(component.spec, ['type', 'lifecycle', 'owner', 'dependsOn']) as Component['spec'] };
}
function staffLicence(licence: Licence, hidden: ReadonlySet<string>): Licence {
  const spec = pick(licence.spec, ['type', 'owner']);
  const details = pick(licence.spec.licence, licenceFields.filter(field => !hidden.has(field)));
  // A licence whose every field is hidden carries no licence block at all.
  if (Object.keys(details).length) spec.licence = details;
  return { apiVersion: licence.apiVersion, kind: licence.kind,
    metadata: pick(licence.metadata, metadataFields) as Licence['metadata'], spec: spec as Licence['spec'] };
}
/** Deep copies of the served documents as the given view shows them; the only way consumers read data. */
export function applyView(served: Served, view: ViewName, hidden: readonly string[]): View {
  const layout = served.layouts[0];
  const result: View = { name: view, resources: structuredClone(served.resources), lines: structuredClone(served.lines),
    components: view === 'full' ? structuredClone(served.components) : served.components.map(staffComponent),
    licences: view === 'full' ? structuredClone(served.licences) : served.licences.map(l => staffLicence(l, new Set(hidden))) };
  if (layout) result.layout = structuredClone(layout);
  return result;
}
