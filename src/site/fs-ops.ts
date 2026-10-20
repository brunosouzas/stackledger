/** The filesystem calls the build command makes on its output folder (design D8).
 *
 * Why an interface: command.ts and publish.ts reach the output folder only through an FsOps object,
 * so a test can pass a wrapper that fails or swaps the folder at a chosen call and prove the undo,
 * the refusals and the identity checks. The shipped code always uses NODE_FS and has no test-only
 * branch; src/cli.ts passes nothing, so a user cannot change how the build touches the disk.
 *
 * Every call is synchronous and throws the error node:fs throws. Writing the sites into the staging
 * folder (build.ts, Astro) does not go through here: it happens before anything published changes.
 */
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, type Stats } from 'node:fs';

export interface FsOps {
  /** The entry's own status; a symbolic link is not followed. */
  lstat(path: string): Stats;
  /** The status of what the path points to (links followed). */
  stat(path: string): Stats;
  /** The path with every symbolic link resolved. */
  realpath(path: string): string;
  /** The names in a folder. */
  readdir(path: string): string[];
  /** A text file read as UTF-8. */
  readFile(path: string): string;
  /** Create a folder; with `recursive`, its missing parents too and no error when it exists. */
  mkdir(path: string, options?: { recursive: boolean }): void;
  /** Rename an entry within one filesystem (atomic). */
  rename(from: string, to: string): void;
  /** Remove an empty folder. */
  rmdir(path: string): void;
  /** Remove an entry and, for a folder, everything in it; links inside are removed, not followed. */
  rm(path: string): void;
}

/** The real filesystem: what the CLI uses. */
export const NODE_FS: FsOps = {
  lstat: path => lstatSync(path),
  stat: path => statSync(path),
  realpath: path => realpathSync.native(path),
  readdir: path => readdirSync(path),
  readFile: path => readFileSync(path, 'utf8'),
  mkdir: (path, options) => {
    mkdirSync(path, options);
  },
  rename: (from, to) => renameSync(from, to),
  rmdir: path => rmdirSync(path),
  rm: path => rmSync(path, { recursive: true, force: true }),
};
