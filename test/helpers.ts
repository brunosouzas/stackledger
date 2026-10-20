/** Shared synthetic documents and disposable folders. Run through npm test; cleanup restores modes. */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterEach } from 'vitest';
export const component = (name = 'a') => `apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: ${name}\nspec:\n  type: tool\n  lifecycle: active\n  owner: user:alex\n`;
export const layout = (name = 'map') => `apiVersion: stackledger/v1alpha1\nkind: MapLayout\nmetadata:\n  name: ${name}\nspec:\n  stations: {}\n`;
const folders: string[] = [];
export function folder(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'stackledger-')); folders.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content);
  }
  return root;
}
afterEach(() => { for (const root of folders.splice(0)) {
  // Unreadable-directory fixtures need their permissions restored before recursive cleanup.
  function restore(path: string) { chmodSync(path, 0o700); for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) restore(join(path, entry.name));
  } }
  restore(root); rmSync(root, { recursive: true, force: true });
} });
