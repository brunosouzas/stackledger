# Design: identity v2

## 1. Font delivery (decided by the owner, Q2, Q2b, Q2c: "the same rule as brunosouzas.com")

| Option | Network at build | What reaches the page | Verdict |
|---|---|---|---|
| A. Astro Fonts API, Google provider (as brunosouzas.com) | yes | inline `<style>` | no: the build makes no network calls (`build-command`, Writes) |
| B. Astro Fonts API, **local provider**, its CSS served as a file of the site | no | a stylesheet file, preload links | **chosen**: the site's mechanism (Astro generates the faces, the fallback metrics and the preloads), within stackledger's security rules |
| B'. The same, with the inline `<style>` allowed by hash in the policy | no | inline `<style>` | rejected after review: renamed families, hashes per page depth, a policy shared between the two sites, and a proxy recipe that must drop its policy (AB#303 spec review r1) |
| C. `@fontsource` files in a hand-written `fonts.css` | no | a stylesheet file | rejected by the owner (Q2c): another way of loading the fonts than the site's |

Families, from `site.font.*` and `font.sans` of the package: Source Sans 3 400, 600, 700, 900 normal (text, labels, map, diagrams; 900 for map labels that use `font.weightHeavy`); Source Serif 4 700 normal and italic (headings, wordmark); Source Code Pro 400 normal (code). `preload` for Sans 400 normal and Serif 700 normal only. The fonts config lives in the build's Astro config (`astroConfig` in `src/site/build.ts`), one family per CSS variable: `--font-primary` (Sans), `--font-secondary` (Serif) and `--font-mono` (Code Pro), the names the site's CSS already reads; the `<Font>` components go in `Base.astro` after the CSP meta (after `<title>`), so the fonts link and the preloads come under the policy even with meta-only hosting. The colour variables stay in `tokens.css`; the three font variables now come from the font CSS (§2), so the main spec's "one stylesheet of variables" becomes "colours from `tokens.css`, fonts from the Fonts API". `tokens.css` drops its `--font-primary` and `--font-secondary` definitions: it loads after the fonts link, so a `--font-*` left there would override the Fonts API's `:root` (same specificity, later rule). Only `_astro/fonts.css` defines `--font-*`. `base.css` sets `font-family: var(--font-mono)` on `code`, the only one of `code`, `pre` and `kbd` the site uses; today nothing applies `--font-mono`. The files come from `@fontsource/source-sans-3`, `@fontsource/source-serif-4` and `@fontsource/source-code-pro` (exact 5.3.1, OFL 1.1; the design system ships only the TTFs it embeds in SVGs). The build copies them into the working copy's `src/fonts/`, as today, and the local provider names them by paths relative to the project root (`./src/fonts/<file>`).

**Determinism.** Astro names each family `<name>-<hash>` (for example `Source Sans 3-4235479e6dd7653f`), the hash computed from the family's config. With root-relative paths the name, the CSS and the pages are byte-identical across two builds from different staging folders (probe: two builds, identical `index.html`); with absolute paths the name would change with the install path. Astro also names the font files by a hash of their contents. The proof is build-command "Built twice", which already builds into three `--out` folders, so three staging folders (`test/integration/build.test.ts`); no test of its own is added.

## 2. The font CSS as a file (no change to the security rules)

The Fonts API writes its CSS in inline `<style>` elements: per family, the `@font-face` rules of the faces and of the generated fallback, and a `:root` rule setting `--font-*` to the renamed family plus its fallbacks. These are identical on every page, with root-absolute `url("/_astro/fonts/<hash>.woff2")` values.

After the Astro build and before the existing scan, the build (`src/site/relative.ts`, which already rewrites every page) moves them out:

1. It takes the contents of every `<style>` element of the page, in order. Each must be one the Fonts API wrote, made only of:
   - `:root` blocks whose declarations are all `--font-*` custom properties;
   - `@font-face` blocks whose descriptors are among `font-family`; `src`, with `url(/_astro/fonts/<file>.woff2)`, `local("…")` and `format()` only; `font-display`, `font-weight`, `font-style`; `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`; `unicode-range`.

   Quoted strings are skipped when splitting blocks (`{`, `}`) and declarations (`;`, `:`): the Fonts API's fallback faces use `src:local("Arial")` and family names with `:` inside quotes (`"Source Sans 3-4235479e6dd7653f fallback: Arial"`). Anything else fails the build, as an inline style does today.
2. It writes their text, with each `url()` made relative to the stylesheet (`fonts/<file>.woff2`), into one file `_astro/fonts.css` of the site. Every HTML page of the site, in sorted path order, must yield the font CSS of the first one; a page that yields a different one, or none, fails the build naming it.
3. It replaces the elements with one `<link rel="stylesheet" href="<relative>/_astro/fonts.css">` where the first one was.

The policy, `_headers`, the proxy recipes and the "No inline code" rule stay as they are: the pages carry no inline style. The preload links Astro writes are rewritten to relative URLs as today. Astro's own `security.csp` stays off: it would add a second CSP meta, and the scan requires exactly one.

site-security "Escaped catalogue text" still holds without a delta: Astro's own `<Font>` component inserts its CSS raw (`<style set:html>`), but that CSS comes from the fonts config only, carries no catalogue value, and is moved to `_astro/fonts.css` before the scan. The `Themed.astro` comment "set:html is allowed only here" is updated to say so.

**Inline SVGs.** The map and the diagrams are inline SVGs that name `'Source Sans 3'` in their `font-family` attribute, the package's `font.sans`, which no longer matches the renamed face. A site rule sets `font-family: var(--font-primary)` on those SVGs. A CSS rule overrides a presentation attribute, so the page's text and the drawings use the same shipped face. A standalone SVG (`stackledger map` to stdout, the README images) keeps the plain names.

## 3. Colours

`tokens.css` reads `--ds-brand-<theme>-stackledger-accent` for `--color-accent` (light, dark and the prefers-color-scheme block); `spec.site.colors.accent` still overrides light. Frame: `--frame-outline` is `--ds-outline-small` solid `--ds-color-ink` in light and `--ds-surface-dark-muted` in dark; `--frame-shadow` and `--frame-pressed` go (their tokens are 0 and the rim width is 0). `--color-on-primary` reads the brand roles through `--ds-site-<theme>-body` (the button text over `primary`, which is the text colour since 0.8.0). In `src/map/themes.ts`: `color.state.*` for licence, renewal and accent; `header` is `color.ink` on light and `surface.dark.panel` on dark (ink vanishes on `#121110`, ADR 0009 of the design system); `font` is `tokens.font.sans` as is. CSS needs the quotes: an unquoted `Source Sans 3` is an invalid family name (it ends in a digit) and Chrome drops it (checked in headless Chrome 145). The map's writer already escapes `'` as `&apos;`, so the attribute stays safe XML; the allow-list of attribute values admits the apostrophe in `font-family`, and keeps admitting it, escaped, in attributes that already carry catalogue text (`data-zone`), as "Safe SVG text" allows.

## 4. Banner

`scripts/home-banner.json` becomes concept C as approved (the generator in `openspec/changes/identity-v2/approved/`), with the pipe fills `illustration.accent`, `brand.light.stackledgerAccent` and `color.ink`, the `ledgerMark` Folha at size 180, and Sinal at the end of the blue line. `site-art.mjs` builds it with the 0.8.1 package. Matching the approved preview was checked with the 0.8.1 branch build (pixel-identical through `<img>` in Chrome) and is checked once more on the release (§6.5).

## 5. Footer endorsement

`site-art.mjs` writes `site/public/symbol-light.svg` and `symbol-dark.svg` from the package's `symbol` piece on each surface. The footer shows them as decorative `img` elements (16 × 16), one per theme like the header mark, before "by Bruno Souza", with no link (site-security: no external URL outside the home links). `site-art.mjs` writes the same two files into `docs/images/`, and the README's endorsement line shows them as a `<picture>` (`<source media="(prefers-color-scheme: dark)" srcset="docs/images/symbol-dark.svg">` and an `img` of `docs/images/symbol-light.svg`, `alt=""`, 16 × 16) before "by Bruno Souza" (Q4: the symbol and "by Bruno Souza" in the footer and the README).

## 6. Resolutions taken while writing the spec deltas

The owner can veto any of these at G1.

1. **Font files.** See §1: the three `@fontsource` packages at 5.3.1 replace `heebo`, `lato` and `signika`; copied into the working copy and named by root-relative paths.
2. **The moved style.** See §2: only the Fonts API's `@font-face` and `:root { --font-* }` blocks can be moved; anything else in a `<style>` still fails the build.
3. **stackledger's own sticker code** (`src/map/ink.ts`, the legend panel): a shadow copy is drawn only when `map.shadow` > 0 (0 in the package, so none); on the dark surface the legend panel and stackledger's own outlines on the background take `surface.dark.muted` (ADR 0009 of the design system: ink vanishes on near-black). A line's casing stays ink: the design system's `pipe` draws it and takes no `surface`; the coloured line carries the reading on dark, as the AB#303 renders showed.
4. **Labels may move.** Without the shadow the ink around markers is smaller, so a label can take an earlier candidate position. The engine's logic does not change; recorded outputs (the 0.2.0 map fixtures, `docs/images/map-*.svg`) are re-recorded only after the owner has seen the before/after renders of the maps.
5. **Banner evidence.** Pixel equality with the approved preview is a one-time render task (evidence in the PR), not a test: the approved files stay in this change folder, which moves when archived. The permanent test stays "the banner file is `coverTree` of the spec".
6. **Endorsement mark.** Two themed images, `symbol-light.svg` and `symbol-dark.svg`, with the header mark's light/dark pattern; no SVG of the site carries a `<style>`.
