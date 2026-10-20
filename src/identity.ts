/** Pure catalogue identities, ordering and date checks, shared with the browser map engine.
 * Import these helpers without loading filesystem/parser modules. Invalid references return
 * undefined and invalid dates return false; npm test covers the existing catalogue contracts.
 */
/** Compare Unicode code points, not locale collation or UTF-16 surrogate order. */
export function compareText(left: string, right: string): number {
  const a = Array.from(left, c => c.codePointAt(0)!);
  const b = Array.from(right, c => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}
export interface Reference { kind: string; namespace: string; name: string; key: string }
/** Catalogue reference syntax; kind, namespace and name lower-cased, key is kind:name. */
export function reference(value: string): Reference | undefined {
  const match = /^([A-Za-z][A-Za-z0-9]*):(?:([A-Za-z0-9._-]+)\/)?([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(value);
  if (!match) return;
  const kind = match[1]!.toLowerCase(), namespace = match[2]?.toLowerCase() ?? 'default', name = match[3]!.toLowerCase();
  return { kind, namespace, name, key: `${kind}:${name}` };
}
const kindOrder: Record<string, number> = { component: 0, resource: 1, line: 2 };
/** Results order: name by Unicode code point, ties component, resource, line. */
export function compareRefs(left: string, right: string): number {
  const a = left.indexOf(':'), b = right.indexOf(':');
  return compareText(left.slice(a + 1), right.slice(b + 1)) || (kindOrder[left.slice(0, a)] ?? 3) - (kindOrder[right.slice(0, b)] ?? 3);
}
/** A real calendar date written YYYY-MM-DD. */
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
