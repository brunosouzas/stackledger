/** What two installs of the package must agree on (SW-170).
 * npm keeps a different set of other platforms' builds between two installs from the same shrinkwrap
 * (seen: one install listed @rolldown/binding-win32-arm64-msvc, the other did not, on the M5 Mac under
 * load), so the comparison of two `npm ls --all` lists leaves out the packages the shrinkwrap locks as
 * optional. Every other entry, its path and its version, must still be equal.
 */

/** `path>name@version` entries without those whose `name@version` the shrinkwrap locks as optional. */
export function withoutLockedOptional(entries: string[], lockedOptional: Set<string>): string[] {
  return entries.filter(entry => !lockedOptional.has(entry.replace(/^.*>/, '')));
}
