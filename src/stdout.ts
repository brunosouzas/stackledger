/** Write a command's whole output to stdout with the EPIPE guard. Used by `report` and `discover`
 * (and `drift`, design D6), so a reader that closes the pipe gives one line and exit 1, never a stack.
 */
import { InternalError } from './errors.js';

/** Write all of `text` to stdout, or throw InternalError `<failure> (<code>)` when the stream fails (EPIPE). */
export async function writeStdout(text: string, failure: string): Promise<void> {
  await new Promise<void>((done, fail) => {
    // The stream reports a closed pipe both to the write callback and as an 'error' event; without
    // a listener the event would crash the process with a stack trace instead of one line.
    const onError = (error: Error) => fail(error);
    process.stdout.on('error', onError);
    process.stdout.write(text, error => {
      if (error) fail(error);
      else {
        process.stdout.off('error', onError);
        done();
      }
    });
  }).catch((error: NodeJS.ErrnoException) => {
    throw new InternalError(`${failure} (${error.code ?? error.message})`);
  });
}
