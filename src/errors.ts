/** Failure classes for the command line. Used by src/cli.ts and src/map/command.ts.
 * Usage and folder errors exit 2 with usage text; an InternalError is a bug in stackledger
 * itself and exits 1 with one line and no usage. Messages never span lines.
 */
export class InternalError extends Error {
  override name = 'InternalError';
}

/** Wrap an unexpected failure from inside a command as a one-line InternalError. */
export function internal(command: string, error: unknown): InternalError {
  const detail = error instanceof Error ? error.message : String(error);
  return new InternalError(`stackledger ${command}: internal error: ${detail.replace(/\s+/g, ' ').trim()}`);
}

/** The stderr text and exit code for a failure caught at the top of the command line. */
export function reportFailure(error: unknown, usage: string): { stderr: string; exitCode: number } {
  if (error instanceof InternalError) return { stderr: `${error.message}\n`, exitCode: 1 };
  return { stderr: `${error instanceof Error ? error.message : 'Cannot run command'}\n${usage}`, exitCode: 2 };
}
