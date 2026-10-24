// Records the 0.5.1 engine's SVGs of the example catalogue at map date 2027-06-01 (metro-map "Map backdrop":
// Neutral is today's map, Neutral site map is today's map). Run once, from the 0.5.1 code, after npm run build:
// node test/fixtures/map-0.5.1/record.mjs .
// <view>-<theme>.svg is what `stackledger map --view <view> --theme <theme>` prints; <view>-<theme>-site.svg is
// the map the site embeds (no header and legend), taken from buildSiteData itself.
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(process.argv[2]);
const { loadFolder } = await import(join(root, 'dist/source.js'));
const { validateLoaded } = await import(join(root, 'dist/validate.js'));
const { applyView, resolveHidden } = await import(join(root, 'dist/views.js'));
const { buildMapModel } = await import(join(root, 'dist/map/model.js'));
const { layoutMap } = await import(join(root, 'dist/map/layout.js'));
const { renderSvg } = await import(join(root, 'dist/map/svg.js'));
const { themes, inkOf } = await import(join(root, 'dist/map/themes.js'));
const { buildSiteData } = await import(join(root, 'dist/site/data.js'));
const date = '2027-06-01';
const catalogue = validateLoaded(await loadFolder(join(root, 'examples/northwind')));
const out = join(root, 'test/fixtures/map-0.5.1');
for (const view of ['full', 'staff']) {
  const site = buildSiteData(catalogue, view, '0.5.1', date).data.map;
  for (const name of ['light', 'dark']) {
    const theme = themes[name];
    const served = applyView(catalogue.served, view, resolveHidden(catalogue));
    const svg = renderSvg(layoutMap(buildMapModel(served, date), theme.lineWidth, inkOf(theme)), theme);
    writeFileSync(join(out, `${view}-${name}.svg`), svg + '\n');
    writeFileSync(join(out, `${view}-${name}-site.svg`), site[name] + '\n');
  }
}
