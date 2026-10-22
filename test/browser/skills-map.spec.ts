/** Mermaid renders the diagrams of `stackledger skills map` (skills-mermaid task 2.2). Run npm run
 * test:browser (it builds the CLI first; Chromium only).
 *
 * For each fixture of test/skills-map-fixtures.ts (the scenarios "Node names are not IDs", "Label that
 * tries to close the node", "Diagram of a skill", "Two playbooks that load each other", "Skill that
 * lists itself" and "Index at the edge budget"), the built CLI writes the map into a temporary folder,
 * and every `mermaid` block of every page is rendered in Chromium by the pinned `mermaid` development
 * dependency, loaded from node_modules. A block that does not render, renders a syntax error, draws a
 * different number of edges than its source declares, or holds a link fails the test. Every network
 * request is refused and counted as a failure, so the check runs offline.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOSTILE_NAME, MERMAID_FIXTURES } from '../skills-map-fixtures.js';

declare global {
  interface Window { mermaid: { initialize(config: object): void; render(id: string, text: string): Promise<{ svg: string }> } }
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const mermaidScript = join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

/** Every mermaid block of the map the built CLI writes for `files`, with the page it is on. */
function mapBlocks(files: Record<string, string>): { page: string; text: string }[] {
  const base = mkdtempSync(join(tmpdir(), 'stackledger-skills-map-'));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(base, path)), { recursive: true });
      writeFileSync(join(base, path), text);
    }
    execFileSync(process.execPath, [join(root, 'dist', 'cli.js'), 'skills', 'map', '.', '--out', 'map'], { cwd: base, stdio: 'pipe' });
    const blocks: { page: string; text: string }[] = [];
    const walk = (folder: string, prefix: string) => {
      for (const name of readdirSync(folder).sort()) {
        const path = join(folder, name);
        if (statSync(path).isDirectory()) walk(path, `${prefix}${name}/`);
        else if (name.endsWith('.md')) {
          for (const match of readFileSync(path, 'utf8').matchAll(/```mermaid\n([\s\S]*?)\n```/g)) blocks.push({ page: prefix + name, text: match[1]! });
        }
      }
    };
    walk(join(base, 'map'), '');
    return blocks;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

for (const [scenario, files] of Object.entries(MERMAID_FIXTURES)) {
  test(`Mermaid renders every diagram of "${scenario}"`, async ({ page }) => {
    test.setTimeout(120_000);
    const blocks = mapBlocks(files);
    expect(blocks.length).toBeGreaterThan(0);
    const requests: string[] = [];
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.addScriptTag({ path: mermaidScript });
    await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }));
    const texts: string[] = [];
    for (const [index, block] of blocks.entries()) {
      const result = await page.evaluate(async ([id, text]) => {
        try {
          const { svg } = await window.mermaid.render(id, text);
          const box = document.createElement('div');
          box.innerHTML = svg;
          document.body.append(box);
          return { rendered: true, syntaxError: /Syntax error/i.test(svg), edges: box.querySelectorAll('path.flowchart-link').length,
            links: box.querySelectorAll('a').length, text: box.textContent ?? '' };
        } catch (error) {
          return { rendered: false, message: String(error) };
        }
      }, [`diagram${index}`, block.text] as const);
      expect(result, `${block.page}: ${'message' in result ? result.message : ''}`).toMatchObject({ rendered: true, syntaxError: false, links: 0 });
      expect('edges' in result && result.edges, `${block.page} edges`).toBe(block.text.split('\n').filter(line => line.includes(' -->|')).length);
      if ('text' in result) texts.push(result.text);
    }
    if (scenario === 'Label that tries to close the node') expect(texts.some(text => text.includes(HOSTILE_NAME))).toBe(true);
    if (scenario === 'Node names are not IDs') expect(texts.some(text => text.includes('end'))).toBe(true);
    if (scenario === 'Index at the edge budget') expect(blocks.some(block => block.page === 'README.md' && block.text.split(' -->|').length - 1 === 400)).toBe(true);
    expect(requests).toEqual([]);
  });
}
