/** Discovery sources, the program runner and the left-out items (mac-discovery spec). Run npm test.
 * Fictitious Northwind outputs from test/fixtures/discovery/, fake programs and fake folders in
 * temporary directories; the real machine is never read. Runs on every platform: the runner is given
 * a pass-through stand-in for sandbox-exec (the real sandbox is tested in discover-sandbox.test.ts).
 */
import { test, expect } from 'vitest';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { fakeProgram, passThroughSandbox } from '../discovery-helpers.js';
import { createRunner } from '../../src/discovery/run.js';

test('Homebrew outside PATH', async () => {
  const path = folder(), homebrew = join(folder(), 'opt', 'homebrew', 'bin');
  fakeProgram(homebrew, 'brew', 'echo from-homebrew-bin');
  const run = createRunner({ sandbox: passThroughSandbox(), env: { PATH: path }, programDirs: [homebrew, join(folder(), 'usr', 'local', 'bin')] });
  expect(await run('brew', ['info'])).toEqual({ kind: 'exited', code: 0, stdout: 'from-homebrew-bin\n' });
  expect(await run('mas', ['list'])).toEqual({ kind: 'not found' });
});
