/** package.json holds what npm needs to publish the package and link its provenance to this
 * repository (package-release spec, Package metadata). Run npm test.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as Record<string, unknown>;

test('Metadata: public package linked to github.com/brunosouzas/stackledger', () => {
  expect(pkg).not.toHaveProperty('private');
  expect(pkg.name).toBe('stackledger');
  expect(pkg.license).toBe('Apache-2.0');
  expect(pkg.bin).toEqual({ stackledger: 'dist/cli.js' });
  expect(pkg.engines).toEqual({ node: '>=22.12' });
  expect(pkg.repository).toEqual({ type: 'git', url: 'git+https://github.com/brunosouzas/stackledger.git' });
  expect(pkg.homepage).toBe('https://github.com/brunosouzas/stackledger#readme');
  expect(pkg.bugs).toEqual({ url: 'https://github.com/brunosouzas/stackledger/issues' });
  // npm publish packs through prepack, so the tarball always carries a fresh build.
  expect((pkg.scripts as Record<string, string>).prepack).toBe('npm run build');
});
