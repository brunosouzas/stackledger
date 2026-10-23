/** The design system's pieces drawn through the map's own SVG writer (metro-map: Design system pieces).
 * Run npm test. Geometry comes from the real model and layout, as the other map tests.
 */
import { test, expect } from 'vitest';
import { stationMarker, type Drawn } from '@brunosouzas/design-system';
import { writePiece } from '../../src/map/pieces.js';
import { renderSvg } from '../../src/map/svg.js';
import { themes } from '../../src/map/themes.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap } from '../../src/map/layout.js';
import { renderNeighbourhood, neighbourhood } from '../../src/map/neighbourhood.js';
import { renderStrip, strip } from '../../src/map/strip.js';
import { buildGraph } from '../../src/graph.js';
import { component, journey, positions, set, viewOf } from './map-helpers.js';
import { safe } from './svg-helpers.js';

const docs = () => [component('a'), component('b'), journey('ship', ['a', 'b']), positions({ a: [0, 0], b: [4, 0] })];
const geometry = (documents: unknown[] = docs()) => layoutMap(buildMapModel(viewOf(documents, 'full'), '2027-06-01'));

test('Stop drawn by the piece', () => {
  const g = geometry();
  const a = g.stations.find(station => station.ref === 'component:a')!;
  const [cx, cy] = a.marker.ends[0];
  const expected = writePiece(stationMarker({ cx, cy, r: a.marker.radius, surface: 'light' }));
  const svg = renderSvg(g, themes.light);
  const group = svg.slice(svg.indexOf('<g data-ref="component:a"'));
  expect(group.slice(0, group.indexOf('</g>'))).toContain(expected);
});

test('Piece node outside the allow-list', () => {
  const hostile: Drawn = { body: [{ tag: 'circle', attrs: { cx: 0, cy: 0, r: 4, transform: 'scale(2)' }, children: [] }], text: [] };
  expect(() => writePiece(hostile)).toThrow(/attribute/);
  const script = { body: [{ tag: 'script', attrs: {}, children: ['alert(1)'] }], text: [] } as unknown as Drawn;
  expect(() => writePiece(script)).toThrow(/element/);
});

test('Piece text has no font of its own', () => {
  const graph = buildGraph(viewOf([set(component('forge'), 'spec.dependsOn', ['component:vault']), component('vault')], 'full'));
  const model = buildMapModel(viewOf([component('a'), component('b'), journey('ship', ['a', 'b'])], 'full'), '');
  for (const theme of Object.values(themes)) {
    const svgs = [renderSvg(geometry(), theme), renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), theme), renderStrip(strip(model, model.lines[0]!), theme)];
    for (const svg of svgs) {
      const doc = safe(svg);
      const withFont = Array.from(doc.getElementsByTagName('*')).filter(element => element.hasAttribute('font-family'));
      expect(withFont.map(element => element.tagName)).toEqual(['svg']);
      for (const element of Array.from(doc.getElementsByTagName('*'))) for (const attr of Array.from(element.attributes)) expect(attr.value, attr.name).not.toContain("'");
    }
  }
});

test('Far station drawn by the piece', () => {
  const g = geometry([component('a'), component('b'), journey('ship', ['a', 'b']), positions({ a: [0, 0], b: [100000, 100000] })]);
  for (const theme of Object.values(themes)) {
    const doc = safe(renderSvg(g, theme));
    const marker = (ref: string) => Array.from(Array.from(doc.getElementsByTagName('g')).find(group => group.getAttribute('data-ref') === ref)!.getElementsByTagName('circle')).at(-1)!;
    expect([marker('component:a').getAttribute('cx'), marker('component:a').getAttribute('cy')]).toEqual(['0', '0']);
    expect([marker('component:b').getAttribute('cx'), marker('component:b').getAttribute('cy')]).toEqual(['6400000', '6400000']);
    expect(doc.documentElement.textContent).toContain('Lines (journeys)');
  }
});
