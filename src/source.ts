/** Read local YAML without following links. Used by validateFolder; I/O failures are problems.
 * Parsing keeps CST ranges so all later rules can report the original key/value location.
 */
import { readdir, lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareText } from './identity.js';
export { compareText } from './identity.js';
import { parseAllDocuments, LineCounter, isMap, isSeq, isAlias, isScalar, type Document, type Node } from 'yaml';

export type FieldPath = (string | number)[];
export interface Problem {
  path: string; line: number; column: number; severity: 'error' | 'warning';
  field: string | null; message: string;
}
export interface Source {
  path: string; document: Document; counter: LineCounter; value: Record<string, unknown>;
}
/** settingsUnread: a file that failed to parse or expand holds a document that reads as Settings. */
export interface Loaded { files: number; sources: Source[]; problems: Problem[]; settingsUnread?: boolean }
export const MAX_FILE_BYTES = 1024 * 1024;

const SHORT_ESCAPES: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
/** A bracketed key as JSON text, with U+0000–U+001F and U+007F–U+009F always as `\u` escapes:
 * a hostile annotation key can neither break a line nor send a terminal escape (catalogue spec). */
function quotedKey(key: string): string {
  // Each match is one whole JSON escape or one C1 character, so `\\n` (an escaped backslash) stays.
  return JSON.stringify(key).replace(/\\(["\\/bfnrtu])|[\u007f-\u009f]/g, (match, escape: string | undefined) => {
    const character = escape === undefined ? match : SHORT_ESCAPES[escape];
    return character === undefined ? match : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}
export function fieldName(path: FieldPath): string | null {
  if (!path.length) return null;
  return path.map((key, i) => typeof key === 'number' ? `[${key}]`
    : /^[A-Za-z0-9_-]+$/.test(key) ? `${i ? '.' : ''}${key}` : `[${quotedKey(key)}]`).join('');
}
export function fileProblem(path: string, message: string, severity: Problem['severity'] = 'error'): Problem {
  return { path, line: 1, column: 1, field: null, severity, message };
}
export function resolveNode(source: Source, node: Node | null | undefined): Node | null | undefined {
  const seen = new Set<Node>();
  while (isAlias(node)) {
    if (seen.has(node)) return undefined;
    seen.add(node); node = node.resolve(source.document);
  }
  return node;
}
export function sourceNode(source: Source, path: FieldPath, keyPosition = false): Node | null | undefined {
  let node: Node | null | undefined = source.document.contents as Node | null;
  for (let i = 0; i < path.length; i++) {
    node = resolveNode(source, node);
    const part = path[i]!;
    if (isMap(node)) {
      const pair = node.items.find(item => String(resolveNode(source, item.key as Node | null)) === String(part));
      if (!pair) return undefined;
      node = (keyPosition && i === path.length - 1 ? pair.key : pair.value) as Node | null;
    } else if (isSeq(node) && typeof part === 'number' && part < node.items.length) {
      node = node.items[part] as Node | null;
    } else return undefined;
  }
  return node;
}
export function problem(source: Source, path: FieldPath, message: string,
  severity: Problem['severity'] = 'error', keyPosition = false): Problem {
  const node = sourceNode(source, path, keyPosition);
  const offset = node?.range?.[0] ?? source.document.contents?.range?.[0] ?? 0;
  const position = source.counter.linePos(offset);
  return { path: source.path, line: position.line, column: position.col,
    severity, field: fieldName(path), message };
}

/** Whether a document that failed to parse or expand reads as Settings: a top-level kind of Settings in any case.
 * Aliases are never resolved, so the text they point at (a hidden licence value, say) cannot decide;
 * an alias in place of the kind key or value counts as Settings. A key that is itself a mapping, as parser
 * recovery produces from a broken flow mapping, is searched the same way.
 */
function mayBeSettings(node: unknown, depth = 0): boolean {
  if (!isMap(node) || depth > 2) return false;
  return node.items.some(pair => {
    if (isMap(pair.key)) return mayBeSettings(pair.key, depth + 1);
    if (!isAlias(pair.key) && !(isScalar(pair.key) && String(pair.key.value) === 'kind')) return false;
    return isAlias(pair.value) || (isScalar(pair.value) && String(pair.value.value).toLowerCase() === 'settings');
  });
}
/** settingsUnread: the file failed to parse or expand and holds a document that reads as Settings (fail closed). */
export function parseSource(path: string, text: string): { sources: Source[]; problems: Problem[]; settingsUnread: boolean } {
  const counter = new LineCounter();
  const documents = parseAllDocuments(text, { lineCounter: counter, prettyErrors: false, uniqueKeys: true, logLevel: 'silent' });
  const { sources, problems, unread } = parseDocuments(path, documents, counter);
  return { sources, problems, settingsUnread: unread.some(document => mayBeSettings(document.contents)) };
}
/** unread: the documents not checked because of their own failure, or every document when the file is invalid. */
function parseDocuments(path: string, documents: ReturnType<typeof parseAllDocuments>, counter: LineCounter): { sources: Source[]; problems: Problem[]; unread: Document[] } {
  // A syntax failure invalidates the entire file, including earlier documents.
  const errors = documents.flatMap(document => document.errors);
  if (errors.length) return { sources: [], unread: documents, problems: errors.map(error => {
    const position = counter.linePos(error.pos[0] ?? 0);
    // Parser messages can embed input, so only emit the parser's stable error code.
    return { ...fileProblem(path, `Invalid YAML (${error.code})`), line: position.line, column: position.col };
  }) };
  const sources: Source[] = [];
  const problems: Problem[] = [];
  const unread: Document[] = [];
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
      unread.push(document);
    }
  }
  return { sources, problems, unread };
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
        if (parsed.settingsUnread) loaded.settingsUnread = true;
      } catch { loaded.problems.push(fileProblem(path, 'File cannot be read')); }
    }
  }
  await walk('');
  loaded.sources.sort((a, b) => compareText(a.path, b.path));
  return loaded;
}
