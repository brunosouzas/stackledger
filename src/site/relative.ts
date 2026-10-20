/** Relative URLs and the output scan of one built site (design D3 and D4).
 *
 * Why: Astro has no relative base and writes root-absolute `/_astro/...` URLs. relativise(siteDir)
 * rewrites them in HTML URL attributes and in CSS `url()` and `@import`, relative to the file that
 * holds them, so a site works under any path prefix (`/full/`, `/staff/`). scan(siteDir) then lists
 * every URL form the rewrite does not handle, every piece of inline code and any page whose CSP
 * differs from POLICY; the build fails on any problem, before anything is published.
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
      if (URL_ATTRIBUTES.has(attr.name) && leaves(value.trim())) problems.push(`${file}: ${attr.name}="${value}"`);
      if (attr.name === 'srcset') {
        for (const part of value.split(',')) if (leaves(part.trim())) problems.push(`${file}: srcset part "${part.trim()}"`);
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

function scanCss(file: string, css: string): string[] {
  const problems: string[] = [];
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) if (leaves(match[2]!.trim())) problems.push(`${file}: url(${match[2]})`);
  for (const match of css.matchAll(/@import\s+(?:url\()?\s*(["']?)([^"')\s;]*)\1/g)) if (leaves(match[2]!)) problems.push(`${file}: @import ${match[2]}`);
  return problems;
}

function scanJs(file: string, js: string): string[] {
  const problems: string[] = [];
  if (/\bimport\s*\(/.test(js)) problems.push(`${file}: dynamic import(`);
  if (/import\.meta\.url/.test(js)) problems.push(`${file}: import.meta.url`);
  if (/\/_astro\//.test(js)) problems.push(`${file}: /_astro/ string`);
  for (const match of js.matchAll(/(?:\bimport|\bexport)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g)) {
    if (!match[1]!.startsWith('./') && !match[1]!.startsWith('../')) problems.push(`${file}: import specifier "${match[1]}"`);
  }
  return problems;
}

/** Every problem in a built site; an empty list means it may be published. */
export function scan(siteDir: string): string[] {
  const problems: string[] = [];
  for (const file of listFiles(siteDir)) {
    const text = readFileSync(join(siteDir, file), 'utf8');
    if (file.endsWith('.html')) problems.push(...scanHtml(file, text));
    else if (file.endsWith('.css')) problems.push(...scanCss(file, text));
    else if (file.endsWith('.js') || file.endsWith('.mjs')) problems.push(...scanJs(file, text));
    if (text.includes('.stackledger-tmp-')) problems.push(`${file}: staging path in the output`);
  }
  return problems;
}
