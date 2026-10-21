/** An in-memory discovery Host for unit tests (design D7). Run through npm test.
 *
 * Why: source tests need a whole fictitious Mac (apps, launchd files, mise and pipx folders, program
 * outputs) at its real paths, such as /Users/username/Applications, without touching the real disk or
 * running a real program. The tree comes from test/fixtures/discovery/machine.json; program outputs
 * from the other fixtures there. `plutil` is answered from the virtual files, which hold JSON plists
 * (real plutil reads those too). Every program call is recorded in `calls`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { EntryStatus, Host } from '../src/discovery/host.js';
import type { RunResult } from '../src/discovery/run.js';

export const fixtures = fileURLToPath(new URL('./fixtures/discovery/', import.meta.url));
export const fixture = (name: string) => readFileSync(`${fixtures}${name}`, 'utf8');

/** A virtual entry: a file's text (an object is written as JSON), a folder, or a symbolic link. */
export type Entry = string | object | { dir: true; unreadable?: boolean } | { link: string } | { file: string; unreadable?: boolean; hang?: boolean };
export type Program = (args: string[], host: VirtualHost) => RunResult | Promise<RunResult>;
export interface VirtualHost extends Host { calls: { program: string; args: string[] }[]; files: Map<string, Node> }
type Node = { kind: 'dir'; unreadable: boolean } | { kind: 'link'; target: string } | { kind: 'file'; text: string; unreadable: boolean; hang: boolean };

const exited = (stdout: string, code = 0): RunResult => ({ kind: 'exited', code, stdout });
const fsError = (code: string) => Object.assign(new Error(code), { code });

/** plutil as discovery calls it: `-convert json -o - <file>` or `-extract <key> raw -expect string -o - <file>`. */
const plutil: Program = (args, host) => {
  const path = args.at(-1)!, node = host.files.get(path);
  if (!node || node.kind !== 'file' || node.unreadable) return exited('', 1);
  if (node.hang) return { kind: 'time limit' };
  let value: unknown;
  try { value = JSON.parse(node.text); } catch { return exited('', 1); }
  if (args[0] === '-convert') return exited(node.text);
  for (const part of args[1]!.split('.')) {
    value = value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
  }
  return typeof value === 'string' ? exited(`${value}\n`) : exited('', 1);
};

export const defaultPrograms = (): Record<string, Program> => ({
  brew: () => exited(fixture('brew-info.json')),
  mas: () => exited(fixture('mas-list.txt')),
  npm: () => exited(fixture('npm-ls.json')),
  plutil,
  scutil: args => exited(args[1] === 'ComputerName' ? 'username - MacBook Air\n' : 'username---MacBook-Air\n'),
  sw_vers: () => exited('27.2\n'),
});

export function machineFiles(): Record<string, Entry> {
  return JSON.parse(fixture('machine.json')) as Record<string, Entry>;
}

export function virtualHost(options: { files?: Record<string, Entry>; programs?: Record<string, Program | undefined>; env?: Record<string, string>; user?: string; platform?: NodeJS.Platform; sandbox?: boolean } = {}): VirtualHost {
  const files = new Map<string, Node>();
  const addDirs = (path: string) => {
    for (let parent = dirname(path); parent !== '/' && !files.has(parent); parent = dirname(parent)) files.set(parent, { kind: 'dir', unreadable: false });
  };
  for (const [path, entry] of Object.entries(options.files ?? machineFiles())) {
    addDirs(path);
    if (typeof entry === 'string') files.set(path, { kind: 'file', text: entry, unreadable: false, hang: false });
    else if ('dir' in entry) files.set(path, { kind: 'dir', unreadable: entry.unreadable ?? false });
    else if ('link' in entry) files.set(path, { kind: 'link', target: entry.link });
    else if ('file' in entry && typeof entry.file === 'string') files.set(path, { kind: 'file', text: entry.file, unreadable: entry.unreadable ?? false, hang: entry.hang ?? false });
    else files.set(path, { kind: 'file', text: JSON.stringify(entry), unreadable: false, hang: false });
  }
  const programs = { ...defaultPrograms(), ...options.programs };
  const status = (node: Node): EntryStatus => ({
    isFile: () => node.kind === 'file', isDirectory: () => node.kind === 'dir', isSymbolicLink: () => node.kind === 'link',
    size: node.kind === 'file' ? Buffer.byteLength(node.text) : 0,
  });
  const host: VirtualHost = {
    calls: [], files,
    platform: options.platform ?? 'darwin',
    env: options.env ?? { PATH: '/usr/bin:/bin', HOME: '/Users/username', USER: 'username' },
    home: '/Users/username',
    user: options.user ?? 'username',
    applications: '/Applications',
    library: '/Library',
    sandbox: '/usr/bin/sandbox-exec',
    snapshotRoot: '/Users/username/.stackledger',
    run: async (program, args) => {
      host.calls.push({ program, args });
      const fake = programs[program];
      return fake ? fake(args, host) : { kind: 'not found' };
    },
    readdir: async path => {
      const node = files.get(path);
      if (!node) throw fsError('ENOENT');
      if (node.kind !== 'dir') throw fsError('ENOTDIR');
      if (node.unreadable) throw fsError('EACCES');
      return [...files.keys()].filter(key => dirname(key) === path && key !== path).map(key => key.slice(path.length + 1));
    },
    lstat: async path => { const node = files.get(path); if (!node) throw fsError('ENOENT'); return status(node); },
    readFile: async path => {
      let node = files.get(path);
      if (node?.kind === 'link') node = files.get(node.target);
      if (!node) throw fsError('ENOENT');
      if (node.kind !== 'file') throw fsError('EISDIR');
      if (node.unreadable) throw fsError('EACCES');
      return node.text;
    },
    canRead: async path => { const node = files.get(path); return node?.kind === 'file' && !node.unreadable; },
    isFile: async path => path === '/usr/bin/sandbox-exec' ? (options.sandbox ?? true) : files.get(path)?.kind === 'file',
  };
  return host;
}
