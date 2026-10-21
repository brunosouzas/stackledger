/** The machine name (mac-discovery spec, Machine name). Run npm test.
 * `scutil` is replaced by a fake Run that answers with fictitious names; nothing real is read.
 */
import { test, expect } from 'vitest';
import { fold, machineName } from '../../src/discovery/machine.js';
import type { Run } from '../../src/discovery/run.js';

function scutil(names: Record<string, string>): Run {
  return async (program, args) => {
    if (program !== 'scutil' || args[0] !== '--get') return { kind: 'not found' };
    const name = names[args[1]!];
    return name === undefined ? { kind: 'exited', code: 1, stdout: '' } : { kind: 'exited', code: 0, stdout: `${name}\n` };
  };
}

test('Name with spaces', async () => {
  expect(fold('username - MacBook Air')).toBe('username-macbook-air');
  expect(await machineName(scutil({ ComputerName: 'username - MacBook Air' }))).toBe('username-macbook-air');
});

test('Name with accents', async () => {
  expect(await machineName(scutil({ ComputerName: 'MacBook de João' }))).toBe('macbook-de-joao');
});

test('Name with nothing usable', async () => {
  expect(await machineName(scutil({ ComputerName: '☕☕', LocalHostName: 'Northwind-Mac' }))).toBe('northwind-mac');
});

test('No usable name at all', async () => {
  expect(await machineName(scutil({ ComputerName: '☕☕', LocalHostName: '---' }))).toBe('mac');
  expect(await machineName(async () => ({ kind: 'time limit' }))).toBe('mac');
});
