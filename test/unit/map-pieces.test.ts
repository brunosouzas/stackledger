/** The design system's pieces drawn through the map's own SVG writer (metro-map: Design system pieces).
 * Run npm test. Geometry comes from the real model and layout, as the other map tests.
 */
import { test, expect } from 'vitest';
import { licenceMark, renewalRing, stationMarker, suggestedHalo, zone as zonePiece, type Drawn } from '@brunosouzas/design-system';
import { writePiece } from '../../src/map/pieces.js';
import { renderSvg, renderSymbol } from '../../src/map/svg.js';
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
  const model = buildMapModel(viewOf([component('a'), component('b'), journey('ship', ['a', 'b'])], 'staff'), '');
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

// AB#169: licence markers, renewal rings, suggested halos and zones drawn by the 0.3.x pieces
// (metro-map: Map symbols drawn by the pieces, Licence markers, Renewal ring, Zones, Blank zone title, Piece limits).
const groupText = (svg: string, ref: string): string => {
  const group = svg.slice(svg.indexOf(`<g data-ref="${ref}"`));
  return group.slice(0, group.indexOf('</g>'));
};
const licensed = (status: string, renewsOn = '2027-06-15') => [
  set(component('editor'), 'spec.dependsOn', ['resource:licence-editor']), component('b'), journey('ship', ['editor', 'b']), positions({ editor: [0, 0], b: [4, 0] }),
  { apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'licence-editor' }, spec: { type: 'licence', owner: 'user:alex', licence: { vendor: 'Northwind Studio', status, cycle: 'monthly', cost: 10, currency: 'GBP', renewsOn } } },
];
const surfaceOf = (name: 'light' | 'dark') => name;

test('Held licence is green', () => {
  const g = geometry(licensed('active', '2028-01-01'));
  const station = g.stations.find(item => item.ref === 'component:editor')!;
  const [cx, cy] = station.licencePoint!;
  for (const name of ['light', 'dark'] as const) {
    const svg = renderSvg(g, themes[name]);
    expect(groupText(svg, 'component:editor')).toContain(writePiece(licenceMark({ cx, cy, state: 'owned', surface: surfaceOf(name) })));
    expect(groupText(svg, 'component:editor')).toContain(`r="5" fill="#3DDC84" stroke="#0A1033"`);
  }
});

test('Licence to buy is white', () => {
  const g = geometry(licensed('to-buy', '2028-01-01'));
  const station = g.stations.find(item => item.ref === 'component:editor')!;
  const [cx, cy] = station.licencePoint!;
  for (const name of ['light', 'dark'] as const) {
    const svg = renderSvg(g, themes[name]);
    expect(groupText(svg, 'component:editor')).toContain(writePiece(licenceMark({ cx, cy, state: 'toBuy', surface: name })));
    expect(groupText(svg, 'component:editor')).toContain(`r="5" fill="#FFFFFF" stroke="#0A1033"`);
  }
});

test('Ring drawn by the piece', () => {
  const g = geometry(licensed('active', '2027-06-15'));
  const station = g.stations.find(item => item.ref === 'component:editor')!;
  expect(station.renewal).toBe(true);
  const { box, halo } = station.marker;
  for (const name of ['light', 'dark'] as const) {
    const ring = writePiece(renewalRing({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, r: halo, surface: name }));
    expect(groupText(renderSvg(g, themes[name]), 'component:editor')).toContain(ring);
  }
});

test('Halo drawn by the piece', () => {
  const g = geometry([component('a'), component('b'), journey('ship', ['a', 'b']), positions({ b: [4, 0] })]);
  const station = g.stations.find(item => item.ref === 'component:a')!;
  expect(station.suggested).toBe(true);
  const { box, halo } = station.marker;
  for (const name of ['light', 'dark'] as const) {
    const expected = writePiece(suggestedHalo({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, r: halo + 3, surface: name }));
    expect(groupText(renderSvg(g, themes[name]), 'component:a')).toContain(expected);
  }
});

const zoned = (title: string, members: string[] = ['a', 'b']) => [
  ...['a', 'b'].map(name => members.includes(name) ? set(component(name), 'metadata.labels', { 'stackledger/zone': 'finance' }) : component(name)),
  journey('ship', ['a', 'b']), set(positions({ a: [0, 0], b: [4, 0] }), 'spec.zones', [{ name: 'finance', title, color: '#9B0056' }]),
];

test('Zone drawn by the piece', () => {
  const g = geometry(zoned('Finance'));
  const zone = g.zones[0]!;
  for (const name of ['light', 'dark'] as const) {
    const expected = writePiece(zonePiece({ points: zone.hull, fill: zone.color, title: zone.title, titleAt: [zone.titleBox.x, zone.titleBox.y], surface: name }));
    expect(renderSvg(g, themes[name])).toContain(expected);
  }
});

test('Blank zone title', () => {
  const g = geometry(zoned(' '));
  const zone = g.zones[0]!;
  for (const name of ['light', 'dark'] as const) {
    const svg = renderSvg(g, themes[name]);
    expect(svg).toContain(writePiece(zonePiece({ points: zone.hull, fill: zone.color, surface: name })));
    expect(Array.from(safe(svg).getElementsByTagName('text')).filter(text => text.textContent === ' ')).toHaveLength(0);
  }
});

test('One-station zone', () => {
  const g = geometry(zoned('Finance', ['a']));
  const svg = renderSvg(g, themes.light);
  expect(g.zones[0]!.hull).toHaveLength(1);
  const [x, y] = g.zones[0]!.hull[0]!;
  expect(svg).toContain(`<circle cx="${x}" cy="${y}" r="32" fill="#9B0056"/>`);
});

test('Legend symbols drawn by the pieces', () => {
  const centre = 24 / 2 - 1.5;
  for (const name of ['light', 'dark'] as const) {
    const inner = (symbol: string) => renderSymbol(symbol, themes[name]).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    expect(inner('licence')).toBe(writePiece(licenceMark({ cx: centre, cy: centre, state: 'owned', surface: name })));
    expect(inner('licence to buy')).toBe(writePiece(licenceMark({ cx: centre, cy: centre, state: 'toBuy', surface: name })));
    expect(inner('suggested position')).toBe(writePiece(suggestedHalo({ cx: centre, cy: centre, r: 9, surface: name })));
    expect(inner('renewal within 30 days')).toBe(writePiece(renewalRing({ cx: centre, cy: centre, r: 6.5, surface: name })));
  }
});

test('Far symbols drawn by the pieces', () => {
  const docs = licensed('active', '2027-06-15').map(doc => doc);
  docs[0] = set(docs[0], 'metadata.labels', { 'stackledger/zone': 'finance' });
  docs[3] = set(positions({ b: [100000, 100000] }), 'spec.zones', [{ name: 'finance', title: 'Finance', color: '#9B0056' }]);
  // editor has no stored position next to a far neighbour: it is suggested near (6400000, 6400000).
  const g = geometry(docs);
  const editor = g.stations.find(item => item.ref === 'component:editor')!;
  expect(editor.suggested).toBe(true);expect(editor.renewal).toBe(true);
  expect(editor.point[0]).toBeGreaterThan(6000000);
  for (const theme of Object.values(themes)) {
    const doc = safe(renderSvg(g, theme));
    expect(doc.getElementsByTagName('polygon').length + doc.getElementsByTagName('line').length + doc.getElementsByTagName('circle').length).toBeGreaterThan(0);
    const group = groupText(renderSvg(g, theme), 'component:editor');
    expect(group).toContain('stroke-dasharray="4 3"');expect(group).toContain('#3DDC84');expect(group).toContain('stroke="#FF8A3D"');
  }
});

test("Ring beyond the piece's limit", () => {
  const g = geometry(licensed('active', '2027-06-15'));
  g.stations.find(item => item.ref === 'component:editor')!.marker.halo = 10010.75;
  for (const theme of Object.values(themes)) expect(() => renderSvg(g, theme)).toThrow(/renewalRing/);
});

test("Ring at the piece's limit", () => {
  const g = geometry(licensed('active', '2027-06-15'));
  g.stations.find(item => item.ref === 'component:editor')!.marker.halo = 10000;
  for (const theme of Object.values(themes)) expect(renderSvg(g, theme)).toContain('r="10000" fill="none" stroke="#FF8A3D"');
});
