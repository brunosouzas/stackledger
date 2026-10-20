/** The npm package holds no test code: no file from test/, nothing named after faults, and no shipped
 * module with a fault hook (design D8: tests wrap FsOps from outside). Run npm run build && npm test.
 * `npm pack --dry-run` lists what `npm publish` would ship, without writing a tarball; its cache is a
 * temporary folder so the user's npm cache is not touched.
 */
import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { folder } from '../helpers.js';
import { root } from './helpers.js';

test('The package holds no test file and no fault hook', () => {
  const cache = folder();
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cache], {
    cwd: root, encoding: 'utf8', timeout: 60_000, env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  expect(result.status, result.stderr).toBe(0);
  const [pack] = JSON.parse(result.stdout) as [{ files: { path: string }[] }];
  const paths = pack.files.map(file => file.path);
  expect(paths).toContain('dist/cli.js');
  expect(paths).toContain('dist/site/fs-ops.js');
  expect(paths.filter(path => path.startsWith('test/') || /fault|journal/i.test(path))).toEqual([]);
  const shipped = paths.filter(path => path.startsWith('dist/site/') && path.endsWith('.js'));
  for (const path of shipped) expect(readFileSync(join(root, path), 'utf8'), path).not.toMatch(/\bfaults?\b|\binjected\b/i);
}, 60_000);
