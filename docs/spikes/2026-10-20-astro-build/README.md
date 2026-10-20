# Spike: Astro build workarounds (catalogue-site task 0.1)

Date: 2026-10-20. Throwaway code; the real build is task 3 and 4 of `openspec/changes/catalogue-site`.

## Question

Do the workarounds of the design hold before pages are built?

- **D2**: Astro builds from a copy of a shipped `site/` folder inside `<out>/.stackledger-tmp-<random>/`, every cache in staging, telemetry off, through Astro's `build()` API, and writes nothing in the package, `$HOME` or the system temporary folder.
- **D3**: a post-build rewrite makes every `/_astro/...` URL relative, and a scan fails the build on any URL form it does not handle.
- **D4**: one fixed CSP `meta` on every page, no inline code, and the pages work under it.
- **Versions**: the `vite` override goes, an exact Astro 7.x that allows Node 22.12, Vite 8, Vitest 4.1.11.

## What is here

| File | What it does |
| --- | --- |
| `site/` | Tiny Astro project: `/` and `/software/editor/`, one layout with the CSP, a shared script chunk, a global CSS with two `@font-face` (Heebo, Signika), a scoped `<style>`, an inline SVG with `xmlns`. |
| `build.mjs` | Builds the `staff` view, then the `full` view (fictional Northwind data; `full` has a cost the staff site must not show) into `<out>/staff/` and `<out>/full/`. Implements D2, D3 and D4. |
| `negative/` | Negative control, copied in only with `SPIKE_NEGATIVE=1`: a page with every URL form and inline code the scan must reject. |
| `serve.mjs` | Static server for `<out>` on 127.0.0.1, so the sites are at `/full/` and `/staff/`. |
| `browser-check.mjs` | Playwright (Chromium): opens every page, records failed requests, requests outside the prefix, CSP violations, fonts, script, link navigation; plus a positive control. |
| `run-checks.sh` | Runs everything below from an `npm pack` tarball. |

Run: `npx playwright install chromium` once, then `sh docs/spikes/2026-10-20-astro-build/run-checks.sh <empty scratch folder> [node-22.12.0 binary]`.

## Results

Machine: Apple M3, macOS, Node 26.12.0 (and the official Node 22.12.0 binary, SHA-256 checked). Results below are from the final run, after the fixes listed under Gotchas.

**1. Read-only install, nothing written outside `--out`.** `npm pack` (604 KB), installed into a scratch folder (281 packages, 159 MB), then `chmod -R a-w` on the whole install. Build A ran with an empty fake `HOME` and `TMPDIR` and with the current directory inside the read-only install; build B with the real `HOME` and `TMPDIR`.

- Install tree: identical before and after (26,611-line manifest of paths and SHA-256), 0 files newer than the marker.
- Fake `HOME` and fake `TMPDIR`: still empty. Real `~/.astro`, `~/.config/astro`, `~/Library/Preferences/astro`: nothing newer than the marker; the existing `~/Library/Preferences/astro/config.json` is byte-identical. Nothing named astro, vite, rolldown or stackledger appeared in the system temporary folder.
- `<out>` holds only `full/` and `staff/` afterwards (the staging folder is removed).
- Build C under the Node permission model (`--permission --allow-fs-read=* --allow-fs-write=<out> --allow-addons --allow-child-process --allow-worker`): builds, byte-identical to A.
- Paths written in staging (listed by `--list-writes` before the staging folder is removed): `work-<view>/` (the copy of `site/`, plus `src/data/site.json`, `src/fonts/*.woff2`, and Astro's `.astro/content.d.ts` and `.astro/types.d.ts`), `cache-<view>/vite/deps/_metadata.json` and `package.json` (Vite's dep optimiser runs even in a build), and `site-<view>/` (the output). Astro also writes and then removes `work-<view>/dist/.prerender/` during the build. Astro's own `cacheDir` stays unused for this site.

**2. Output scan.** 0 root-absolute `/_astro/` references, 0 inline scripts, 0 `<style>` or `style=`, the same CSP on all 4 pages. Without the rewrite (`SPIKE_NO_REWRITE=1`) the scan reports the raw Astro output: `href="/_astro/…css"`, `src="/_astro/…js"` in every page and `url(/_astro/heebo…woff2)` in the CSS. With `SPIKE_NEGATIVE=1` it reports, and the build fails on: `https://`, `//` and root-absolute links, `is:inline` and `define:vars` scripts (as inline scripts), a `style` attribute, an `onclick` attribute, a dynamic `import(`, `import.meta.url` and the `/_astro/` URL Vite writes for it. The staging folder is removed after a failed build too.

**3. Browser.** Both sites served from one server at `/full/` and `/staff/`; every page opened in headless Chromium 156:

| Page | Failed requests | Outside prefix | CSP violations | Page errors | Fonts | Script ran, toggle works |
| --- | --- | --- | --- | --- | --- | --- |
| `/full/` | 0 | 0 | 0 | 0 | Heebo loaded, Signika loaded | yes, yes |
| `/full/software/editor/` | 0 | 0 | 0 | 0 | Heebo loaded, Signika unloaded (not used there) | yes, yes |
| `/staff/` | 0 | 0 | 0 | 0 | Heebo loaded, Signika loaded | yes, yes |
| `/staff/software/editor/` | 0 | 0 | 0 | 0 | Heebo loaded, Signika unloaded (not used there) | yes, yes |

Clicking the nav link from each page stays under the prefix. Positive control: setting a `style` attribute from script is reported as `style-src-attr`, so the violation listener works.

**4. Byte-identical output.** A (fake HOME), B (real HOME), C (permission model) and D (Node 22.12.0) produce identical trees (18 files), although each staging folder has a random name. The build with the `node_modules` link (an earlier run) is identical to the one with the resolver plugin. The staff site does not contain `98765`; the full site does.

**5. Timing.** About 0.3 to 0.9 s per site; 1.5 to 3.2 s wall time for the whole process (Node start, Astro import, both sites).

**Versions.** `astro@7.3.8` is the last 7.x whose `engines.node` is `>=22.12.0` (7.4.0 and 7.4.1 need `>=22.22.0`). With the `vite` override removed and one `npm dedupe`, the tree has a single `vite@8.3.4`, shared by Astro and Vitest 4.1.11. `npm ci`, `npm run build` and `npm test` (26 files, 298 tests) pass; `npm audit --omit=dev` and `npm audit`: 0 vulnerabilities. The spike build runs on Node 22.12.0 and its output is byte-identical to Node 26's.

## Verdict

| Workaround | Verdict | Evidence |
| --- | --- | --- |
| D2 working copy in staging | **Holds, with four changes** (below) | Checks 1 and 4; the read-only install and fake HOME prove no writes outside `--out`. |
| D2 `node_modules` link | **Does not hold for the sandboxed build**; replaced | Under the permission model `fs.symlink` fails: `ERR_ACCESS_DENIED: fs.symlink API requires full fs.read and fs.write permissions` (step C2). A Vite resolver plugin works instead, everywhere, with identical output. |
| D3 relative URLs | **Holds** | Check 2 and 3; the negative control proves the scan catches each unhandled form. |
| D4 fixed CSP | **Holds** | Same CSP on every page, no violation in Chromium, positive control fires. |
| Versions | **Holds** | Astro 7.3.8, one Vite 8.3.4, Vitest 4.1.11, Node 22.12.0 build. Needs `esbuild` as a pinned development dependency (below). |

Changes D2 needs:

1. **Run Astro with `process.cwd()` = the working copy, and `outDir` inside it** (`work-<view>/dist`, renamed to `site-<view>/` after the build). Astro writes its prerender bundle to `<outDir>/.prerender/` only when `outDir` is inside `process.cwd()`; otherwise it writes `<cwd>/.astro/.prerender/` (`getOutDirWithinCwd` in `astro/dist/core/build/common.js`). The first run of this spike wrote that folder into the repository root.
2. **Bundle every dependency into the prerender bundle**: `vite.ssr.noExternal: true` and `vite.environments.prerender.resolve.noExternal: true`. Node imports that bundle to render the pages; left external, `cookie` resolved to the hoisted `cookie@0.7.2` (from the MCP SDK's express) instead of Astro's `cookie@2.0.1`: `SyntaxError: Named export 'parseCookie' not found`.
3. **No `node_modules` link; a Vite `resolveId` plugin** (`enforce: 'pre'`) that resolves a bare import that fails from the working copy again with the build script as importer, so it comes from the package's own tree. Vite only resolves from an importer that exists on disk.
4. **Make the copy writable**: `cpSync` keeps the modes of a read-only install, so Astro cannot write `.astro/` and the staging folder cannot be removed (`ENOTEMPTY`).

## Gotchas

- Astro's `logLevel: 'error'` keeps its info lines and Vite's warnings off stderr, where the build report is specified line by line. Without the link, Vite's client dep optimiser warns that it cannot resolve Astro's hard-coded dev-toolbar includes (`astro > aria-query` and others); harmless in a build.
- `process.chdir` is per process and not allowed in worker threads. The real command can call it around `build()` (one build at a time), or run Astro in a child process with `cwd` set; tests that call the build in-process must restore the directory.
- A `<script>` placed in a page after the layout is emitted after `</html>`. Browsers accept it and it runs, but real pages should put their script inside the layout.
- Astro adds `data-astro-cid-*` attributes for scoped styles; scoped `<style>` blocks become CSS files, not inline styles.
- Vite 8 no longer installs esbuild. `test/integration/map.test.ts` runs `node_modules/.bin/esbuild`, so `esbuild@0.28.2` is now a pinned development dependency (0.28 matches Vite 8's optional peer range `^0.27 || ^0.28`; 0.25 does not).
- `npm install <tarball>` in a folder without `package.json` treats an ancestor folder as the project. The check script writes a `package.json` first.
- Fonts are `unloaded` on a page whose text does not use them; check the font the body uses, and that no font is in `error`.
- The dependency tree is larger than the design's estimate: 281 packages, 159 MB installed (with the MCP SDK and the rest of stackledger).
- Playwright's Chromium download (99 MiB) goes to `~/Library/Caches/ms-playwright`; that is test tooling, not the build.

## The configuration that works

Passed inline to `build()` from `astro` (no config file), with `process.env.ASTRO_TELEMETRY_DISABLED = '1'` set before Astro is imported, and `process.cwd()` = `work`:

```js
{
  root: work,                                   // <out>/.stackledger-tmp-<random>/work-<view>/
  configFile: false,
  mode: 'production',
  logLevel: 'error',
  output: 'static',
  trailingSlash: 'always',
  outDir: join(work, 'dist'),                    // renamed to staging/site-<view>/ afterwards
  cacheDir: join(staging, `cache-${view}`, 'astro'),
  integrations: [],
  devToolbar: { enabled: false },
  prefetch: false,
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: {
    cacheDir: join(staging, `cache-${view}`, 'vite'),
    build: { assetsInlineLimit: 0, modulePreload: false },
    ssr: { noExternal: true },
    environments: { prerender: { resolve: { noExternal: true } } },
    plugins: [packageResolver()],                // see build.mjs
  },
}
```

After each build: `relativise()` then `scan()` from `build.mjs`. Page links come from the layout's `href()` helper (`'../'.repeat(depth) + path`).

## Recommendation for the real build

Keep Astro. Update design D2 with the four changes above before task 3.3 and 4.1; keep this spike's negative control as a test of the scan (`test/integration/site.test.ts`), and the permission-model run as the `Sandboxed build` test.
