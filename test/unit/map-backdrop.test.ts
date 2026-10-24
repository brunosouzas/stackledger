/** metro-map: Map backdrop, Backdrop layer, Backdrop scale, Backdrop data, Backdrop data generation and
 * Backdrop credit, on the fictitious example catalogue. "Neutral" compares with the SVGs recorded from 0.5.1
 * (docs/images/map-*.svg and test/fixtures/map-0.5.1, task 1.1). Run npm run build && npm test. */
import { describe, expect, it } from 'vitest';
import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFolder } from '../../src/source.js';
import { validateLoaded } from '../../src/validate.js';
import { applyView, resolveHidden, type ViewName } from '../../src/views.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap, type MapGeometry } from '../../src/map/layout.js';
import { backdropScale, renderSvg, type BackdropName } from '../../src/map/svg.js';
import { inkOf, themes } from '../../src/map/themes.js';
import { buildSiteData } from '../../src/site/data.js';
import { london } from '../../src/map/backdrops/london.js';
import { tokens } from '@brunosouzas/design-system/tokens';

const root = join(import.meta.dirname, '../..');
const fixtures = join(root, 'test/fixtures/map-0.5.1');
const date = '2027-06-01';
const catalogue = validateLoaded(await loadFolder(join(root, 'examples/northwind')));
const views: ViewName[] = ['full', 'staff'];
const names = ['light', 'dark'] as const;
const geometryOf = (view: ViewName, name: 'light' | 'dark'): MapGeometry =>
  layoutMap(buildMapModel(applyView(catalogue.served, view, resolveHidden(catalogue)), date), themes[name].lineWidth, inkOf(themes[name]));
const draw = (view: ViewName, name: 'light' | 'dark', backdrop?: BackdropName, chrome = true) =>
  renderSvg(geometryOf(view, name), themes[name], { chrome, ...(backdrop ? { backdrop } : {}) });
const parse = (svg: string) => new DOMParser({ onError: (level, message) => { throw new Error(`${level}: ${message}`); } }).parseFromString(svg, 'image/svg+xml');
const children = (node: XmlElement): XmlElement[] => Array.from(node.childNodes).filter((child): child is XmlElement => child.nodeType === 1);
const viewBoxOf = (svg: string) => { const [x, y, w, h] = svg.match(/viewBox="([^"]+)"/)![1]!.split(' ').map(Number) as [number, number, number, number]; return { x, y, w, h }; };
/** The layer groups of a map: every <g> child of the root, in order. */
const layers = (svg: string) => children(parse(svg).documentElement as unknown as XmlElement).filter(node => node.tagName === 'g');
const points = (d: string) => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match => [Number(match[1]), Number(match[2])] as const);
/** Twice the signed area of a flat ring, y up: positive when counter-clockwise. */
const area = (ring: readonly number[]) => { let sum = 0; for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length; sum += ring[i]! * ring[j + 1]! - ring[j]! * ring[i + 1]!; } return sum; };
const inside = (x: number, y: number, ring: readonly number[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const CREDIT = '© OpenStreetMap contributors';

describe('Map backdrop', () => {
  it('Neutral is today\'s map', () => {
    for (const name of names) {
      const committed = readFileSync(join(root, `docs/images/map-${name}.svg`), 'utf8');
      expect(draw('full', name) + '\n').toBe(committed);
      expect(draw('full', name, 'neutral') + '\n').toBe(committed);
      expect(draw('staff', name, 'neutral') + '\n').toBe(readFileSync(join(fixtures, `staff-${name}.svg`), 'utf8'));
    }
  });
  it('Neutral site map is today\'s map', () => {
    for (const view of views) {
      const map = buildSiteData(catalogue, view, '0.5.1', date).data.map;
      for (const name of names) expect(map[name] + '\n', `${view} ${name}`).toBe(readFileSync(join(fixtures, `${view}-${name}-site.svg`), 'utf8'));
    }
  });
  it('Backdrop moves nothing', () => {
    for (const view of views) for (const name of names) for (const chrome of [true, false]) {
      const neutral = draw(view, name, 'neutral', chrome).split('\n');
      const city = draw(view, name, 'london', chrome).split('\n');
      // Line 0 is the root and head, line 1 the background, line 2 the backdrop group; the last line the credit.
      expect(city).toHaveLength(neutral.length + 2);
      expect(city[2]).toMatch(/^<g><path /);
      expect(city.at(-1)).toContain(CREDIT);
      expect([...city.slice(0, 2), ...city.slice(3, -1)].join('\n') + '</svg>').toBe(neutral.join('\n'));
    }
  });
  it('Skills map stays flat', () => {
    // A skills map asked for a city still draws none (the site never asks: src/site/skills-data.ts).
    const geometry: MapGeometry = { ...geometryOf('full', 'light'), kind: 'skills' };
    const svg = renderSvg(geometry, themes.light, { backdrop: 'london' });
    expect(svg).toBe(renderSvg(geometry, themes.light));
    expect(svg).not.toContain('OpenStreetMap');
    expect(readFileSync(join(root, 'src/site/skills-data.ts'), 'utf8')).not.toContain('backdrop');
  });
});

describe('Backdrop layer', () => {
  it('London layer order', () => {
    for (const name of names) for (const chrome of [true, false]) {
      const [background, backdrop, grid] = layers(draw('full', name, 'london', chrome));
      expect(children(background!).map(node => node.tagName)).toEqual(['rect']);
      const paths = children(backdrop!);
      expect(paths.map(node => node.tagName)).toEqual(['path', 'path']);
      expect(paths[0]!.getAttribute('stroke')).toBe(themes[name].backdrop.waterEdge);
      expect(paths[1]!.hasAttribute('stroke')).toBe(false);
      expect(children(grid!)[0]!.getAttribute('fill')).toBe('none');
    }
  });
  it('London colours are the tokens', () => {
    const dark = tokens.surface.dark;
    for (const chrome of [true, false]) {
      const [water, park] = children(layers(draw('full', 'dark', 'london', chrome))[1]!);
      expect(water!.getAttribute('fill')).toBe(dark.backdropWater);
      expect(water!.getAttribute('stroke')).toBe(dark.backdropWaterEdge);
      expect(park!.getAttribute('fill')).toBe(dark.backdropPark);
    }
    // The light surface takes its own tokens too.
    const [water, park] = children(layers(draw('full', 'light', 'london'))[1]!);
    expect([water!.getAttribute('fill'), water!.getAttribute('stroke'), park!.getAttribute('fill')])
      .toEqual([tokens.surface.light.backdropWater, tokens.surface.light.backdropWaterEdge, tokens.surface.light.backdropPark]);
  });
  it('Holes without fill-rule', () => {
    for (const name of names) expect(draw('full', name, 'london')).not.toContain('fill-rule');
    for (const rings of [london.water, london.park]) {
      const outers = rings.filter(ring => area(ring) > 0);
      const holes = rings.filter(ring => area(ring) < 0);
      expect(outers.length).toBeGreaterThan(0);
      // Every clockwise ring sits inside a counter-clockwise one: it is a hole wound opposite to its outer ring.
      for (const hole of holes) expect(outers.some(outer => inside(hole[0]!, hole[1]!, outer))).toBe(true);
    }
    // The 2026-10-24 extract keeps no hole after the 2-ha sliver filter; the check above guards a refresh that does.
  });
});

describe('Backdrop scale', () => {
  it('Backdrop covers the map', () => {
    for (const chrome of [true, false]) {
      const svg = draw('full', 'light', 'london', chrome);
      const viewBox = viewBoxOf(svg);
      const all = children(layers(svg)[1]!).flatMap(path => points(path.getAttribute('d')!));
      for (const d of children(layers(svg)[1]!).map(path => path.getAttribute('d')!)) expect(d).not.toMatch(/\d\.\d\d/);
      const [minX, maxX] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))];
      const [minY, maxY] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
      expect(minX).toBeLessThanOrEqual(viewBox.x); expect(minY).toBeLessThanOrEqual(viewBox.y);
      expect(maxX).toBeGreaterThanOrEqual(viewBox.x + viewBox.w); expect(maxY).toBeGreaterThanOrEqual(viewBox.y + viewBox.h);
      const s = Math.max(viewBox.w / london.box.w, viewBox.h / london.box.h);
      expect(backdropScale(london, viewBox).s).toBe(s);
      const [cx, cy] = [viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2];
      expect(Math.abs(minX - (cx - london.box.w * s / 2))).toBeLessThanOrEqual(0.1);
      expect(Math.abs(maxX - (cx + london.box.w * s / 2))).toBeLessThanOrEqual(0.1);
      expect(Math.abs(minY - (cy - london.box.h * s / 2))).toBeLessThanOrEqual(0.1);
      expect(Math.abs(maxY - (cy + london.box.h * s / 2))).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('Backdrop data', () => {
  it('Data size', () => {
    expect(statSync(join(root, 'dist/map/backdrops/london.js')).size).toBeLessThan(16 * 1024);
  });
  it('Data provenance', () => {
    const extract = JSON.parse(readFileSync(join(root, 'scripts/backdrops/london-extract.json'), 'utf8')) as { extractDate: string };
    for (const file of ['src/map/backdrops/london.ts', 'dist/map/backdrops/london.js']) {
      const header = readFileSync(join(root, file), 'utf8').split('\n').filter(line => line.startsWith('//')).join('\n');
      expect(header, file).toContain('OpenStreetMap');
      expect(header, file).toContain('Open Database License');
      expect(header, file).toContain(`extract date ${extract.extractDate}`);
    }
    expect(london.extractDate).toBe(extract.extractDate);
  });
  // Runs the pinned mapshaper from the npm cache (npx --offline; provision it once with
  // `npx --yes mapshaper@0.7.98 -v`), so only on request:
  // STACKLEDGER_BACKDROP_BUILD=1 npx vitest run test/unit/map-backdrop.test.ts
  it.runIf(process.env.STACKLEDGER_BACKDROP_BUILD === '1')('Reproducible data', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'stackledger-backdrop-test-')), 'london.ts');
    const result = spawnSync(process.execPath, [join(root, 'scripts/backdrops/build.mjs'), out], { encoding: 'utf8', timeout: 240_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(readFileSync(join(root, 'src/map/backdrops/london.ts'), 'utf8'));
  }, 300_000);
});

describe('Backdrop credit', () => {
  it('Credit on London', () => {
    for (const view of views) for (const name of names) for (const chrome of [true, false]) {
      const geometry = geometryOf(view, name);
      const svg = renderSvg(geometry, themes[name], { chrome, backdrop: 'london' });
      expect(svg).toMatch(new RegExp(`<g><text [^>]*>${CREDIT}</text></g></svg>$`));
      const text = children(layers(svg).at(-1)!)[0]!;
      expect(text.getAttribute('text-anchor')).toBe('end');
      const viewBox = viewBoxOf(svg);
      const [x, y, size] = ['x', 'y', 'font-size'].map(key => Number(text.getAttribute(key)));
      // A generous text box: 0.6 em per character, from the baseline up one em and down a quarter.
      const box = { x: x! - CREDIT.length * size! * 0.6, y: y! - size!, w: CREDIT.length * size! * 0.6, h: size! * 1.25 };
      expect(box.x).toBeGreaterThanOrEqual(viewBox.x); expect(box.y).toBeGreaterThanOrEqual(viewBox.y);
      expect(box.x + box.w).toBeLessThanOrEqual(viewBox.x + viewBox.w); expect(box.y + box.h).toBeLessThanOrEqual(viewBox.y + viewBox.h);
      if (chrome) {
        const legend = geometry.legend.box;
        const overlaps = box.x < legend.x + legend.w && legend.x < box.x + box.w && box.y < legend.y + legend.h && legend.y < box.y + box.h;
        expect(overlaps, `${view} ${name}`).toBe(false);
      }
    }
  });
  it('Credit colour is the token', () => {
    for (const name of names) for (const chrome of [true, false]) {
      const text = children(layers(draw('full', name, 'london', chrome)).at(-1)!)[0]!;
      expect(text.getAttribute('fill'), `${name}`).toBe(tokens.surface[name].backdropCredit);
    }
  });
  it('Site credit flag', () => {
    // The map page of each view shows its credit line only over a city (catalogue-site, Map backdrop).
    const settings = { apiVersion: 'stackledger/v1alpha1', kind: 'Settings', metadata: { name: 'settings' }, spec: { map: { backdrop: 'london' } } };
    const city = { ...catalogue, served: { ...catalogue.served, settings: [settings, ...catalogue.served.settings] } } as typeof catalogue;
    for (const view of views) {
      expect(buildSiteData(catalogue, view, '0.5.1', date).data.map.credit, view).toBe(false);
      const map = buildSiteData(city, view, '0.5.1', date).data.map;
      expect(map.credit, view).toBe(true);
      expect(map.light).toContain(CREDIT);
    }
  });
  it('No credit on neutral', () => {
    for (const view of views) for (const name of names) for (const chrome of [true, false]) {
      expect(draw(view, name, 'neutral', chrome)).not.toContain('OpenStreetMap');
      expect(draw(view, name, undefined, chrome)).not.toContain('OpenStreetMap');
    }
  });
});
