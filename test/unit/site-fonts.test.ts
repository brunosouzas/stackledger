/** The fonts configuration of the build (catalogue-site, Font delivery; build-command, Writes): the
 * Fonts API reads the families with its local provider only, by paths relative to the project root,
 * so the build makes no network call for them and its output does not depend on the staging folder.
 * Run npm test.
 */
import { expect, test } from 'vitest';
import { fontProviders } from 'astro/config';
import { astroConfig, FONT_FILES } from '../../src/site/build.js';

test('Fonts from the local provider and root-relative paths', async () => {
  const config = await astroConfig('/staging', 'full', '/staging/work-full');
  const local = fontProviders.local();
  expect(config.fonts.map(family => [family.name, family.cssVariable])).toEqual([
    ['Source Sans 3', '--font-primary'], ['Source Serif 4', '--font-secondary'], ['Source Code Pro', '--font-mono'],
  ]);
  for (const family of config.fonts) {
    expect(family.provider.constructor, family.name).toBe(local.constructor);
    expect(family.provider.name, family.name).toBe('local');
    for (const variant of family.options.variants) for (const src of variant.src) expect(src, family.name).toMatch(/^\.\/src\/fonts\/[a-z0-9-]+\.woff2$/);
  }
  const faces = config.fonts.flatMap(family => family.options.variants.map(variant => `${family.name} ${variant.weight} ${variant.style}`));
  expect(faces).toEqual(['Source Sans 3 400 normal', 'Source Sans 3 600 normal', 'Source Sans 3 700 normal', 'Source Sans 3 900 normal',
    'Source Serif 4 700 normal', 'Source Serif 4 700 italic', 'Source Code Pro 400 normal']);
  // Every path names a file the build copies into src/fonts/ from the @fontsource packages.
  const copied = FONT_FILES.map(([, file]) => `./src/fonts/${file}`).sort();
  expect(config.fonts.flatMap(family => family.options.variants.flatMap(variant => variant.src)).sort()).toEqual(copied);
  // Astro's own policy stays off: the site writes its own CSP meta.
  expect(config).not.toHaveProperty('security');
});
