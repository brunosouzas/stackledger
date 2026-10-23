/** The skills metro map (metro-map spec: Station references, Skills map input, Skills map drawing,
 * Skills map zones, Playbook zone titles). Run npm test. Sets are fictitious Northwind skills, built
 * in memory or in temporary folders.
 */
import { test, expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import { buildSkillsMapModel } from '../../src/skills/metro.js';
import { readSkillSet } from '../../src/skills/source.js';
import { buildMapModel } from '../../src/map/model.js';
import { layoutMap } from '../../src/map/layout.js';
import { renderSvg } from '../../src/map/svg.js';
import { overlapArea, overlapScore, segmentObstacle } from '../../src/map/labels.js';
import { themes, inkOf, inkBox } from '../../src/map/themes.js';
import type { Line, MapLayout } from '../../src/schema.js';
import { component, journey, positions, set as setField, viewOf } from './map-helpers.js';
import { safe } from './svg-helpers.js';
import { playbook, rules, skill, skillSet } from '../skills-helpers.js';

type Kind = 'skill' | 'playbook';
interface Fixture { rules?: Record<string, number>; skills?: [string, Kind, string[]?][]; agents?: string[]; lines?: [string, string[], string?][]; stations?: Record<string, [number, number]>; zones?: string[] }
/** A skill set in memory: only what the map reads. */
function memorySet(fixture: Fixture) {
  const skills = (fixture.skills ?? []).map(([name, kind, loads]) => ({ name, kind, skills: loads ?? [], agents: [] as string[],
    path: '', description: '', given: '', files: [],
    rules: Array.from({ length: fixture.rules?.[name] ?? 0 }, (_, i) => ({ id: `R-${i + 1}`, text: 'Northwind rule.', line: i + 1 })) }));
  const agents = (fixture.agents ?? []).map(name => ({ name, path: '', description: '', given: '', files: [], preloads: [] }));
  const lines: Line[] = (fixture.lines ?? []).map(([name, stops, title], index) => ({ apiVersion: 'stackledger/v1alpha1', kind: 'Line',
    metadata: { name, ...(title === undefined ? {} : { title }) }, spec: { color: `#E4002${index}`, stops } }));
  const layout: MapLayout | undefined = fixture.stations ? { apiVersion: 'stackledger/v1alpha1', kind: 'MapLayout', metadata: { name: 'skills' },
    spec: { stations: fixture.stations, ...(fixture.zones ? { zones: fixture.zones.map(name => ({ name, title: `${name} zone`, color: '#F5A623' })) } : {}) } } : undefined;
  return { skills, agents, map: { lines, ...(layout ? { layout } : {}) } };
}
const draw = (fixture: Fixture, theme = themes.light) => {
  const geometry = layoutMap(buildSkillsMapModel(memorySet(fixture)), theme.lineWidth, inkOf(theme));
  return { geometry, svg: renderSvg(geometry, theme) };
};
const refs = (svg: string) => [...svg.matchAll(/<g data-ref="([^"]+)"/g)].map(match => match[1]);
const writerEditor: Fixture = { skills: [['writer', 'skill'], ['editor', 'skill']], lines: [['publish', ['skill:writer', 'skill:editor']]] };

test('Hostile skill names', () => {
  const name = 'a"><script>x</script>';
  const { svg } = draw({ skills: [[name, 'skill'], ['editor', 'skill']], lines: [['publish', [`skill:${name}`, 'skill:editor'], 'Pub\u0001lish']] });
  const doc = safe(svg);
  expect(doc.getElementsByTagName('script')).toHaveLength(0);
  expect(doc.documentElement!.textContent).toContain(name); expect(doc.documentElement!.textContent).toContain('Publish');
});
test('Software station', () => {
  const geometry = layoutMap(buildMapModel(viewOf([component('editor'), component('forge'), journey('ship', ['editor', 'forge'])], 'full'), '2027-06-01'));
  expect(renderSvg(geometry, themes.light)).toContain('data-ref="component:editor"');
});
test('Skills stations', () => {
  const { svg } = draw({ skills: [['publishing', 'playbook'], ['writer', 'skill']], agents: ['reviewer'],
    lines: [['publish', ['playbook:publishing', 'skill:writer', 'agent:reviewer']]] });
  expect(refs(svg)).toEqual(expect.arrayContaining(['playbook:publishing', 'skill:writer', 'agent:reviewer']));
});
test('Names that XML cannot hold', () => {
  const { svg } = draw({ skills: [['a\u0001b', 'skill'], ['a\uFFFDb', 'skill']], lines: [['publish', ['skill:a\u0001b', 'skill:a\uFFFDb']]] });
  const stations = refs(svg).filter(ref => ref.startsWith('skill:'));
  expect(stations).toHaveLength(2); expect(new Set(stations).size).toBe(2);
  for (const ref of stations) expect(ref).toMatch(/^skill:_[0-9a-f]+$/);
});
test('Stop not in the set', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'), 'broken/SKILL.md': '# no frontmatter\n',
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["skill:writer", "skill:broken", "skill:editor"]\n' });
  const model = buildSkillsMapModel(await readSkillSet([], { cwd: root }));
  expect(model.lines[0]!.stops).toEqual(['skill:writer', 'skill:editor']); expect(model.stations.map(s => s.ref)).not.toContain('skill:broken');
});
test('Relation error keeps the station', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor', { metadata: { 'stackledger-skills': 'ghost' } }),
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["skill:writer", "skill:editor"]\n' });
  const set = await readSkillSet([], { cwd: root });
  expect(set.problems.some(p => p.severity === 'error')).toBe(true);
  expect(buildSkillsMapModel(set).stations.map(s => s.ref)).toContain('skill:editor');
});
test('No skill lines', () => {
  const { svg } = draw({ skills: [['writer', 'skill']] });
  expect(safe(svg).documentElement!.textContent).toContain('No skill lines yet');
});
test('Legend of a skills map', () => {
  const { geometry, svg } = draw({ ...writerEditor, skills: [['writer', 'skill'], ['editor', 'skill'], ['linter', 'skill']],
    lines: [['publish', ['skill:writer', 'skill:editor']], ['review', ['skill:linter', 'skill:editor']]] });
  expect(geometry.legend.lines).toHaveLength(2); expect(geometry.legend.symbols).toEqual(['interchange', 'number of rules', 'suggested position']);
  expect(safe(svg).getElementsByTagName('title')[0]!.textContent).toBe('Skills map');
  expect(svg).not.toContain('licence'); expect(svg).not.toMatch(/(full|staff) view/);
});
// metro-map "Rule count on skills stations" and "Rule count is an obstacle".
const ruleText = (svg: string, ref: string): string[] => {
  const group = Array.from(safe(svg).getElementsByTagName('g')).find(element => element.getAttribute('data-ref') === ref)!;
  return Array.from(group.getElementsByTagName('text')).map(element => element.textContent ?? '');
};
test('Skill with rules', () => {
  const { geometry, svg } = draw({ rules: { writer: 3 }, skills: [['writer', 'skill'], ['editor', 'skill']], agents: ['reviewer'],
    lines: [['publish', ['skill:writer', 'skill:editor', 'agent:reviewer']]] });
  expect(geometry.stations.find(s => s.ref === 'skill:writer')!.ruleCount).toMatchObject({ text: '3' });
  expect(ruleText(svg, 'skill:writer')).toEqual(['3']);
  for (const ref of ['skill:editor', 'agent:reviewer']) {
    expect(geometry.stations.find(s => s.ref === ref)!.ruleCount, ref).toBeUndefined();
    expect(ruleText(svg, ref), ref).toEqual([]);
  }
  // One digit is a circle; more digits widen it to a pill.
  const box = geometry.stations.find(s => s.ref === 'skill:writer')!.ruleCount!.box;
  expect(box.w).toBe(box.h);
  const wide = draw({ rules: { writer: 12 }, ...writerEditor }).geometry.stations.find(s => s.ref === 'skill:writer')!.ruleCount!.box;
  expect(wide.w).toBeGreaterThan(wide.h);
  for (const theme of Object.values(themes)) safe(draw({ rules: { writer: 3 }, ...writerEditor }, theme).svg);
});
test('Duplicate rule ID', async () => {
  const root = skillSet({ 'writer/SKILL.md': skill('writer'), 'writer/rules.md': rules('- **WR-1** Short sentences.', '- **WR-1** Short paragraphs.'),
    'editor/SKILL.md': skill('editor'),
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["skill:writer", "skill:editor"]\n' });
  const set = await readSkillSet([], { cwd: root });
  expect(set.skills.find(s => s.name === 'writer')!.rules).toHaveLength(1);
  const svg = renderSvg(layoutMap(buildSkillsMapModel(set)), themes.light);
  expect(ruleText(svg, 'skill:writer')).toEqual(['1']);
});
test('Many rules', () => {
  const { geometry, svg } = draw({ rules: { release: 100 }, skills: [['release', 'playbook'], ['writer', 'skill']], lines: [['publish', ['playbook:release', 'skill:writer']]] });
  expect(geometry.stations.find(s => s.ref === 'playbook:release')!.ruleCount!.text).toBe('99+');
  expect(ruleText(svg, 'playbook:release')).toEqual(['99+']);
  expect(draw({ rules: { release: 99 }, skills: [['release', 'playbook'], ['writer', 'skill']], lines: [['publish', ['playbook:release', 'skill:writer']]] })
    .geometry.stations.find(s => s.ref === 'playbook:release')!.ruleCount!.text).toBe('99');
});
test('Rule count pushes a label out', () => {
  const fixture: Fixture = { ...writerEditor, stations: { 'skill:writer': [0, 2], 'skill:editor': [0, 6] } };
  const ink = inkOf(themes.light);
  const plain = draw(fixture).geometry;
  const first = (g: typeof plain) => {
    const station = g.stations.find(s => s.ref === 'skill:writer')!, label = g.labels.find(l => l.ref === 'skill:writer')!;
    return { station, label };
  };
  const without = first(plain);
  // Without a rule count the label sits at its first candidate, to the right.
  expect(without.label.box.x).toBeGreaterThan(without.station.marker.box.x + without.station.marker.box.w);
  expect(without.label.box.y + without.label.box.h / 2).toBeCloseTo(without.station.point[1], 0);
  const withRules = first(draw({ ...fixture, rules: { writer: 4 } }).geometry);
  expect(withRules.label.box).not.toEqual(without.label.box);
  expect(overlapArea(withRules.label.box, inkBox(withRules.station.ruleCount!.box, ink))).toBe(0);
});
test('Terminal badge clear of a rule count', () => {
  const ink = inkOf(themes.light);
  const fixture: Fixture = { ...writerEditor, stations: { 'skill:writer': [0, 0], 'skill:editor': [0, 2] } };
  const plain = draw(fixture).geometry;
  const g = draw({ ...fixture, rules: { writer: 4, editor: 4 } }).geometry;
  const counts = g.stations.flatMap(s => s.ruleCount ? [inkBox(s.ruleCount.box, ink)] : []);
  expect(counts).toHaveLength(2);
  for (const badge of g.badges) for (const count of counts) expect(overlapArea(inkBox(badge.box, ink), count)).toBe(0);
  // The rule count really was in the way: at least one badge moved.
  expect(g.badges.map(b => b.box)).not.toEqual(plain.badges.map(b => b.box));
});
test('Rule count inside the frame', () => {
  const ink = inkOf(themes.light);
  const { geometry } = draw({ rules: { editor: 7 }, ...writerEditor, stations: { 'skill:writer': [0, 2], 'skill:editor': [4, 0] } });
  const box = inkBox(geometry.stations.find(s => s.ref === 'skill:editor')!.ruleCount!.box, ink), frame = geometry.frame;
  expect(box.x).toBeGreaterThanOrEqual(frame.x); expect(box.y).toBeGreaterThanOrEqual(frame.y);
  expect(box.x + box.w).toBeLessThanOrEqual(frame.x + frame.w); expect(box.y + box.h).toBeLessThanOrEqual(frame.y + frame.h);
});
test('Same skills map everywhere', async () => {
  const files = { 'writer/SKILL.md': skill('writer'), 'editor/SKILL.md': skill('editor'), 'release/SKILL.md': playbook('release', 'writer editor'),
    'stackledger-skills.yaml': 'apiVersion: stackledger/v1alpha1\nkind: Line\nmetadata:\n  name: publish\nspec:\n  color: "#E4002B"\n  stops: ["playbook:release", "skill:writer", "skill:editor"]\n' };
  const root = skillSet(files);
  const forward = await readSkillSet([], { cwd: root });
  const reversed = await readSkillSet([], { cwd: root, list: async path => (await readdir(path)).reverse() });
  for (const theme of Object.values(themes)) {
    const one = renderSvg(layoutMap(buildSkillsMapModel(forward), theme.lineWidth, inkOf(theme)), theme);
    expect(renderSvg(layoutMap(buildSkillsMapModel(reversed), theme.lineWidth, inkOf(theme)), theme)).toBe(one);
  }
});
test('Suggested skill station', () => {
  const { geometry, svg } = draw({ skills: [['a', 'skill'], ['b', 'skill'], ['c', 'skill']], lines: [['publish', ['skill:a', 'skill:b', 'skill:c']]] });
  expect(geometry.suggestions).toEqual([{ ref: 'skill:a', point: [0, 0] }, { ref: 'skill:b', point: [1, 0] }, { ref: 'skill:c', point: [2, 0] }]);
  expect(svg).toContain('stroke-dasharray');
});
const twoZones: Fixture = {
  skills: [['release', 'playbook', ['writer']], ['review', 'playbook', ['writer', 'linter']], ['writer', 'skill'], ['editor', 'skill'], ['linter', 'skill']],
  lines: [['publish', ['playbook:release', 'skill:editor', 'skill:writer']], ['check', ['playbook:review', 'skill:linter', 'skill:writer']]],
  stations: { 'playbook:release': [0, 0], 'skill:editor': [2, 0], 'skill:writer': [4, 2], 'playbook:review': [0, 4], 'skill:linter': [2, 4] },
  zones: ['release', 'review'],
};
test('Overlapping zones', () => {
  const { geometry, svg } = draw(twoZones);
  const writer = geometry.stations.find(s => s.ref === 'skill:writer')!.point;
  for (const zone of geometry.zones) expect(zone.hull).toContainEqual(writer);
  expect(svg).toMatch(/data-ref="skill:writer"[^>]*data-zone="release review"/);
});
test('Multi-word software zone', () => {
  const docs = [setField(component('a'), 'metadata.labels', { 'stackledger/zone': 'Team tools' }), component('b'), journey('ship', ['a', 'b']),
    setField(positions({ a: [0, 0], b: [4, 0] }), 'spec.zones', [{ name: 'Team tools', title: 'Team tools', color: '#ABCDEF' }])];
  expect(renderSvg(layoutMap(buildMapModel(viewOf(docs, 'full'), '2027-06-01')), themes.light)).toContain('data-zone="team tools"');
});
test('Title by its playbook', () => {
  const { geometry } = draw({ skills: [['review', 'playbook', ['linter']], ['linter', 'skill']], lines: [['check', ['playbook:review', 'skill:linter']]],
    stations: { 'playbook:review': [0, 4], 'skill:linter': [2, 1] }, zones: ['review'] });
  const zone = geometry.zones[0]!, station = geometry.stations.find(s => s.ref === 'playbook:review')!;
  const centre = [zone.titleBox.x + zone.titleBox.w / 2, zone.titleBox.y + zone.titleBox.h / 2];
  expect(Math.hypot(centre[0]! - station.point[0], centre[1]! - station.point[1])).toBeLessThan(zone.titleBox.w);
  expect(zone.titleBox.y).toBeGreaterThan(station.point[1] - 60);
});
test('Title clear of the lines', () => {
  const ink = inkOf(themes.light);
  const { geometry } = draw({ skills: [['release', 'playbook', ['writer']], ['writer', 'skill'], ['editor', 'skill']],
    lines: [['publish', ['playbook:release', 'skill:writer', 'skill:editor']]], stations: { 'playbook:release': [0, 0], 'skill:writer': [1, 1], 'skill:editor': [3, 1] }, zones: ['release'] });
  const title = geometry.zones[0]!.titleBox;
  const segments = geometry.lines.flatMap(line => line.points.slice(1).map((point, i) => segmentObstacle(line.points[i]!, point, themes.light.lineWidth + ink.casing)));
  expect(overlapScore(title, segments)).toBe(0);
  for (const station of geometry.stations) expect(overlapArea(title, station.marker.box)).toBe(0);
  for (const label of geometry.labels) expect(overlapArea(title, label.box)).toBe(0);
});
test('Two zones with one corner', () => {
  const { geometry } = draw({ skills: [['release', 'playbook', ['writer', 'editor']], ['review', 'playbook', ['writer', 'editor']], ['writer', 'skill'], ['editor', 'skill']],
    lines: [['publish', ['skill:writer', 'skill:editor']]], stations: { 'skill:writer': [0, 0], 'skill:editor': [2, 0] }, zones: ['release', 'review'] });
  const [release, review] = geometry.zones;
  expect(overlapArea(release!.titleBox, review!.titleBox)).toBe(0); expect(review!.titleBox.y).toBeLessThan(release!.titleBox.y);
});
test('Corner title next to a placed title', () => {
  // review's playbook is drawn, so its title moves next to it; release's is not, so its corner title stays where it was.
  const { geometry } = draw({ skills: [['release', 'playbook', ['writer', 'editor']], ['review', 'playbook', ['writer', 'editor']], ['writer', 'skill'], ['editor', 'skill']],
    lines: [['publish', ['playbook:review', 'skill:writer', 'skill:editor']]], stations: { 'playbook:review': [0, 3], 'skill:writer': [0, 0], 'skill:editor': [2, 0] }, zones: ['release', 'review'] });
  const release = geometry.zones.find(zone => zone.name === 'release')!;
  expect(release.titleBox.y).toBe(-56);
});
