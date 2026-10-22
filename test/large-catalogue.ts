/** The generated catalogue of the build timing checks (build-command: Build time, Build time with
 * skills): 280 components, 20 licences, 20 lines and 200 stored positions, from a fixed seed.
 * Used by test/integration/build.test.ts and test/perf/build-skills.perf.test.ts. Fictitious.
 */
import { component, layout, licence, line, set } from './unit/helpers.js';
import { yaml } from './integration/mcp-helpers.js';

const depends = (document: unknown, refs: string[]) => set(document, 'spec.dependsOn', refs);
const stops = (name: string, names: string[]) => set(line(name), 'spec.stops', names.map(item => `component:${item}`));

export function largeCatalogue(): Record<string, string> {
  let seed = 20271020;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const names = Array.from({ length: 280 }, (_, i) => `app-${String(i).padStart(3, '0')}`);
  const licences = Array.from({ length: 20 }, (_, i) => licence(`licence-${String(i).padStart(2, '0')}`));
  const components = names.map((name, i) => depends(component(name), [`resource:licence-${String(i % 20).padStart(2, '0')}`, ...(i ? [`component:${names[i - 1]}`] : [])]));
  const stopLists = Array.from({ length: 20 }, (_, i) => names.slice(i * 10, i * 10 + 10));
  for (const list of stopLists) while (list.length < 12) {
    const name = names[random(200)]!;
    if (!list.includes(name)) list.push(name);
  }
  const lines = stopLists.map((list, i) => set(set(stops(`journey-${i}`, list), 'spec.code', String(i)), 'spec.color', '#336699'));
  const cells = Array.from({ length: 25 * 12 }, (_, i) => [(i % 25) * 2, Math.floor(i / 25) * 2] as [number, number]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const map = set(layout(), 'spec.stations', Object.fromEntries(names.slice(0, 200).map((name, i) => [`component:${name}`, cells[i]!])));
  return { 'catalog-info.yaml': yaml(...components, ...licences, ...lines, map) };
}
