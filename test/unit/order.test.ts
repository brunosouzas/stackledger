/** Document ordering is code-point based and stable within a file. Run npm test. */
import { test, expect } from 'vitest';
import { compareText, parseSource } from '../../src/source.js';
import { component, layout } from '../helpers.js';
test('Case in paths', () => {
 const sources = [...parseSource('a.yaml', component('x')).sources, ...parseSource('B.yaml', component('x')).sources];
 sources.sort((a, b) => compareText(a.path, b.path)); expect(sources.map(s => s.path)).toEqual(['B.yaml', 'a.yaml']);
});
test('Two documents in one file', () => {
 const result = parseSource('a.yaml', layout('first') + '---\n' + layout('second'));
 expect(result.sources.map(s => (s.value.metadata as { name: string }).name)).toEqual(['first', 'second']);
});
