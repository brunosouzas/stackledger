#!/usr/bin/env node
/**
 * Spike build for the catalogue-site change (task 0.1). Throwaway code.
 *
 * What: builds the tiny Astro site in ./site twice, as the `staff` and `full`
 * views with different (fictional) data, into <out>/staff/ and <out>/full/.
 * Why: proves the design's workarounds before the real pages are built:
 *   D2  Astro runs from a copy of site/ inside <out>/.stackledger-tmp-<rand>/,
 *       every cache in staging and telemetry off, through Astro's programmatic
 *       build() API; bare imports resolve from the package through a Vite
 *       plugin (SPIKE_LINK=1 uses the node_modules link of the design instead);
 *   D3  root-absolute /_astro/ URLs are rewritten to relative ones, then a
 *       scan fails the build on any URL form we do not handle;
 *   D4  every page carries the same CSP meta and no inline code.
 * Run: node build.mjs --out <folder> [--list-writes]
 *   --list-writes prints every path under the staging folder before it is
 *   removed, so the report can list what Astro and Vite wrote.
 * Switches: SPIKE_LINK=1 links work-<view>/node_modules to the package's.
 * Debug switches: SPIKE_NO_REWRITE=1 skips the rewrite (the scan then lists
 * Astro's raw URLs); SPIKE_NEGATIVE=1 adds ./negative/ to the working copy, a
 * page with inline code and bad URLs the scan must reject.
 * What can go wrong: an Astro/Vite upgrade that emits a new URL form fails the
 * scan (on purpose); a non-empty <out>/staff or <out>/full is replaced.
 */
import { createRequire } from 'node:module';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Telemetry must be off before Astro is loaded.
process.env.ASTRO_TELEMETRY_DISABLED = '1';

const spikeDir = dirname(fileURLToPath(import.meta.url));
const siteSource = join(spikeDir, 'site');
const require = createRequire(import.meta.url);
// The package's node_modules: the folder that holds `astro` as resolved from here.
const packageNodeModules = dirname(dirname(require.resolve('astro/package.json')));
// No node_modules link in the working copy: a resolver plugin instead, because the
// Node.js permission model refuses fs.symlink unless read and write are both
// unrestricted (ERR_ACCESS_DENIED), which the sandboxed-build scenario forbids.
// The resolver plugin is the default; SPIKE_LINK=1 restores the link of design D2.
const USE_LINK = process.env.SPIKE_LINK === '1';
const fontFiles = [
  ['@fontsource/heebo', 'heebo-latin-400-normal.woff2'],
  ['@fontsource/signika', 'signika-latin-400-normal.woff2'],
];

export const POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

// Fictional Northwind data. The staff view omits the cost, as the real staff view would.
const viewData = {
  staff: { view: 'staff', title: 'Northwind software', items: [{ name: 'Northwind Editor' }, { name: 'Northwind Mail' }] },
  full: { view: 'full', title: 'Northwind software', items: [{ name: 'Northwind Editor', cost: 98765 }, { name: 'Northwind Mail', cost: 120 }] },
};

function parseArgs(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex < 0 || !argv[outIndex + 1]) throw new Error('usage: node build.mjs --out <folder> [--list-writes]');
  return { out: resolve(argv[outIndex + 1]), listWrites: argv.includes('--list-writes') };
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files.sort();
}

/** Lists paths under the staging folder without following the node_modules link. */
function listTree(dir, base = dir) {
  const lines = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    const rel = relative(base, full);
    if (entry.isSymbolicLink()) lines.push(`${rel} -> (symlink)`);
    else if (entry.isDirectory()) lines.push(...listTree(full, base));
    else lines.push(`${rel} (${lstatSync(full).size} B)`);
  }
  return lines;
}

function makeWritable(dir) {
  chmodSync(dir, 0o755);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) makeWritable(full);
    else if (entry.isFile()) chmodSync(full, 0o644);
  }
}

/** Prepares the working copy for one view: site copy, data file, fonts, optional link (D2). */
function prepareWorkingCopy(staging, view) {
  const work = join(staging, `work-${view}`);
  cpSync(siteSource, work, { recursive: true });
  // cpSync keeps the source modes: from a read-only install the copy is read-only
  // too, so Astro cannot write .astro/ and the staging folder cannot be removed.
  makeWritable(work);
  mkdirSync(join(work, 'src', 'data'), { recursive: true });
  writeFileSync(join(work, 'src', 'data', 'site.json'), JSON.stringify(viewData[view], null, 2) + '\n');
  mkdirSync(join(work, 'src', 'fonts'), { recursive: true });
  for (const [pkg, file] of fontFiles) {
    cpSync(require.resolve(`${pkg}/files/${file}`), join(work, 'src', 'fonts', file));
  }
  // Negative control: add a page with every URL form and inline code the scan must reject.
  if (process.env.SPIKE_NEGATIVE === '1') cpSync(join(spikeDir, 'negative'), join(work, 'src'), { recursive: true });
  if (USE_LINK) symlinkSync(packageNodeModules, join(work, 'node_modules'), 'dir');
  return work;
}

/**
 * Vite plugin used instead of the node_modules link: resolves bare imports that
 * fail from the working copy as if they were imported from this script, so they
 * come from the package's own dependency tree. Vite only resolves from an
 * importer that exists on disk, hence this file as the importer.
 * Side effect: Vite's client dep optimizer, which resolves Astro's hard-coded
 * dev-toolbar includes from the root without plugins, warns that it cannot
 * resolve them. Harmless in a build (nothing is optimised for output).
 */
function packageResolver() {
  const thisFile = fileURLToPath(import.meta.url);
  return {
    name: 'stackledger-spike:package-resolver',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0') || source.includes(':')) return null;
      const own = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (own) return own;
      return this.resolve(source, thisFile, { ...options, skipSelf: true });
    },
  };
}

/** The Astro config of D2, passed inline (no config file is read). */
function astroConfig(staging, view, work) {
  return {
    root: work,
    configFile: false,
    mode: 'production',
    // 'error': the build report on stderr is specified line by line, so Astro's
    // info lines and Vite's dep-optimizer warnings (see packageResolver) stay out.
    logLevel: 'error',
    output: 'static',
    trailingSlash: 'always',
    // outDir sits inside the working copy (moved to staging/site-<view>/ after the
    // build): Astro writes its prerender bundle to <outDir>/.prerender/ only when
    // outDir is inside process.cwd(), and the build runs with cwd = working copy.
    outDir: join(work, 'dist'),
    cacheDir: join(staging, `cache-${view}`, 'astro'),
    integrations: [],
    devToolbar: { enabled: false },
    prefetch: false,
    build: { format: 'directory', inlineStylesheets: 'never' },
    vite: {
      cacheDir: join(staging, `cache-${view}`, 'vite'),
      build: { assetsInlineLimit: 0, modulePreload: false },
      // Bundle Astro's own dependencies into the prerender bundle, which Node then
      // imports to render the pages. Left external, they resolve from the top of
      // the installed tree (or fail without the link), where another package may
      // have hoisted a different major (stackledger: cookie 0.7 for the MCP SDK's
      // express vs cookie 2 for Astro: "Named export 'parseCookie' not found").
      ssr: { noExternal: true },
      environments: { prerender: { resolve: { noExternal: true } } },
      plugins: USE_LINK ? [] : [packageResolver()],
    },
  };
}

const ROOT_ASTRO = /\/_astro\//;

/** Rewrites /_astro/... in HTML URL attributes and CSS url()/@import into relative paths (D3). */
export function relativise(siteDir) {
  for (const file of walk(siteDir)) {
    const rel = relative(siteDir, file).split(sep).join('/');
    const fromDir = posix.dirname(rel);
    const toRelative = (url) => {
      const target = url.slice(1); // drop the leading '/'
      const result = posix.relative(fromDir, target);
      return result || './';
    };
    if (file.endsWith('.html')) {
      let html = readFileSync(file, 'utf8');
      html = html.replace(/\b(href|src|action|formaction|poster|data)=("|')(\/_astro\/[^"']*)\2/g, (_, attr, q, url) => `${attr}=${q}${toRelative(url)}${q}`);
      html = html.replace(/\bsrcset=("|')([^"']*)\1/g, (_, q, value) => `srcset=${q}${value.split(',').map((part) => part.trim().replace(/^\/_astro\/\S*/, (u) => toRelative(u))).join(', ')}${q}`);
      writeFileSync(file, html);
    } else if (file.endsWith('.css')) {
      let css = readFileSync(file, 'utf8');
      css = css.replace(/url\(\s*(["']?)(\/_astro\/[^"')]*)\1\s*\)/g, (_, q, url) => `url(${q}${toRelative(url)}${q})`);
      css = css.replace(/@import\s+(["'])(\/_astro\/[^"']*)\1/g, (_, q, url) => `@import ${q}${toRelative(url)}${q}`);
      writeFileSync(file, css);
    }
  }
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const badUrl = (value) => value.startsWith('/') || SCHEME.test(value);

/** Fails on any URL form the rewrite does not handle, inline code or a missing/different CSP (D3, D4). */
export function scan(siteDir) {
  const problems = [];
  for (const file of walk(siteDir)) {
    const rel = relative(siteDir, file);
    const text = readFileSync(file, 'utf8');
    if (file.endsWith('.html')) {
      for (const m of text.matchAll(/\s(href|src|action|formaction|poster|data|xlink:href)=("|')([^"']*)\2/g)) {
        if (badUrl(m[3])) problems.push(`${rel}: ${m[1]}="${m[3]}"`);
      }
      for (const m of text.matchAll(/\ssrcset=("|')([^"']*)\1/g)) {
        for (const part of m[2].split(',')) if (badUrl(part.trim())) problems.push(`${rel}: srcset part "${part.trim()}"`);
      }
      for (const m of text.matchAll(/<script\b([^>]*)>/g)) if (!/\ssrc=/.test(m[1])) problems.push(`${rel}: inline <script${m[1]}>`);
      if (/<style\b/i.test(text)) problems.push(`${rel}: <style> element`);
      if (/\sstyle=/i.test(text)) problems.push(`${rel}: style attribute`);
      if (/\son[a-z]+=/i.test(text)) problems.push(`${rel}: event-handler attribute`);
      const policies = [...text.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/g)].map((m) => m[1].replaceAll('&#39;', "'"));
      if (policies.length !== 1 || policies[0] !== POLICY) problems.push(`${rel}: CSP meta ${JSON.stringify(policies)}`);
    } else if (file.endsWith('.css')) {
      for (const m of text.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) if (badUrl(m[2].trim())) problems.push(`${rel}: url(${m[2]})`);
      for (const m of text.matchAll(/@import\s+(?:url\()?\s*(["'])([^"']*)\1/g)) if (badUrl(m[2])) problems.push(`${rel}: @import ${m[2]}`);
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      if (/\bimport\s*\(/.test(text)) problems.push(`${rel}: dynamic import(`);
      if (/import\.meta\.url/.test(text)) problems.push(`${rel}: import.meta.url`);
      if (ROOT_ASTRO.test(text)) problems.push(`${rel}: /_astro/ string`);
      for (const m of text.matchAll(/(?:\bimport|\bexport)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g)) {
        if (!m[1].startsWith('./') && !m[1].startsWith('../')) problems.push(`${rel}: import specifier "${m[1]}"`);
      }
    }
    if (text.includes('.stackledger-tmp-')) problems.push(`${rel}: staging path leaked into output`);
  }
  return problems;
}

async function main() {
  const { out, listWrites } = parseArgs(process.argv.slice(2));
  mkdirSync(out, { recursive: true });
  const staging = mkdtempSync(join(out, '.stackledger-tmp-'));
  const { build } = await import('astro');
  const timings = {};
  try {
    for (const view of ['staff', 'full']) {
      const started = performance.now();
      const work = prepareWorkingCopy(staging, view);
      // Astro writes its prerender bundle to <outDir>/.prerender/ only when outDir
      // is inside process.cwd(); otherwise it falls back to <cwd>/.astro/.prerender/
      // (astro/dist/core/build/common.js getOutDirWithinCwd). So build from the
      // working copy.
      const previousCwd = process.cwd();
      process.chdir(work);
      try {
        await build(astroConfig(staging, view, work));
      } finally {
        process.chdir(previousCwd);
      }
      const siteDir = join(staging, `site-${view}`);
      renameSync(join(work, 'dist'), siteDir);
      // SPIKE_NO_REWRITE=1 shows what Astro emits before D3's rewrite.
      if (process.env.SPIKE_NO_REWRITE !== '1') relativise(siteDir);
      const problems = scan(siteDir);
      if (problems.length > 0) throw new Error(`scan failed for ${view}:\n  ${problems.join('\n  ')}`);
      timings[view] = Math.round(performance.now() - started);
    }
    if (listWrites) {
      console.log(`--- paths written under ${staging}`);
      for (const line of listTree(staging)) console.log(line);
    }
    for (const view of ['staff', 'full']) {
      rmSync(join(out, view), { recursive: true, force: true });
      renameSync(join(staging, `site-${view}`), join(out, view));
    }
  } finally {
    // A failed removal must not hide the build error that got us here.
    try {
      rmSync(staging, { recursive: true, force: true });
    } catch (error) {
      console.error(`warning: could not remove ${staging}: ${error.message}`);
    }
  }
  console.log(`built staff in ${timings.staff} ms, full in ${timings.full} ms`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
