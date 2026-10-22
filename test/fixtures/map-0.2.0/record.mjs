// Records the 0.2.0 engine's SVGs of the example catalogue (metro-map "Software map unchanged").
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(process.argv[2]);
const { loadFolder } = await import(join(root, 'dist/source.js'));
const { validateLoaded } = await import(join(root, 'dist/validate.js'));
const { applyView, resolveHidden } = await import(join(root, 'dist/views.js'));
const { buildMapModel } = await import(join(root, 'dist/map/model.js'));
const { layoutMap } = await import(join(root, 'dist/map/layout.js'));
const { renderSvg } = await import(join(root, 'dist/map/svg.js'));
const { themes, inkOf, widestInk } = await import(join(root, 'dist/map/themes.js'));
const catalogue = validateLoaded(await loadFolder(join(root, 'examples/northwind')));
for (const view of ['full', 'staff']) for (const name of ['light', 'dark']) for (const chrome of [true, false]) {
  const theme = themes[name];
  const served = applyView(catalogue.served, view, resolveHidden(catalogue));
  // The site draws both themes from one geometry laid out with the widest ink (src/site/data.ts).
  const ink = chrome ? inkOf(theme) : widestInk(inkOf(themes.light), inkOf(themes.dark));
  const svg = renderSvg(layoutMap(buildMapModel(served, '2027-06-01'), chrome ? theme.lineWidth : themes.light.lineWidth, ink), theme, { chrome });
  writeFileSync(join(root, 'test/fixtures/map-0.2.0', `${view}-${name}${chrome ? '' : '-site'}.svg`), svg + '\n');
}
