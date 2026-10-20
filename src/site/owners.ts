/** Display names of owners for the site: `group:northwind` shows as the title of the Group document
 * `northwind` when the catalogue has one (catalogue-site polish; pages show owners by name).
 *
 * Why here and not in the views: Group and User are ignored kinds (docs/catalogue-format.md), so
 * validation never reads them and no view serves them. The site only borrows their display name,
 * and only from a document that passes the same identity and secret checks as a served one:
 * apiVersion backstage.io/v1alpha1, a valid metadata.name, and no secret-scan error. The name is
 * `metadata.title`, else `spec.profile.displayName`, else `metadata.name`. When two documents
 * name the same owner differently, neither is used, so the result never depends on file order.
 * Owner fields are not hidden in any view, so both sites show the same names.
 *
 * Call ownerNames(loaded.sources), then displayOwner(names, 'group:northwind').
 */
import { name as nameSchema } from '../schema.js';
import { scanSecrets } from '../secrets.js';
import type { Source } from '../source.js';

const OWNER_KINDS = new Set(['Group', 'User']);
const API_VERSION = 'backstage.io/v1alpha1';

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Owner reference (lower case `group:name` or `user:name`) -> display name. */
export function ownerNames(sources: readonly Source[]): Map<string, string> {
  const names = new Map<string, string>();
  const conflicting = new Set<string>();
  for (const source of sources) {
    const { apiVersion, kind, metadata, spec } = source.value as Record<string, unknown>;
    if (typeof kind !== 'string' || !OWNER_KINDS.has(kind) || apiVersion !== API_VERSION) continue;
    const parsed = nameSchema.safeParse(record(metadata).name);
    if (!parsed.success) continue;
    if (scanSecrets(source).some(problem => problem.severity === 'error')) continue;
    const display = text(record(metadata).title) ?? text(record(record(spec).profile).displayName) ?? parsed.data;
    const ref = `${kind}:${parsed.data}`.toLowerCase();
    const earlier = names.get(ref);
    if (earlier !== undefined && earlier !== display) conflicting.add(ref);
    names.set(ref, display);
  }
  for (const ref of conflicting) names.delete(ref);
  return names;
}

/** The display name of an owner reference, or the reference itself when no document names it. */
export function displayOwner(names: ReadonlyMap<string, string>, owner: string): string {
  return names.get(owner.toLowerCase()) ?? owner;
}
