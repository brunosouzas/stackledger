/** Discovery annotations on components: `stackledger/<source>: id, id, …` (catalogue spec).
 *
 * Why one module: `stackledger validate` warns about these annotations and `stackledger drift`
 * matches snapshot items through them, so both must read keys and identifiers the same way.
 * Pure functions, no I/O. The source names and their order are the snapshot's source order.
 */

/** Discovery sources in source order (mac-discovery spec, Sources). */
export const SOURCES = ['brew', 'cask', 'mas', 'app', 'launchd', 'mise', 'npm', 'pipx'] as const;
export type SourceName = typeof SOURCES[number];

/** Every annotation key starting with this prefix must be one of ANNOTATION_KEYS. */
export const ANNOTATION_PREFIX = 'stackledger/';
export const ANNOTATION_KEYS: readonly string[] = SOURCES.map(source => `${ANNOTATION_PREFIX}${source}`);

/** The source an annotation key names, or undefined for an unknown or non-discovery key. */
export function annotationSource(key: string): SourceName | undefined {
  if (!key.startsWith(ANNOTATION_PREFIX)) return undefined;
  const source = key.slice(ANNOTATION_PREFIX.length);
  return (SOURCES as readonly string[]).includes(source) ? source as SourceName : undefined;
}

/** The identifiers of an annotation value: comma-separated, spaces around each ignored.
 * `empty` is true when the list holds an empty identifier (`git,,gh`, a trailing comma, a blank value). */
export function identifiers(value: string): { ids: string[]; empty: boolean } {
  const parts = value.split(',').map(part => part.trim());
  return { ids: parts.filter(part => part !== ''), empty: parts.some(part => part === '') };
}

/** The form identifiers are compared in (drift-command spec, Matching through annotations):
 * exact, except `app` (ASCII case ignored) and `pipx` (lower case, runs of `-`, `_`, `.` read as `-`). */
export function normaliseId(source: SourceName, id: string): string {
  if (source === 'app') return id.replace(/[A-Z]/g, letter => letter.toLowerCase());
  if (source === 'pipx') return id.toLowerCase().replace(/[-_.]+/g, '-');
  return id;
}

export function sameIdentifier(source: SourceName, left: string, right: string): boolean {
  return normaliseId(source, left) === normaliseId(source, right);
}
