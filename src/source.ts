/** Read local YAML without following links. Used by validateFolder; I/O failures are problems.
 * Parsing keeps CST ranges so all later rules can report the original key/value location.
 */
import { readdir, lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseAllDocuments, LineCounter, isMap, isSeq, type Document, type Node } from 'yaml';

export type FieldPath = (string | number)[];
export interface Problem {
  path: string; line: number; column: number; severity: 'error' | 'warning';
  field: string | null; message: string;
}
export interface Source {
  path: string; document: Document; counter: LineCounter; value: Record<string, unknown>;
}
export interface Loaded { files: number; sources: Source[]; problems: Problem[] }
export const MAX_FILE_BYTES = 1024 * 1024;

/** Compare Unicode code points, not locale collation or UTF-16 surrogate order. */
export function compareText(left: string, right: string): number {
  const a = Array.from(left, c => c.codePointAt(0)!);
  const b = Array.from(right, c => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}
export function fieldName(path: FieldPath): string | null {
  if (!path.length) return null;
  return path.map((key, i) => typeof key === 'number' ? `[${key}]`
    : /^[A-Za-z0-9_-]+$/.test(key) ? `${i ? '.' : ''}${key}` : `[${JSON.stringify(key)}]`).join('');
}
export function fileProblem(path: string, message: string, severity: Problem['severity'] = 'error'): Problem {
  return { path, line: 1, column: 1, field: null, severity, message };
}
export function problem(source: Source, path: FieldPath, message: string,
  severity: Problem['severity'] = 'error', keyPosition = false): Problem {
  let node: Node | null | undefined = source.document.contents as Node | null;
  let found = true;
  for (let i = 0; i < path.length; i++) {
    const part = path[i]!;
    if (isMap(node)) {
      const pair = node.items.find(item => String(item.key) === String(part));
      if (!pair) { found = false; break; }
      node = (keyPosition && i === path.length - 1 ? pair.key : pair.value) as Node | null;
    } else if (isSeq(node) && typeof part === 'number' && part < node.items.length) {
      node = node.items[part] as Node | null;
    } else { found = false; break; }
  }
  const offset = found && node?.range ? node.range[0] : source.document.contents?.range?.[0] ?? 0;
  const position = source.counter.linePos(offset);
  return { path: source.path, line: position.line, column: position.col,
    severity, field: fieldName(path), message };
}

export function parseSource(path: string, text: string): { sources: Source[]; problems: Problem[] } {
  const counter = new LineCounter();
  const documents = parseAllDocuments(text, { lineCounter: counter, prettyErrors: false, uniqueKeys: true });
  // A syntax failure invalidates the entire file, including earlier documents.
  const errors = documents.flatMap(document => document.errors);
  if (errors.length) return { sources: [], problems: errors.map(error => {
    const position = counter.linePos(error.pos[0] ?? 0);
    // Parser messages can embed input, so only emit the parser's stable error code.
    return { ...fileProblem(path, `Invalid YAML (${error.code})`), line: position.line, column: position.col };
  }) };
  const sources: Source[] = [];
  const problems: Problem[] = [];
  for (const document of documents) {
    // An explicit scalar null is not an empty document; comments and blank documents have no source.
    if (document.contents === null || (document.contents?.range?.[0] === document.contents?.range?.[1])) continue;
    if (!isMap(document.contents)) {
      const position = counter.linePos(document.contents?.range?.[0] ?? 0);
      problems.push({ ...fileProblem(path, 'Document must be a mapping'), line: position.line, column: position.col });
      continue;
    }
    try {
      const value = document.toJS({ maxAliasCount: 100 }) as Record<string, unknown>;
      sources.push({ path, document, counter, value });
    } catch {
      problems.push(fileProblem(path, 'Document cannot be expanded safely'));
    }
  }
  return { sources, problems };
}

/** Top-level failures are usage failures; descendants are recoverable file problems. */
export async function loadFolder(folder: string): Promise<Loaded> {
  let root;
  try { root = await lstat(folder); } catch { throw new Error('Catalogue folder was not found'); }
  if (!root.isDirectory()) throw new Error('Catalogue path is not a folder');
  if (!(root.mode & 0o444)) throw new Error('Catalogue folder cannot be read');
  const loaded: Loaded = { files: 0, sources: [], problems: [] };
  async function walk(relative: string): Promise<void> {
    let entries;
    try { entries = await readdir(join(folder, relative), { withFileTypes: true }); }
    catch {
      if (!relative) throw new Error('Catalogue folder cannot be read');
      loaded.problems.push(fileProblem(relative, 'Folder cannot be read')); return;
    }
    entries.sort((a, b) => compareText(a.name, b.name));
    for (const entry of entries) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = join(folder, path);
      try {
        const stat = await lstat(absolute);
        if (stat.isSymbolicLink()) { loaded.problems.push(fileProblem(path, 'Symbolic link is not followed', 'warning')); continue; }
        if (stat.isDirectory()) {
          if (['.git', 'node_modules'].includes(entry.name)) continue;
          if (!(stat.mode & 0o444)) { loaded.problems.push(fileProblem(path, 'Folder cannot be read')); continue; }
          await walk(path); continue;
        }
        if (!stat.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
        loaded.files++;
        if (stat.size > MAX_FILE_BYTES) { loaded.problems.push(fileProblem(path, 'File exceeds 1 MiB')); continue; }
        if (!(stat.mode & 0o444)) { loaded.problems.push(fileProblem(path, 'File cannot be read')); continue; }
        const parsed = parseSource(path, await readFile(absolute, 'utf8'));
        loaded.sources.push(...parsed.sources); loaded.problems.push(...parsed.problems);
      } catch { loaded.problems.push(fileProblem(path, 'File cannot be read')); }
    }
  }
  await walk('');
  loaded.sources.sort((a, b) => compareText(a.path, b.path));
  return loaded;
}
