// Maintainer only, by hand, with network (metro-map: Backdrop data generation). Not published, never run by
// stackledger or its tests. Downloads the OpenStreetMap water and parks of central London through the Overpass
// API (london.overpassql, bbox 51.455,-0.26 to 51.56,0.06), keeps the polygons, tags each kind = water | park,
// projects them to a transverse Mercator in metres centred on 51.5/-0.1, drops water under 1.5 ha and parks
// under 8 ha, dissolves per kind and writes london-extract.json beside this script, with the Overpass
// timestamp as its extract date. Then run build.mjs (offline) to regenerate src/map/backdrops/london.ts.
// Usage: node scripts/backdrops/refresh.mjs
// Data © OpenStreetMap contributors, under the Open Database License (ODbL).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OSMTOGEOJSON = 'osmtogeojson@3.0.0-beta.5';
const MAPSHAPER = 'mapshaper@0.7.98';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'stackledger-backdrop-'));
try {
  const query = readFileSync(join(here, 'london.overpassql'), 'utf8');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': 'stackledger-backdrop-refresh (https://github.com/brunosouzas/stackledger)', Accept: 'application/json' },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Overpass API: HTTP ${response.status}`);
  const raw = await response.text();
  const timestamp = JSON.parse(raw).osm3s.timestamp_osm_base;
  writeFileSync(join(work, 'raw.json'), raw);
  const geojson = JSON.parse(execFileSync('npx', ['--yes', OSMTOGEOJSON, join(work, 'raw.json')], { maxBuffer: 1 << 30, encoding: 'utf8' }));
  const features = geojson.features.filter(feature => /Polygon$/.test(feature.geometry?.type ?? '')).map(feature => {
    const tags = feature.properties.tags ?? feature.properties;
    const kind = tags.natural === 'water' || tags.waterway === 'riverbank' ? 'water' : 'park';
    return { type: 'Feature', properties: { kind }, geometry: feature.geometry };
  });
  writeFileSync(join(work, 'kind.json'), JSON.stringify({ type: 'FeatureCollection', features }));
  execFileSync('npx', ['--yes', MAPSHAPER, join(work, 'kind.json'),
    '-proj', '+proj=tmerc +lat_0=51.5 +lon_0=-0.1 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs',
    '-filter', "this.area >= (kind === 'water' ? 15000 : 80000)",
    '-dissolve', 'kind',
    '-sort', "kind === 'water' ? 0 : 1",
    '-o', join(work, 'extract.json'), 'format=geojson', 'precision=1'], { stdio: 'inherit' });
  const extract = JSON.parse(readFileSync(join(work, 'extract.json'), 'utf8'));
  const out = {
    type: 'FeatureCollection',
    source: 'OpenStreetMap contributors, via the Overpass API (london.overpassql)',
    license: 'Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/',
    extractDate: timestamp,
    projection: 'transverse Mercator centred on 51.5 N, 0.1 W, metres',
    features: extract.features.map(feature => ({ type: 'Feature', properties: { kind: feature.properties.kind }, geometry: feature.geometry })),
  };
  writeFileSync(join(here, 'london-extract.json'), JSON.stringify(out) + '\n');
  console.log(`london-extract.json: ${out.features.length} kinds, extract date ${timestamp}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
