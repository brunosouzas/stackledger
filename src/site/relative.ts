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
 *
 * URLs are checked as a browser reads them: attribute values are decoded with the HTML character
 * reference rules (`&#47;`, `&#x2f;`, `&sol;`, `&Tab;`…), ASCII tab, line feed and carriage return
 * are dropped as the URL parser drops them, and the result is resolved with WHATWG URL against a
 * made-up origin. A URL with a scheme, a leading `/` or `\`, another origin or a path outside the
 * site folder is refused. Named references outside a small table of the ones that can form URL
 * syntax are refused too, so an unknown name can never hide a separator. CSS escapes are not
 * decoded: a CSS URL holding a backslash is refused instead.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { POLICY } from './policy.js';
import { BACKDROP_CREDIT_URL } from '../map/svg.js';

const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'data', 'xlink:href']);
// Quoted attribute values may hold `>` (Astro escapes only `&` and `"`), so they are matched whole.
const TAG = /<([A-Za-z][A-Za-z0-9:-]*)((?:\s(?:"[^"]*"|'[^']*'|[^<>"'])*?)?)(\/?)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const ASTRO_ASSET = /^\/_astro\//;

/** Named character references that can spell URL syntax, or that Astro writes. Any other name in a
 * URL is refused rather than decoded (see decodeAttribute). */
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  amp: '&', AMP: '&', lt: '<', LT: '<', gt: '>', GT: '>', quot: '"', QUOT: '"', apos: "'",
  sol: '/', bsol: '\\', colon: ':', Tab: '\t', NewLine: '\n', period: '.', percnt: '%', quest: '?',
  num: '#', commat: '@', excl: '!', dollar: '$', lpar: '(', rpar: ')', ast: '*', midast: '*', plus: '+',
  comma: ',', semi: ';', equals: '=', lsqb: '[', lbrack: '[', rsqb: ']', rbrack: ']', lcub: '{',
  lbrace: '{', rcub: '}', rbrace: '}', verbar: '|', vert: '|', VerticalLine: '|', lowbar: '_',
  UnderBar: '_', Hat: '^', grave: '`', DiacriticalGrave: '`', nbsp: '\u00a0', NonBreakingSpace: '\u00a0',
};

/** Numeric references to 0x80-0x9F mean Windows-1252 characters in browsers (HTML standard). */
const WINDOWS_1252: Readonly<Record<number, number>> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** A numeric reference (the semicolon is optional for browsers) or a named one with its semicolon. */
const CHARACTER_REFERENCE = /&#(\d+);?|&#[xX]([0-9A-Fa-f]+);?|&([A-Za-z][A-Za-z0-9]*);/g;

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

/** The text of an HTML attribute value as a browser reads it, and the named references in it that
 * are not in NAMED_REFERENCES (left as they are; a URL holding one is refused). */
export function decodeAttribute(value: string): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const text = value.replace(CHARACTER_REFERENCE, (whole: string, decimal?: string, hex?: string, name?: string) => {
    if (name !== undefined) {
      const named = NAMED_REFERENCES[name];
      if (named === undefined) unknown.push(whole);
      return named ?? whole;
    }
    return fromCodePoint(decimal !== undefined ? Number.parseInt(decimal, 10) : Number.parseInt(hex!, 16));
  });
  return { text, unknown };
}

/** The character a numeric reference stands for, with the browser's replacements. */
function fromCodePoint(code: number): string {
  const invalid = code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || Number.isNaN(code);
  return invalid ? '\ufffd' : String.fromCodePoint(WINDOWS_1252[code] ?? code);
}

/** A made-up origin and folder for the site root; any URL resolving elsewhere leaves the site. */
const SITE_ORIGIN = 'https://site.invalid';
const SITE_FOLDER = '/root/';
/** Encoded `/` and `\`: a server that decodes them before resolving the path could climb out. */
const ENCODED_SEPARATOR = /%2f|%5c/i;
/** What the WHATWG URL parser removes before parsing: tab, line feed and carriage return anywhere,
 * and C0 controls or spaces at either end. */
const URL_IGNORED = /[\t\n\r]/g;
const URL_TRIMMED = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;

/** Why `url` (already decoded from HTML) is not a local URL of `file`, or undefined when it is.
 * `file` is a path from the site root; the URL is resolved as a browser would resolve it there. */
function urlProblem(file: string, url: string): 'leaves the site' | 'leaves the site folder' | undefined {
  const cleaned = url.replace(URL_IGNORED, '').replace(URL_TRIMMED, '');
  // Root-absolute, protocol-relative (a backslash counts as a slash) or with a scheme.
  if (/^[\\/]/.test(cleaned) || SCHEME.test(cleaned)) return 'leaves the site';
  let resolved: URL;
  try {
    resolved = new URL(cleaned, `${SITE_ORIGIN}${SITE_FOLDER}${file}`);
  } catch {
    return 'leaves the site';
  }
  if (resolved.origin !== SITE_ORIGIN) return 'leaves the site';
  if (!resolved.pathname.startsWith(SITE_FOLDER) || ENCODED_SEPARATOR.test(resolved.pathname)) return 'leaves the site folder';
  return undefined;
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

/** `homeLinks`: the validated URLs of spec.site.home.links, allowed only as the href of an `a` element
 * in the site's root index.html; with `mapCredit` (a city backdrop), the OpenStreetMap copyright URL is
 * allowed only as the href of an `a` element in map/index.html (site-security, No external requests). */
function scanHtml(file: string, html: string, homeLinks: readonly string[] = [], mapCredit = false): string[] {
  const problems: string[] = [];
  const policies: string[] = [];
  for (const [, rawName, attrText] of html.matchAll(TAG)) {
    const name = rawName!.toLowerCase();
    const attrs = attributes(attrText ?? '');
    const has = (key: string) => attrs.some(attr => attr.name === key);
    if (name === 'script' && !has('src')) problems.push(`${file}: inline <script>`);
    if (name === 'style') problems.push(`${file}: <style> element`);
    for (const attr of attrs) {
      if (attr.name === 'style') problems.push(`${file}: style attribute`);
      if (attr.name.startsWith('on')) problems.push(`${file}: event-handler attribute ${attr.name}`);
      if (name === 'a' && attr.name === 'href' && file === 'index.html' && isHomeLink(attr, homeLinks)) continue;
      if (name === 'a' && attr.name === 'href' && file === 'map/index.html' && mapCredit && isHomeLink(attr, [BACKDROP_CREDIT_URL])) continue;
      if (URL_ATTRIBUTES.has(attr.name) || attr.name === 'srcset') problems.push(...urlAttributeProblems(file, attr));
    }
    const equiv = attrs.find(attr => attr.name === 'http-equiv')?.value;
    if (name === 'meta' && equiv?.toLowerCase() === 'content-security-policy') {
      policies.push(decodeAttribute(attrs.find(attr => attr.name === 'content')?.value ?? '').text);
    }
  }
  if (policies.length !== 1 || policies[0] !== POLICY) problems.push(`${file}: CSP meta ${JSON.stringify(policies)}`);
  return problems;
}

/** An anchor's href that is exactly one of the given URLs once decoded (no unknown references). */
function isHomeLink(attr: Attribute, homeLinks: readonly string[]): boolean {
  if (!homeLinks.length) return false;
  const { text, unknown } = decodeAttribute(attr.value ?? '');
  return !unknown.length && homeLinks.includes(text);
}

/** The problems of one URL attribute (or each URL of a srcset), its value decoded first. */
function urlAttributeProblems(file: string, attr: Attribute): string[] {
  const { text, unknown } = decodeAttribute(attr.value ?? '');
  if (unknown.length) return [`${file}: ${attr.name}="${attr.value}" has an unknown character reference ${unknown[0]}`];
  if (attr.name !== 'srcset') return urlProblems(file, `${attr.name}="${text}"`, text);
  return text
    .split(',')
    .map(item => item.replace(ASCII_EDGE_SPACE, ''))
    .flatMap(part => urlProblems(file, `srcset part "${part}"`, part.split(ASCII_SPACE)[0] ?? ''));
}

/** HTML's ASCII whitespace only: a no-break space (U+00A0) is part of a URL, not a separator. */
const ASCII_SPACE = /[\t\n\f\r ]+/;
const ASCII_EDGE_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/** The problem with one URL of `file`, if any. `label` names the URL in the message. */
function urlProblems(file: string, label: string, url: string): string[] {
  const problem = urlProblem(file, url);
  if (problem === 'leaves the site') return [`${file}: ${label}`];
  if (problem) return [`${file}: ${label} ${problem}`];
  return [];
}

function scanCss(file: string, css: string): string[] {
  const problems: string[] = [];
  const check = (label: string, url: string) => {
    // CSS escapes (`\2f`) are not decoded here: refuse any backslash instead.
    if (url.includes('\\')) problems.push(`${file}: ${label} has a CSS escape`);
    else problems.push(...urlProblems(file, label, url));
  };
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) check(`url(${match[2]})`, match[2]!.trim());
  for (const match of css.matchAll(/@import\s+(?:url\()?\s*(["']?)([^"')\s;]*)\1/g)) check(`@import ${match[2]}`, match[2]!);
  return problems;
}

function scanJs(file: string, js: string): string[] {
  const problems: string[] = [];
  if (/\bimport\s*\(/.test(js)) problems.push(`${file}: dynamic import(`);
  if (/import\.meta\.url/.test(js)) problems.push(`${file}: import.meta.url`);
  if (/\/_astro\//.test(js)) problems.push(`${file}: /_astro/ string`);
  for (const match of js.matchAll(/(?:\bimport|\bexport)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g)) {
    const specifier = match[1]!;
    // String escapes (`\x2e`, `\u002e`) would change the specifier: refuse any backslash.
    if (specifier.includes('\\')) problems.push(`${file}: import specifier "${specifier}" has a string escape`);
    else if (!specifier.startsWith('./') && !specifier.startsWith('../')) problems.push(`${file}: import specifier "${specifier}"`);
    else if (urlProblem(file, specifier)) problems.push(`${file}: import specifier "${specifier}" leaves the site folder`);
  }
  return problems;
}

/** Every problem in a built site; an empty list means it may be published. `buildPaths` are the
 * build's own paths (the staging folder, the working copy): none may appear in an output file.
 * Only these exact paths count, so catalogue text that mentions `.stackledger-tmp-*` is fine.
 * `mapCredit`: the map is drawn over a city, so its page may link the OpenStreetMap copyright page. */
export function scan(siteDir: string, buildPaths: readonly string[] = [], homeLinks: readonly string[] = [], mapCredit = false): string[] {
  const problems: string[] = [];
  for (const file of listFiles(siteDir)) {
    const text = readFileSync(join(siteDir, file), 'utf8');
    if (file.endsWith('.html')) problems.push(...scanHtml(file, text, homeLinks, mapCredit));
    else if (file.endsWith('.css')) problems.push(...scanCss(file, text));
    else if (file.endsWith('.js') || file.endsWith('.mjs')) problems.push(...scanJs(file, text));
    if (buildPaths.some(path => text.includes(path))) problems.push(`${file}: staging path in the output`);
  }
  return problems;
}
