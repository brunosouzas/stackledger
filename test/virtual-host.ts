/** An in-memory discovery Host for unit tests (design D7). Run through npm test.
 *
 * Why: source tests need a whole fictitious Mac (apps, launchd files, mise and pipx folders, program
 * outputs) at its real paths, such as /Users/username/Applications, without touching the real disk or
 * running a real program. The tree comes from test/fixtures/discovery/machine.json; program outputs
 * from the other fixtures there. `plutil` is answered from the virtual files, which hold JSON plists
 * (real plutil reads those too). Every program call is recorded in `calls`.
 *
 * Links behave as on a real disk: a link anywhere before the last part of a path is followed by every
 * call; the last part is followed by readdir, readFile, plutil and isFile, but not by lstat, nor by
 * canRead (which opens with O_NOFOLLOW). So a test sees what a source would read through a link.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { EntryStatus, Host } from '../src/discovery/host.js';
import type { RunResult } from '../src/discovery/run.js';

export const fixtures = fileURLToPath(new URL('./fixtures/discovery/', import.meta.url));
export const fixture = (name: string) => readFileSync(`${fixtures}${name}`, 'utf8');

/** A virtual entry: a file's text (an object is written as JSON), a folder, or a symbolic link. A folder
 * that is `unreadable` cannot be listed; a folder or file that is `unstatable` cannot be examined (lstat fails). */
export type Entry = string | object | { dir: true; unreadable?: boolean; unstatable?: boolean } | { link: string } | { file: string; unreadable?: boolean; hang?: boolean; unstatable?: boolean };
export type Program = (args: string[], host: VirtualHost) => RunResult | Promise<RunResult>;
export interface VirtualHost extends Host {
  calls: { program: string; args: string[] }[];
  files: Map<string, Node>;
  /** The key in `files` a path leads to: links before the last part followed, the last one too when `followLast`. */
  resolve(path: string, followLast: boolean): string;
}
type Node = { kind: 'dir'; unreadable: boolean; unstatable?: boolean } | { kind: 'link'; target: string } | { kind: 'file'; text: string; unreadable: boolean; hang: boolean; unstatable?: boolean };

const exited = (stdout: string, code = 0): RunResult => ({ kind: 'exited', code, stdout });
const fsError = (code: string) => Object.assign(new Error(code), { code });

/** plutil as discovery calls it: `-convert json -o - <file>` or `-extract <key> raw -expect string -o - <file>`. */
const plutil: Program = (args, host) => {
  const node = host.files.get(host.resolve(args.at(-1)!, true));
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
    else if ('dir' in entry) files.set(path, { kind: 'dir', unreadable: entry.unreadable ?? false, unstatable: entry.unstatable ?? false });
    else if ('link' in entry) files.set(path, { kind: 'link', target: entry.link });
    else if ('file' in entry && typeof entry.file === 'string') files.set(path, { kind: 'file', text: entry.file, unreadable: entry.unreadable ?? false, hang: entry.hang ?? false, unstatable: entry.unstatable ?? false });
    else files.set(path, { kind: 'file', text: JSON.stringify(entry), unreadable: false, hang: false });
  }
  const programs = { ...defaultPrograms(), ...options.programs };
  const status = (node: Node): EntryStatus => ({
    isFile: () => node.kind === 'file', isDirectory: () => node.kind === 'dir', isSymbolicLink: () => node.kind === 'link',
    size: node.kind === 'file' ? Buffer.byteLength(node.text) : 0,
  });
  /** Follow links like the kernel does, giving up (ELOOP) after 40 of them. */
  const follow = (path: string, followLast: boolean): string => {
    let hops = 0;
    const walk = (current: string, rest: string[]): string => {
      const [part, ...after] = rest;
      if (part === undefined) return current;
      const next = current === '/' ? `/${part}` : `${current}/${part}`, node = files.get(next);
      if (node?.kind === 'link' && (after.length || followLast)) {
        if (++hops > 40) throw fsError('ELOOP');
        const target = resolve(dirname(next), node.target);
        return walk('/', [...target.split('/').filter(Boolean), ...after]);
      }
      return walk(next, after);
    };
    return walk('/', path.split('/').filter(Boolean));
  };
  const host: VirtualHost = {
    calls: [], files, resolve: follow,
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
      path = follow(path, true);
      const node = files.get(path);
      if (!node) throw fsError('ENOENT');
      if (node.kind !== 'dir') throw fsError('ENOTDIR');
      if (node.unreadable) throw fsError('EACCES');
      return [...files.keys()].filter(key => dirname(key) === path && key !== path).map(key => key.slice(path.length + 1));
    },
    lstat: async path => {
      const node = files.get(follow(path, false));
      if (!node) throw fsError('ENOENT');
      if ((node.kind === 'dir' || node.kind === 'file') && node.unstatable) throw fsError('EACCES');
      return status(node);
    },
    readFile: async path => {
      const node = files.get(follow(path, true));
      if (!node) throw fsError('ENOENT');
      if (node.kind !== 'file') throw fsError('EISDIR');
      if (node.unreadable) throw fsError('EACCES');
      return node.text;
    },
    canRead: async path => { const node = files.get(follow(path, false)); return node?.kind === 'file' && !node.unreadable; },
    isFile: async path => path === '/usr/bin/sandbox-exec' ? (options.sandbox ?? true) : files.get(follow(path, true))?.kind === 'file',
  };
  return host;
}
