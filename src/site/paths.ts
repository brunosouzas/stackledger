/** Path checks shared by the build command (command.ts) and the publication (publish.ts).
 *
 * Why one module: both decide whether a path is inside the output folder and look at entries
 * without following symbolic links, and the two must agree.
 */
import { lstatSync, type Stats } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';

/** True when `child` is `parent` or inside it (both absolute paths). Only a `..` segment leaves
 * `parent`: a child named `..review-probe` is inside it. */
export function within(child: string, parent: string): boolean {
  const path = relative(parent, child);
  const outside = path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
  return !outside;
}

/** The entry's own status (a link is not followed), or undefined when nothing is there. */
export function lstatOrUndefined(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
