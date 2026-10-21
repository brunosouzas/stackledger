/** The real macOS sandbox around every discovery program (mac-discovery spec, Sandbox, Program limits,
 * Program environment). Runs only on macOS (locally and in the macos-latest CI job): it needs
 * /usr/bin/sandbox-exec. Fake programs live in temporary folders; nothing outside them is touched.
 */
import { describe, test, expect } from 'vitest';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { fakeProgram, onMac, REAL_SANDBOX } from '../discovery-helpers.js';
import { createRunner, failureReason } from '../../src/discovery/run.js';
import { diskMachine, discoverRun } from './discover-helpers.js';
import { root } from './helpers.js';

function runner(bin: string, env: Record<string, string> = {}, timeoutMs = 60_000) {
  return createRunner({ sandbox: REAL_SANDBOX, env: { PATH: bin, HOME: folder(), ...env }, programDirs: [], timeoutMs });
}

describe.runIf(onMac)('sandbox', () => {
  test('Write denied', async () => {
    const bin = folder(), target = join(folder(), 'written');
    fakeProgram(bin, 'brew', `/usr/bin/touch "${target}" 2>/dev/null\necho '{"formulae":[],"casks":[]}'`);
    const result = await runner(bin)('brew', ['info']);
    expect(result).toEqual({ kind: 'exited', code: 0, stdout: '{"formulae":[],"casks":[]}\n' });
    expect(existsSync(target)).toBe(false);
  });

  test('Network denied', async () => {
    let connections = 0;
    const server = createServer(socket => { connections++; socket.destroy(); });
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as { port: number }).port;
    try {
      const bin = folder();
      // bash's /dev/tcp opens a TCP connection without any other program.
      fakeProgram(bin, 'npm', `/bin/bash -c 'echo hello > /dev/tcp/127.0.0.1/${port}' 2>/dev/null && echo connected || echo refused`);
      const result = await runner(bin)('npm', ['ls']);
      expect(result).toEqual({ kind: 'exited', code: 0, stdout: 'refused\n' });
      // Give a connection that did get through the time to reach the listener.
      await new Promise(done => setTimeout(done, 200));
      expect(connections).toBe(0);
    } finally { server.close(); }
  });

  test('Program that hangs', async () => {
    const bin = folder();
    fakeProgram(bin, 'brew', 'exec /bin/sleep 30');
    const started = Date.now();
    const result = await runner(bin, {}, 500)('brew', ['info']);
    expect(failureReason(result)).toBe('time limit');
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test('Caller environment not passed', async () => {
    const bin = folder();
    fakeProgram(bin, 'mas', '/usr/bin/env');
    const result = await runner(bin, { NORTHWIND_TOKEN: 'nw-example-value' })('mas', ['list']);
    expect(result.kind).toBe('exited');
    const stdout = result.kind === 'exited' ? result.stdout : '';
    expect(stdout).not.toContain('NORTHWIND_TOKEN');
    expect(stdout).not.toContain('nw-example-value');
    expect(stdout).toContain('HOMEBREW_NO_AUTO_UPDATE=1');
  });

  test('Writes only the snapshot', () => {
    const machine = diskMachine({ sandbox: REAL_SANDBOX });
    // Node may read anything and start the sandboxed programs, but write only under the snapshot root.
    // The root does not exist yet, so both the folder itself and everything below it are granted.
    const flags = ['--no-warnings', '--permission', '--allow-fs-read=*', '--allow-child-process', `--allow-fs-write=${machine.snapshotRoot}`, `--allow-fs-write=${machine.snapshotRoot}/*`];
    const result = discoverRun(machine, [], flags);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    // Every fictitious source was read through the real sandbox.
    expect(result.stdout).not.toMatch(/failed|skipped/);
    expect(existsSync(join(machine.snapshotRoot, 'username-macbook-air', 'snapshot.json'))).toBe(true);
    // The same flags really deny a write elsewhere: not a no-op under a permissive flag.
    const probe = discoverRun(machine, [], ['--no-warnings', '--permission', '--allow-fs-read=*', '--allow-child-process', `--allow-fs-write=${join(root, 'nowhere')}`]);
    expect(probe.status).toBe(1);
    expect(probe.stderr).toContain('ERR_ACCESS_DENIED');
  });
});
