/** The graph and pages of `stackledger skills map` (skills-map-command spec: page file names, declared
 * relations, item pages, diagrams, node IDs, budget, index, text and labels, source files). Run npm test.
 *
 * Each test reads a fictitious Northwind skill set from a temporary folder with readSkillSet, then
 * calls the pure graph and page functions (src/skills/graph.ts, src/skills/mermaid.ts) with the real
 * paths the command would compute; nothing is written. The fixtures in test/skills-map-fixtures.ts are
 * also rendered by Mermaid in the browser test (test/browser/skills-map.spec.ts).
 */
import { test, expect } from 'vitest';
import { readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { readSkillSet } from '../../src/skills/source.js';
import { buildGraph } from '../../src/skills/graph.js';
import { renderMap } from '../../src/skills/mermaid.js';
import { type ListFolder } from '../../src/skills/walk.js';
import { agent, playbook, rules, skill, skillSet } from '../skills-helpers.js';
import { HOSTILE_NAME, MERMAID_FIXTURES } from '../skills-map-fixtures.js';

interface MapOptions { folders?: string[]; cwd?: string; out?: string; list?: ListFolder }
/** The pages the command would write for the set read in `root` (the current folder unless `cwd` is given). */
async function pagesOf(root: string, options: MapOptions = {}): Promise<Map<string, string>> {
  const cwd = options.cwd ?? root;
  const set = await readSkillSet(options.folders ?? [], { cwd, ...(options.list ? { list: options.list } : {}) });
  const current = realpathSync(cwd);
  return renderMap(buildGraph(set), set.summary, { current, out: join(current, ...(options.out ?? 'docs/skills-map').split('/')) });
}
const page = (pages: Map<string, string>, path: string) => {
  const text = pages.get(path);
  if (text === undefined) throw new Error(`No page ${path}; pages: ${[...pages.keys()].join(', ')}`);
  return text;
};
/** The body of a `## heading` section of a page. */
const section = (text: string, heading: string) => text.split(`\n## ${heading}\n\n`)[1]!.split(/\n\n(?:## |\[Back)/)[0]!.replace(/\n$/, '');
/** The lines of every `mermaid` block of a page. */
const blocks = (text: string) => [...text.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map(match => match[1]!.split('\n'));
const edges = (lines: string[]) => lines.filter(line => line.includes(' -->|'));

test('Name with a path', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('../writer') }));
  expect(pages.has('skills/_2e2e2f777269746572.md')).toBe(true);
  // Every page path stays one level inside a kind folder, in lowercase ASCII.
  for (const path of pages.keys()) expect(path).toMatch(/^(README\.md|(skills|playbooks|agents)\/[a-z0-9_-]+\.md)$/);
});

test('Names that differ only in case', async () => {
  const pages = await pagesOf(skillSet({ 'skills/a/SKILL.md': skill('Writer'), 'skills/b/SKILL.md': skill('writer') }));
  expect([...pages.keys()].filter(path => path.startsWith('skills/'))).toEqual(['skills/_577269746572.md', 'skills/writer.md']);
});

test('Windows device name', async () => {
  const pages = await pagesOf(skillSet({ 'skills/con/SKILL.md': skill('con') }));
  expect([...pages.keys()]).toEqual(['README.md', 'skills/_636f6e.md']);
});

test('Long name', async () => {
  const name = 'a'.repeat(65);
  const pages = await pagesOf(skillSet({ [`skills/${name}/SKILL.md`]: skill(name) }));
  expect([...pages.keys()]).toEqual(['README.md', 'skills/_616161616161616161616161616161616161616161616161616-635361c48bb.md']);
});

test('Name in the text', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer', { body: '# writer\n\nHand the draft to `editor` when done.\n' }), 'skills/editor/SKILL.md': skill('editor') }));
  const writer = page(pages, 'skills/writer.md');
  expect(section(writer, 'Brings in')).toBe('None.');
  expect(section(writer, 'Brought in by')).toBe('None.');
  expect(writer).not.toContain('editor');
  expect(page(pages, 'README.md')).not.toContain('```mermaid');
});

test('Missing relation target', async () => {
  const pages = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'writer ghost'), 'skills/writer/SKILL.md': skill('writer') }));
  for (const text of pages.values()) expect(text).not.toContain('ghost');
  expect(section(page(pages, 'playbooks/release.md'), 'Brings in')).toBe('- [writer](../skills/writer.md) (loads)');
});

test('Same name in two namespaces', async () => {
  const pages = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'reviewer', 'reviewer'), 'skills/reviewer/SKILL.md': skill('reviewer'), 'agents/reviewer.md': agent('reviewer') }));
  expect(section(page(pages, 'playbooks/release.md'), 'Brings in')).toBe('- [reviewer](../skills/reviewer.md) (loads)\n- [reviewer](../agents/reviewer.md) (uses)');
});

test('Repeated preload', async () => {
  const root = skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'agents/drafter.md': agent('drafter', 'skills: [writer, writer]\n') });
  const set = await readSkillSet([], { cwd: root });
  expect(buildGraph(set).edges).toHaveLength(1);
  const pages = await pagesOf(root);
  expect(edges(blocks(page(pages, 'agents/drafter.md'))[0]!)).toEqual(['  a_drafter -->|preloads| out_s_writer']);
  expect(edges(blocks(page(pages, 'README.md'))[0]!)).toEqual(['  a_drafter -->|preloads| s_writer']);
});

test('Playbook page', async () => {
  const pages = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'writer editor', 'reviewer'), 'skills/writer/SKILL.md': skill('writer'),
    'skills/editor/SKILL.md': skill('editor'), 'agents/reviewer.md': agent('reviewer') }));
  const release = page(pages, 'playbooks/release.md');
  expect(section(release, 'Brings in')).toBe('- [editor](../skills/editor.md) (loads)\n- [reviewer](../agents/reviewer.md) (uses)\n- [writer](../skills/writer.md) (loads)');
  // The page holds its parts in the order the spec gives.
  const order = ['# release\n', 'Generated by `stackledger skills map`', 'Kind: playbook', 'Helps the Northwind team with release.', 'Legend:', '```mermaid',
    '## Brought in by', '## Brings in', '## Reached through', '## Rules', '## Source files', '[Back to the index](../README.md)'];
  const positions = order.map(part => release.indexOf(part));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('Skill page', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/writer/rules.md': rules('- **WR-1** Write short.', '- **WR-2** Write plain.'),
    'skills/release/SKILL.md': playbook('release', 'writer'), 'agents/drafter.md': agent('drafter', 'skills: [writer]\n') }));
  const writer = page(pages, 'skills/writer.md');
  expect(section(writer, 'Brought in by')).toBe('- [drafter](../agents/drafter.md) (preloads)\n- [release](../playbooks/release.md) (loads)');
  expect(section(writer, 'Rules')).toBe('WR-1, WR-2');
});

test('Reached through a playbook', async () => {
  const pages = await pagesOf(skillSet({ 'skills/ship/SKILL.md': playbook('ship', 'release'), 'skills/release/SKILL.md': playbook('release', 'writer'), 'skills/writer/SKILL.md': skill('writer') }));
  const writer = page(pages, 'skills/writer.md');
  expect(section(writer, 'Reached through')).toBe('Items that bring this one in through two or more relations.\n\n- [ship](../playbooks/ship.md)');
  expect(section(writer, 'Brought in by')).toBe('- [release](../playbooks/release.md) (loads)');
});

test('Listing order does not matter', async () => {
  const root = skillSet({ 'skills/release/SKILL.md': playbook('release', 'writer editor', 'reviewer drafter'), 'skills/writer/SKILL.md': skill('writer'), 'skills/editor/SKILL.md': skill('editor'),
    'skills/writer/rules.md': rules('- **WR-1** One.'), 'agents/reviewer.md': agent('reviewer', 'skills: [editor, writer]\n'), 'agents/drafter.md': agent('drafter', 'skills: [writer]\n') });
  const reversed: ListFolder = async path => readdirSync(path).sort().reverse();
  const forward = await pagesOf(root), backward = await pagesOf(root, { list: reversed });
  expect([...backward]).toEqual([...forward]);
  expect(forward.size).toBe(6);
});

test('Diagram of a skill', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Diagram of a skill']));
  const [lines] = blocks(page(pages, 'skills/writer.md'));
  expect(lines).toEqual(['flowchart LR', '  in_p_release("release")', '  s_writer["writer"]', '  in_p_release -->|loads| s_writer',
    '  classDef current stroke-width:4px', '  class s_writer current']);
});

test('Two playbooks that load each other', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Two playbooks that load each other']));
  const [lines] = blocks(page(pages, 'playbooks/a.md'));
  expect(lines).toContain('  in_p_b("b")');
  expect(lines).toContain('  out_p_b("b")');
  expect(edges(lines!)).toEqual(['  in_p_b -->|loads| p_a', '  p_a -->|loads| out_p_b']);
});

test('Skill that lists itself', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Skill that lists itself']));
  const [lines] = blocks(page(pages, 'skills/writer.md'));
  expect(edges(lines!)).toEqual(['  s_writer -->|loads| s_writer']);
  expect(lines!.filter(line => line.startsWith('  s_writer['))).toHaveLength(1);
});

test('New skill in a diff', async () => {
  const before = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'writer'), 'skills/writer/SKILL.md': skill('writer') }));
  const after = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'aardvark writer'), 'skills/writer/SKILL.md': skill('writer'), 'skills/aardvark/SKILL.md': skill('aardvark') }));
  const [old] = blocks(page(before, 'README.md')), [current] = blocks(page(after, 'README.md'));
  const gained = ['  s_aardvark["aardvark"]', '  p_release -->|loads| s_aardvark'];
  expect(current!.filter(line => !old!.includes(line))).toEqual(gained);
  expect(current!.filter(line => !gained.includes(line))).toEqual(old);
});

test('Node names are not IDs', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Node names are not IDs']));
  const [lines] = blocks(page(pages, 'skills/end.md'));
  expect(lines).toContain('  s_end["end"]');
  expect(blocks(page(pages, 'README.md'))[0]).toContain('  p_release -->|loads| s_end');
});

test('Index at the edge budget', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Index at the edge budget']));
  const index = page(pages, 'README.md');
  expect(blocks(index)).toHaveLength(1);
  expect(edges(blocks(index)[0]!)).toHaveLength(400);
});

test('Index over the edge budget', async () => {
  const files = { ...MERMAID_FIXTURES['Index at the edge budget'], 'skills/s01/SKILL.md': skill('s01', { metadata: { 'stackledger-skills': 's02' } }) };
  const pages = await pagesOf(skillSet(files));
  const index = page(pages, 'README.md');
  expect(index).not.toContain('```mermaid');
  expect(index).toContain('This set has 401 relations, too many for one diagram; the lists below hold them all.');
  // Every relation appears twice in the tables: in its source's "Brings in" and its target's "Brought in by".
  expect(index.match(/\(loads\)/g)).toHaveLength(802);
  expect(section(index, 'Skills')).toContain('| [s01](skills/s01.md) | [s02](skills/s02.md) (loads) |');
});

test('Index tables', async () => {
  const pages = await pagesOf(skillSet({ 'skills/release/SKILL.md': playbook('release', 'writer editor', 'reviewer'), 'skills/hotfix/SKILL.md': playbook('hotfix', 'writer'),
    'agents/reviewer.md': agent('reviewer', 'skills: [linting]\n'),
    ...Object.fromEntries(['writer', 'editor', 'linting', 'tester', 'archivist'].map(name => [`skills/${name}/SKILL.md`, skill(name)])) }));
  const index = page(pages, 'README.md');
  const rows = (heading: string) => section(index, heading).split('\n').filter(line => line.startsWith('| ['));
  expect(rows('Playbooks').map(row => row.split(']')[0])).toEqual(['| [hotfix', '| [release']);
  expect(rows('Agents')).toEqual(['| [reviewer](agents/reviewer.md) | [linting](skills/linting.md) (preloads) | [release](playbooks/release.md) (uses) |']);
  expect(rows('Skills').map(row => row.split(']')[0])).toEqual(['| [archivist', '| [editor', '| [linting', '| [tester', '| [writer']);
});

test('Set with no relations', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/release/SKILL.md': playbook('release'), 'agents/reviewer.md': agent('reviewer') }));
  const index = page(pages, 'README.md');
  expect(index).not.toContain('```mermaid');
  expect(section(index, 'No declared incoming relations')).toBe('Skills and playbooks that nothing in the set brings in. A person may still load them by hand.\n\n'
    + '- [release](playbooks/release.md)\n- [writer](skills/writer.md)');
});

test('Errors recorded in the index', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer'), 'skills/editor/SKILL.md': '---\nname: editor\n---\n' }));
  const counts = section(page(pages, 'README.md'), 'Counts');
  expect(counts).toContain('- Errors: 1\n');
  expect(counts).toContain('Run `stackledger skills validate` on the same folders to see every problem.');
  expect(pages.has('skills/editor.md')).toBe(false);
});

test('Description with HTML', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer', { description: '<img src=x onerror=alert(1)>' }) }));
  const writer = page(pages, 'skills/writer.md');
  expect(writer).toContain('\\<img src=x onerror=alert(1)\\>');
  expect([...writer.matchAll(/</g)].every(match => writer[match.index - 1] === '\\')).toBe(true);
});

test('Multi-line description with a fence', async () => {
  const pages = await pagesOf(skillSet({ 'skills/writer/SKILL.md': skill('writer', { description: '|\n  First line.\n  ~~~\n  Last line.' }) }));
  const writer = page(pages, 'skills/writer.md');
  expect(writer.split('\n')).toContain('First line. \\~\\~\\~ Last line.');
  expect(blocks(writer)).toEqual([['flowchart LR', '  s_writer["writer"]', '  classDef current stroke-width:4px', '  class s_writer current']]);
});

test('Description at the limit', async () => {
  const pages = await pagesOf(skillSet({ 'skills/whole/SKILL.md': skill('whole', { description: 'w'.repeat(1024) }), 'skills/cut/SKILL.md': skill('cut', { description: 'c'.repeat(1025) }) }));
  expect(page(pages, 'skills/whole.md').split('\n')).toContain('w'.repeat(1024));
  expect(page(pages, 'skills/cut.md').split('\n')).toContain(`${'c'.repeat(1023)}…`);
});

test('Label that tries to close the node', async () => {
  const pages = await pagesOf(skillSet(MERMAID_FIXTURES['Label that tries to close the node']));
  const path = [...pages.keys()].find(key => key.startsWith('skills/'))!;
  for (const lines of [...blocks(page(pages, path)), ...blocks(page(pages, 'README.md'))]) {
    const label = lines.find(line => line.includes('click'))!;
    for (const entity of ['#34;', '#93;', '#59;']) expect(label).toContain(entity);
    expect(lines.some(line => line.trim().startsWith('click'))).toBe(false);
  }
  expect(page(pages, path)).toContain(`# a"\\]; click n1 "https://example.com`);
  expect(HOSTILE_NAME).toContain('click');
});

test('Skill in the repository', async () => {
  const root = skillSet({ 'repo/skills/writer/SKILL.md': skill('writer') });
  const pages = await pagesOf(root, { cwd: join(root, 'repo'), folders: ['.'] });
  expect(section(page(pages, 'skills/writer.md'), 'Source files')).toBe('- [skills/writer/SKILL.md](../../../skills/writer/SKILL.md)');
});

test('Tool folder in the home folder', async () => {
  const root = skillSet({ 'repo/skills/release/SKILL.md': playbook('release'), 'home/northwind/.claude/skills/writer/SKILL.md': skill('writer') });
  const claude = join(root, 'home', 'northwind', '.claude');
  const pages = await pagesOf(root, { cwd: join(root, 'repo'), folders: ['.', claude] });
  const writer = page(pages, 'skills/writer.md');
  expect(section(writer, 'Source files')).toBe('- skills/writer/SKILL.md (outside the current folder)');
  for (const text of pages.values()) {
    expect(text).not.toContain('/home/northwind');
    expect(text).not.toContain(root);
    expect(text).not.toContain(realpathSync(root));
  }
});

test('Folder name with special characters', async () => {
  const root = skillSet({ 'repo/skills/my skill#1/SKILL.md': skill('my-skill') });
  const pages = await pagesOf(root, { cwd: join(root, 'repo'), folders: ['.'] });
  expect(section(page(pages, 'skills/my-skill.md'), 'Source files')).toBe('- [skills/my skill\\#1/SKILL.md](../../../skills/my%20skill%231/SKILL.md)');
});
