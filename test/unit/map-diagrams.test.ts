/** Neighbourhood and strip diagrams: catalogue-site scenarios (SVG part) and the safe-SVG rules.
 * Run npm test. Inputs go through the real validator, view, graph and map model.
 */
import { test, expect } from 'vitest';
import { buildGraph } from '../../src/graph.js';
import { buildMapModel } from '../../src/map/model.js';
import { neighbourhood, renderNeighbourhood } from '../../src/map/neighbourhood.js';
import { renderLineBadge, renderStrip, strip } from '../../src/map/strip.js';
import { themes } from '../../src/map/themes.js';
import { component, journey, set, viewOf } from './map-helpers.js';
import { safe } from './svg-helpers.js';

const depends = (name: string, refs: string[]) => set(component(name), 'spec.dependsOn', refs);
const resource = (name: string, type: string) => ({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name }, spec: { type, owner: 'user:alex' } });
const graphOf = (documents: unknown[]) => buildGraph(viewOf(documents, 'full'));
const groups = (svg: string) => Array.from(safe(svg).getElementsByTagName('g'));
// The box face is the last outlined rect; its shadow copy comes first and sits right and below.
const face = (group: Element) => Array.from(group.getElementsByTagName('rect')).filter(rect => rect.getAttribute('stroke') !== null).at(-1)!;
const boxX = (group: Element) => Number(face(group).getAttribute('x'));

test('Dependencies and dependants', () => {
  const graph = graphOf([depends('forge', ['component:vault']), component('vault'), depends('editor', ['component:forge'])]);
  const input = neighbourhood(graph, graph.items.get('component:forge')!);
  expect(input.dependencies.map(node => node.ref)).toEqual(['component:vault']);
  expect(input.dependants.map(node => node.ref)).toEqual(['component:editor']);
  for (const theme of Object.values(themes)) {
    const all = groups(renderNeighbourhood(input, theme));
    const box = (ref: string) => all.find(group => group.getAttribute('data-ref') === ref)!;
    expect(boxX(box('component:vault'))).toBeLessThan(boxX(box('component:forge')));
    expect(boxX(box('component:editor'))).toBeGreaterThan(boxX(box('component:forge')));
  }
});

test('Resource without a page', () => {
  const graph = graphOf([depends('forge', ['resource:orders-db']), resource('orders-db', 'database')]);
  const input = neighbourhood(graph, graph.items.get('component:forge')!);
  expect(input.dependencies).toEqual([{ ref: 'resource:orders-db', title: 'orders-db', kind: 'resource', linked: false }]);
  const svg = renderNeighbourhood(input, themes.light);
  const doc = safe(svg);
  expect(doc.documentElement.textContent).toContain('orders-db');
  // A box without a page carries no data-ref, so the page script never turns it into a link.
  expect(groups(svg).map(group => group.getAttribute('data-ref')).filter(Boolean)).toEqual(['component:forge']);
});

test('Neighbourhood without relations says so', () => {
  const graph = graphOf([component('alone')]);
  const doc = safe(renderNeighbourhood(neighbourhood(graph, graph.items.get('component:alone')!), themes.dark));
  expect(doc.documentElement.textContent).toContain('Nothing');
});

test('Interchange on a strip', () => {
  const view = viewOf([component('linear'), component('slack'), component('figma'),
    journey('ship', ['linear', 'slack'], '1'), journey('design', ['figma', 'slack'], '2')], 'staff');
  const model = buildMapModel(view, '');
  const input = strip(model, model.lines.find(line => line.name === 'ship')!);
  expect(input.stops.map(stop => stop.ref)).toEqual(['component:linear', 'component:slack']);
  expect(input.stops[1]!.interchanges.map(line => line.ref)).toEqual(['line:design']);
  for (const theme of Object.values(themes)) {
    const all = groups(renderStrip(input, theme));
    const stop = all.find(group => group.getAttribute('data-ref') === 'component:slack')!;
    expect(stop.getAttribute('data-line')).toBe('line:ship line:design');
    const badge = all.find(group => group.getAttribute('data-ref') === 'line:design')!;
    expect(badge.textContent).toContain('2');
    expect(all.find(group => group.getAttribute('data-ref') === 'component:linear')!.textContent).not.toContain('2');
  }
});

const hostile = '<script>&"\' ]]> javascript: \u0001 \uFFFE';

test('Diagrams are safe SVG with hostile titles', () => {
  const graph = graphOf([set(depends('forge', ['component:vault']), 'metadata.title', hostile), set(component('vault'), 'metadata.title', hostile)]);
  const view = viewOf([set(component('a'), 'metadata.title', hostile), component('b'), set(journey('ship', ['a', 'b']), 'metadata.title', hostile), set(journey('other', ['b', 'a']), 'metadata.title', hostile)]);
  const model = buildMapModel(view, '2027-06-01');
  const clean = hostile.replace(/[\u0001\uFFFE]/g, '\uFFFD');
  for (const theme of Object.values(themes)) {
    const svgs = [renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), theme), renderStrip(strip(model, model.lines[0]!), theme), renderLineBadge(model.lines[0]!)];
    for (const svg of svgs) {
      const doc = safe(svg);
      expect(doc.getElementsByTagName('script')).toHaveLength(0);
      expect(doc.documentElement.textContent).toContain(clean);
      for (const element of Array.from(doc.getElementsByTagName('*'))) {
        for (const attr of Array.from(element.attributes)) {
          if (!['data-ref', 'data-line', 'data-zone'].includes(attr.name)) expect(attr.value, attr.name).not.toMatch(/[<>&"']|script/i);
        }
      }
    }
  }
});

test('Diagrams are deterministic and reject unsafe colours', () => {
  const view = viewOf([component('a'), component('b'), journey('ship', ['a', 'b'])]);
  const model = buildMapModel(view, '2027-06-01');
  const input = strip(model, model.lines[0]!);
  expect(renderStrip(input, themes.light)).toBe(renderStrip(structuredClone(input), themes.light));
  expect(() => renderStrip({ ...input, color: 'url(javascript:alert(1))' }, themes.light)).toThrow(/colour/);
  expect(() => renderLineBadge({ badge: 'S', color: 'red', title: 'Ship' })).toThrow(/colour/);
});

/** Box rectangles of a rendered neighbourhood by reference (the first rect of each data-ref group). */
function boxes(svg: string): Map<string, { x: number; y: number; width: number }> {
  return new Map(groups(svg).filter(group => group.getAttribute('data-ref')).map(group => {
    const rect = face(group);
    return [group.getAttribute('data-ref')!, { x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')), width: Number(rect.getAttribute('width')) }];
  }));
}

test('Neighbourhood boxes fit their titles and fill the width', () => {
  const long = set(component('crm'), 'metadata.title', 'Customer Portal Manager');
  const graph = graphOf([depends('forge', ['component:crm', 'component:vault']), long, component('vault'), depends('editor', ['component:forge'])]);
  const svg = renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), themes.light);
  const all = boxes(svg);
  const width = Number(safe(svg).documentElement.getAttribute('width'));
  expect(width).toBe(1200);
  // One width per column, from its longest title; the short centre title gets the minimum.
  expect(all.get('component:crm')!.width).toBeGreaterThan(all.get('component:forge')!.width);
  expect(all.get('component:vault')!.width).toBe(all.get('component:crm')!.width);
  expect(all.get('component:forge')!.width).toBe(160);
  expect(svg).toContain('>Customer Portal Manager<');
  // Columns at the left edge, in the middle and at the right edge.
  expect(all.get('component:crm')!.x).toBe(24);
  expect(all.get('component:forge')!.x + all.get('component:forge')!.width / 2).toBeCloseTo(width / 2, 0);
  expect(all.get('component:editor')!.x + all.get('component:editor')!.width).toBe(width - 24);
});

test('Neighbourhood centres the item and short columns vertically', () => {
  const graph = graphOf([depends('forge', ['component:a', 'component:b', 'component:c']), component('a'), component('b'), component('c'), depends('editor', ['component:forge'])]);
  const all = boxes(renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), themes.light));
  // The single dependant sits level with the centre box, which sits level with the middle dependency.
  expect(all.get('component:forge')!.y).toBe(all.get('component:b')!.y);
  expect(all.get('component:editor')!.y).toBe(all.get('component:forge')!.y);
});

test('Neighbourhood without relations keeps placeholders level with the item', () => {
  const graph = graphOf([component('alone')]);
  const svg = renderNeighbourhood(neighbourhood(graph, graph.items.get('component:alone')!), themes.light);
  const doc = safe(svg);
  const placeholders = Array.from(doc.getElementsByTagName('rect')).filter(rect => rect.getAttribute('fill') === 'none');
  expect(placeholders).toHaveLength(2);
  const centre = boxes(svg).get('component:alone')!;
  for (const rect of placeholders) expect(Number(rect.getAttribute('y'))).toBe(centre.y);
  expect(Array.from(doc.getElementsByTagName('text')).filter(text => text.textContent === 'Nothing')).toHaveLength(2);
});

test('A strip stop is clickable between its marker and its label', () => {
  const view = viewOf([component('linear'), component('slack'), journey('ship', ['linear', 'slack'], '1')], 'staff');
  const model = buildMapModel(view, '');
  const svg = renderStrip(strip(model, model.lines[0]!), themes.light);
  const stop = groups(svg).find(group => group.getAttribute('data-ref') === 'component:linear')!;
  const hit = stop.getElementsByTagName('rect')[0]!;
  const circle = stop.getElementsByTagName('circle')[0]!;
  const label = stop.getElementsByTagName('text')[0]!;
  expect(hit.getAttribute('fill-opacity')).toBe('0');
  const top = Number(hit.getAttribute('y'));
  const bottom = top + Number(hit.getAttribute('height'));
  expect(top).toBeLessThan(Number(circle.getAttribute('cy')) - Number(circle.getAttribute('r')));
  expect(bottom).toBeGreaterThan(Number(label.getAttribute('y')));
});

const INK = '#0A1033';
const shapesOf = (group: Element) => Array.from(group.childNodes).filter((node: any) => node.nodeType === 1 && node.tagName !== 'title') as Element[];
const interchangeView = () => viewOf([component('linear'), component('slack'), component('figma'),
  journey('ship', ['linear', 'slack'], '1'), journey('design', ['figma', 'slack'], '2')], 'staff');

test('Neighbourhood boxes', () => {
  const graph = graphOf([depends('forge', ['component:vault']), component('vault'), depends('editor', ['component:forge'])]);
  const svg = renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), themes.light);
  expect(svg).not.toMatch(/transform|filter/);
  const linked = groups(svg).filter(item => item.getAttribute('data-ref'));
  expect(linked).toHaveLength(3);
  for (const group of linked) {
    const rects = shapesOf(group).filter(item => item.tagName === 'rect');
    const [shadow, face] = [rects[0]!, rects.at(-1)!];
    expect(rects).toHaveLength(2);
    expect(face.getAttribute('stroke')).toBe(INK);
    expect(shadow.getAttribute('fill')).toBe(INK);
    expect(Number(shadow.getAttribute('x'))).toBeGreaterThan(Number(face.getAttribute('x')));
    expect(Number(shadow.getAttribute('y'))).toBeGreaterThan(Number(face.getAttribute('y')));
  }
  expect(safe(svg).documentElement.getAttribute('font-family')!.startsWith('Lato')).toBe(true);
});

test('Strip line and stops', () => {
  const model = buildMapModel(interchangeView(), '');
  const input = { ...strip(model, model.lines.find(line => line.name === 'ship')!), color: '#FF0000' };
  const svg = renderStrip(input, themes.dark);
  expect(svg).not.toMatch(/transform|filter/);
  const all = groups(svg);
  const pipe = shapesOf(all.find(group => group.getAttribute('data-line') === input.ref && !group.getAttribute('data-ref'))!).filter(item => item.tagName === 'line');
  expect(pipe.map(item => item.getAttribute('stroke'))).toEqual([INK, '#FF0000']);
  expect(Number(pipe[0]!.getAttribute('stroke-width'))).toBeGreaterThan(Number(pipe[1]!.getAttribute('stroke-width')));
  for (const ref of ['component:linear', 'component:slack']) {
    const circles = shapesOf(all.find(group => group.getAttribute('data-ref') === ref)!).filter(item => item.tagName === 'circle');
    expect(circles[0]!.getAttribute('fill')).toBe('#4C5CB8');
    expect(circles.at(-1)!.getAttribute('stroke')).toBe(ref === 'component:slack' ? INK : '#FF0000');
  }
});

test('Resource without a shadow', () => {
  const graph = graphOf([depends('forge', ['resource:orders-db']), resource('orders-db', 'database')]);
  for (const theme of Object.values(themes)) {
    const doc = safe(renderNeighbourhood(neighbourhood(graph, graph.items.get('component:forge')!), theme));
    const group = Array.from(doc.getElementsByTagName('g')).find(item => item.textContent!.includes('orders-db') && !item.getAttribute('data-ref'))!;
    const rects = shapesOf(group).filter(item => item.tagName === 'rect');
    expect(rects).toHaveLength(1);
    expect(rects[0]!.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(rects[0]!.getAttribute('fill')).not.toBe(theme.shadow.color);
  }
});

test('Strip labels clear the stop markers, shadows and badges', () => {
  const model = buildMapModel(interchangeView(), '');
  for (const theme of Object.values(themes)) {
    const all = groups(renderStrip(strip(model, model.lines[0]!), theme));
    const stop = all.find(group => group.getAttribute('data-ref') === 'component:slack')!;
    const lowest = Math.max(...shapesOf(stop).filter(item => item.tagName === 'circle')
      .map(item => Number(item.getAttribute('cy')) + Number(item.getAttribute('r')) + Number(item.getAttribute('stroke-width') ?? 0) / 2));
    const label = stop.getElementsByTagName('text')[0]!;
    // The label's cap height is about 10 units above its baseline; descenders reach about 4 below.
    expect(Number(label.getAttribute('y')) - 10).toBeGreaterThan(lowest);
    const badge = all.find(group => group.getAttribute('data-ref') === 'line:design')!;
    const top = Math.min(...shapesOf(badge).filter(item => item.tagName === 'rect').map(item => Number(item.getAttribute('y'))));
    expect(top).toBeGreaterThan(Number(label.getAttribute('y')) + 4);
  }
});
