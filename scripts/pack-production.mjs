#!/usr/bin/env node
/** Pack a production-only staging tree without changing the development shrinkwrap. */
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(process.argv[2] ?? process.cwd());
const scratch = process.env.RUNNER_TEMP ?? join(homedir(), '.hermes', 'cache', 'scratch');
mkdirSync(scratch, { recursive: true });
const staging = mkdtempSync(join(scratch, 'stackledger-pack-'));
try {
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.stdout);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  delete manifest.devDependencies;
  // The staged package has no source or compiler; its build was completed by the caller.
  delete manifest.scripts.prepack;
  const lock = JSON.parse(readFileSync(join(root, 'npm-shrinkwrap.json'), 'utf8'));
  if (lock.name !== manifest.name || lock.version !== manifest.version ||
      JSON.stringify(lock.packages[''].dependencies) !== JSON.stringify(manifest.dependencies)) {
    throw new Error('repository shrinkwrap and package metadata disagree');
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path && (entry.dev || entry.devOptional)) delete lock.packages[path];
  }
  lock.packages[''] = { ...lock.packages[''], devDependencies: undefined };
  // Discard optional children belonging solely to removed development packages.
  const reachable = new Set(['']);
  const queue = [''];
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index];
    const entry = lock.packages[parent];
    for (const name of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies })) {
      let location = parent;
      let candidate;
      while (true) {
        candidate = `${location ? `${location}/` : ''}node_modules/${name}`;
        if (lock.packages[candidate] || !location) break;
        const marker = location.lastIndexOf('/node_modules/');
        location = marker < 0 ? '' : location.slice(0, marker);
      }
      if (lock.packages[candidate] && !reachable.has(candidate)) {
        reachable.add(candidate);
        queue.push(candidate);
      }
    }
  }
  for (const path of Object.keys(lock.packages)) if (!reachable.has(path)) delete lock.packages[path];
  for (const path of ['dist', 'site', 'skills', 'examples', 'README.md', 'LICENSE']) {
    cpSync(join(root, path), join(staging, path), { recursive: true });
  }
  writeFileSync(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(staging, 'npm-shrinkwrap.json'), JSON.stringify(lock, null, 2) + '\n');
  mkdirSync(destination, { recursive: true });
  const result = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: staging, encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  process.stdout.write(result.stdout);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
