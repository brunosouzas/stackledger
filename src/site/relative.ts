/** Relative URLs and the output scan of one built site (design D3 and D4).
 *
 * Why: Astro has no relative base and writes root-absolute `/_astro/...` URLs. relativise(siteDir)
 * rewrites them in HTML URL attributes and in CSS `url()` and `@import`, relative to the file that
 * holds them, so a site works under any path prefix (`/full/`, `/staff/`). scan(siteDir, buildPaths)
 * then lists every URL form the rewrite does not handle, every relative URL that resolves outside
 * the site folder (`../../../full/` from a `staff` page), every piece of inline code, any page whose
 * CSP differs from POLICY and any build path left in a file; the build fails on any problem, before
 * anything is published.
 *
 * HTML is read tag by tag: catalogue text is escaped by Astro and the SVG renderers, so `<` and `>`
 * never appear inside text or attribute values, and a hostile title cannot look like an attribute.
 * Deterministic: files are visited in sorted order and only rewritten, never renamed.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { POLICY } from './policy.js';

const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'data', 'xlink:href']);
const TAG = /<([A-Za-z][A-Za-z0-9:-]*)((?:\s[^<>]*?)?)(\/?)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const ASTRO_ASSET = /^\/_astro\//;

interface Attribute { name: string; value: string | undefined }

/** Every file under a folder, as sorted paths relative to it with forward slashes. */
export function listFiles(dir: string, base = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full, base));
    else files.push(relative(base, full).split(sep).join('/'));
  }
  return files.sort();
}

function attributes(text: string): Attribute[] {
  return [...text.matchAll(ATTRIBUTE)].map(match => ({ name: match[1]!.toLowerCase(), value: match[2] ?? match[3] ?? match[4] }));
}

/** A URL that leaves the site: root-absolute, protocol-relative or with a scheme. */
const leaves = (url: string): boolean => url.startsWith('/') || SCHEME.test(url);

/** A made-up origin and folder for the site root; any URL resolving outside the folder escapes. */
const SITE_FOLDER = '/root/';
const SITE_ROOT = `https://site.invalid${SITE_FOLDER}`;
/** Encoded `/` and `\`: a server that decodes them before resolving the path could climb out. */
const ENCODED_SEPARATOR = /%2f|%5c/i;

/** True when a relative `url`, resolved as a browser does against `file` (a path from the site
 * root), lands outside the site folder: `../` past the root, `%2e%2e`, backslashes or an encoded
 * separator. A URL the parser rejects counts as escaping. */
function escapes(file: string, url: string): boolean {
  try {
    const { pathname } = new URL(url, SITE_ROOT + file);
    return !pathname.startsWith(SITE_FOLDER) || ENCODED_SEPARATOR.test(pathname);
  } catch {
    return true;
  }
}

/** Rewrite `/_astro/...` into a path relative to the folder of `file` (both relative to the site root). */
function toRelative(file: string, url: string): string {
  return posix.relative(posix.dirname(file), url.slice(1)) || './';
}

function relativiseHtml(file: string, html: string): string {
  return html.replace(TAG, (tag: string, name: string, attrs: string, close: string) => {
    const rewritten = attrs.replace(/(\s)([A-Za-z:-]+)=(["'])([^"']*)\3/g, (whole: string, space: string, attr: string, quote: string, value: string) => {
      const key = attr.toLowerCase();
      if (URL_ATTRIBUTES.has(key) && ASTRO_ASSET.test(value)) return `${space}${attr}=${quote}${toRelative(file, value)}${quote}`;
      if (key === 'srcset') {
        const parts = value.split(',').map(part => part.trim().replace(/^\/_astro\/\S*/, url => toRelative(file, url)));
        return `${space}${attr}=${quote}${parts.join(', ')}${quote}`;
      }
      return whole;
    });
    return `<${name}${rewritten}${close}>`;
  });
}

function relativiseCss(file: string, css: string): string {
  return css
    .replace(/url\(\s*(["']?)(\/_astro\/[^"')]*)\1\s*\)/g, (_: string, quote: string, url: string) => `url(${quote}${toRelative(file, url)}${quote})`)
    .replace(/@import\s+(["'])(\/_astro\/[^"']*)\1/g, (_: string, quote: string, url: string) => `@import ${quote}${toRelative(file, url)}${quote}`);
}

/** Rewrite every root-absolute Astro asset URL in the site's HTML and CSS files, in place. */
export function relativise(siteDir: string): void {
  for (const file of listFiles(siteDir)) {
    const path = join(siteDir, file);
    if (file.endsWith('.html')) writeFileSync(path, relativiseHtml(file, readFileSync(path, 'utf8')));
    else if (file.endsWith('.css')) writeFileSync(path, relativiseCss(file, readFileSync(path, 'utf8')));
  }
}

const decode = (value: string): string => value.replaceAll('&#39;', "'").replaceAll('&apos;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');

function scanHtml(file: string, html: string): string[] {
  const problems: string[] = [];
  const policies: string[] = [];
  for (const [, rawName, attrText] of html.matchAll(TAG)) {
    const name = rawName!.toLowerCase();
    const attrs = attributes(attrText ?? '');
    const has = (key: string) => attrs.some(attr => attr.name === key);
    if (name === 'script' && !has('src')) problems.push(`${file}: inline <script>`);
    if (name === 'style') problems.push(`${file}: <style> element`);
    for (const attr of attrs) {
      const value = attr.value === undefined ? '' : decode(attr.value);
      if (attr.name === 'style') problems.push(`${file}: style attribute`);
      if (attr.name.startsWith('on')) problems.push(`${file}: event-handler attribute ${attr.name}`);
      if (URL_ATTRIBUTES.has(attr.name)) problems.push(...urlProblems(file, `${attr.name}="${value}"`, value.trim()));
      if (attr.name === 'srcset') {
        for (const part of value.split(',').map(item => item.trim())) {
          problems.push(...urlProblems(file, `srcset part "${part}"`, part.split(/\s+/)[0] ?? ''));
        }
      }
    }
    const equiv = attrs.find(attr => attr.name === 'http-equiv')?.value;
    if (name === 'meta' && equiv?.toLowerCase() === 'content-security-policy') {
      policies.push(decode(attrs.find(attr => attr.name === 'content')?.value ?? ''));
    }
  }
  if (policies.length !== 1 || policies[0] !== POLICY) problems.push(`${file}: CSP meta ${JSON.stringify(policies)}`);
  return problems;
}

/** The problem with one URL of `file`, if any: it leaves the site (absolute, scheme) or escapes the
 * site folder once resolved. `label` names the URL in the message. */
function urlProblems(file: string, label: string, url: string): string[] {
  if (leaves(url)) return [`${file}: ${label}`];
  if (escapes(file, url)) return [`${file}: ${label} leaves the site folder`];
  return [];
}

function scanCss(file: string, css: string): string[] {
  const problems: string[] = [];
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) problems.push(...urlProblems(file, `url(${match[2]})`, match[2]!.trim()));
  for (const match of css.matchAll(/@import\s+(?:url\()?\s*(["']?)([^"')\s;]*)\1/g)) problems.push(...urlProblems(file, `@import ${match[2]}`, match[2]!));
  return problems;
}

function scanJs(file: string, js: string): string[] {
  const problems: string[] = [];
  if (/\bimport\s*\(/.test(js)) problems.push(`${file}: dynamic import(`);
  if (/import\.meta\.url/.test(js)) problems.push(`${file}: import.meta.url`);
  if (/\/_astro\//.test(js)) problems.push(`${file}: /_astro/ string`);
  for (const match of js.matchAll(/(?:\bimport|\bexport)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g)) {
    const specifier = match[1]!;
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) problems.push(`${file}: import specifier "${specifier}"`);
    else if (escapes(file, specifier)) problems.push(`${file}: import specifier "${specifier}" leaves the site folder`);
  }
  return problems;
}

/** Every problem in a built site; an empty list means it may be published. `buildPaths` are the
 * build's own paths (the staging folder, the working copy): none may appear in an output file.
 * Only these exact paths count, so catalogue text that mentions `.stackledger-tmp-*` is fine. */
export function scan(siteDir: string, buildPaths: readonly string[] = []): string[] {
  const problems: string[] = [];
  for (const file of listFiles(siteDir)) {
    const text = readFileSync(join(siteDir, file), 'utf8');
    if (file.endsWith('.html')) problems.push(...scanHtml(file, text));
    else if (file.endsWith('.css')) problems.push(...scanCss(file, text));
    else if (file.endsWith('.js') || file.endsWith('.mjs')) problems.push(...scanJs(file, text));
    if (buildPaths.some(path => text.includes(path))) problems.push(`${file}: staging path in the output`);
  }
  return problems;
}
