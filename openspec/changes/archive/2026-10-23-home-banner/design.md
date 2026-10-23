## Context

- The home (`site/src/pages/index.astro`) has a `.home-banner` section with the `h1` and the text on a tinted background, the division cards, then the `Links` list from `spec.site.home.links` (`src/schema.ts`, "Home settings"). Those links are the only URLs to other sites (site-security).
- The header (`site/src/components/Header.astro`) shows `favicon.svg`, the `ledgerMark` at size 32, as a decorative `img` before the title (AB#164). In dark it is a navy square on `#1C1C1C`.
- Light and dark variants of one thing are two elements with the classes `themed-light` and `themed-dark` (`site/src/styles/base.css`), switched by `data-theme` and `prefers-color-scheme`, as the map does with its two SVGs. The rule that shows `themed-dark` sets `display: block`.
- `@brunosouzas/design-system` 0.3.0 exports `coverTree(spec)` and `validateCoverSpec(spec)` (the banner format: 1200 × 420, `rx` from `banner.radius`, rings to the far corner, pieces clipped to the frame), `lineBadge` with an optional `text`, `linkIcon({ icon, x, y, size, surface })` (46 units by default) and `ledgerMark({ x, y, size, surface })`.

## Decisions

### 1. Static files from a script, checked by tests

`scripts/site-art.mjs` writes, from the installed package:

| File | Drawing |
| --- | --- |
| `site/public/home-banner.svg` | `toSvg(coverTree(spec))` of `scripts/home-banner.json` |
| `site/public/brand-mark-dark.svg` | `ledgerMark({ x: 0, y: 0, size: 32, surface: "dark" })` in a 32 × 32 SVG |
| `site/public/link-icons/<icon>-<surface>.svg` | `linkIcon({ icon, x: 0, y: 0, surface })` in a 46 × 46 SVG, for the four icons and both surfaces |

`favicon.svg` is written by the same script with today's call, and must come out byte-identical. A unit test per file compares its shapes with the piece's, as "Favicon is the mark" does; so a package bump that changes a drawing fails until the script is run again.

Rejected: drawing at build time in `src/site/build.ts`. It would run the cover rendering on every `stackledger build` for an image that never changes between catalogues; the files are also easier to review as SVG in the pull request.

Every written file is also checked for safety by a unit test: an `svg` root with the expected size, no `script`, `foreignObject`, `style` element or `style` attribute, no attribute starting with `on`, and no `href` or `url(…)` other than an internal `url(#id)`.

### 2. The banner spec

`scripts/home-banner.json` is a cover spec with `"format": "banner"`, `"background": "navy"`, the rings of spike B (`cx` 860, `cy` 210, radius 40) and its pieces: three pipes (width 24, casing 10) in `illustration.accent`, `color.healthy` and `color.transitional`; nine `stationMarker`s (`r` 20, `inkScale` 1.6, `surface` dark; seven stops, one interchange capsule from `[920, 120]` to `[920, 300]` and one `deprecated` stop at `[920, 210]`); three `lineBadge`s (height 34, width 54, no `text`). The `ledgerMark` box at the right end of spike B is left out. `validateCoverSpec` must return no problem; the script refuses to write otherwise. Its `title` and `description` say what the picture shows, in English, since they go into the SVG's `title` and `desc`.

### 3. Where the banner sits

In `.home-banner`, after the `h1` and the text: `<img class="home-banner-art" src="home-banner.svg" alt="" width="1200" height="420">`. CSS gives it `width: 100%` and `height: auto` within the container (1320 px at most), so the 1200 × 420 ratio holds at every width. One image for both themes: its navy background is the same in both. Decorative (`alt=""`): the title and text are the page's words.

### 4. Link icons

`icon` is optional on each link, one of the four names of `LINK_ICON_NAMES` in 0.3.0. It travels from `src/schema.ts` through `src/site/data.ts` (`HomeLink` gains `icon?`, and `siteSettings()` copies it as it copies `description`) to the page; the schema's enum is the only way a value reaches the `src` of an `img`, so no catalogue text becomes a path. With `icon`, the link's anchor starts with two `img` elements (`themed-light` and `themed-dark`, `alt=""`, 24 × 24 CSS pixels), then the title; the description stays after the anchor. Without `icon`, the link is drawn as today. The list of allowed names is the schema's own copy of the four names, so `stackledger validate` does not import the design system; a unit test checks it equals `LINK_ICON_NAMES`.

### 5. Dark header mark

The header holds two marks: `favicon.svg` with `themed-light`, `brand-mark-dark.svg` with `themed-dark`. To keep an image inline when shown, the rules that show `themed-light` and `themed-dark` use `display: revert` instead of `block`: a `div` reverts to block, an `img` to inline. The map's canvases are `div`s, so they look the same.

### 6. Images the site writes

"Brand mark" said the header mark is the only `img`. It becomes: the site's templates write `img` elements only for the header marks, the home banner and the link icons, all from the site's own folder with `alt=""`. The tests use one allow-list of those images: an `img` is the site's own when its class is `brand-mark`, `home-banner-art` or `link-icon`, its `alt` is empty, it has no other attribute than `class`, `src`, `alt`, `width` and `height`, and its `src` ends in `favicon.svg`, `brand-mark-dark.svg`, `home-banner.svg` or `link-icons/<icon>-<light|dark>.svg`. "Description with HTML" removes those and finds no other `img` on any page.

### 7. Example

`examples/northwind` stays as it is. Changed during implementation: the integration tests read the example's home for the default text ("Home text") and append their own `site:` block to its `stackledger.yaml` ("Two links"), so a `site.home` in the example would break them. The README screenshot is built from a throwaway copy of the example with a fictitious text and three links on `example.com` hosts, two with icons; the icon tests use their own catalogues (`test/integration/site.test.ts`) and the extra catalogue of `test/browser/serve.mjs`. No real URL enters the repository.

## Risks

- **Cover code in the published package.** The map modules already import the package's root entry, which loads its cover module; this change adds no runtime call to it. Only `scripts/site-art.mjs` and the tests call `coverTree`. `scripts/home-banner.json` and `scripts/site-art.mjs` stay out of the published files (`package.json` `files` and `scripts/pack-production.mjs` ship `site/` but not `scripts/`); a package test checks that the packed files hold the new SVGs in `site/public/` and nothing from `scripts/`.
- **Package bumps.** A design system version that redraws a link icon or the banner makes the tests fail until the script runs; that is the intent.

## Test changes

| Test | File | Change |
| --- | --- | --- |
| Header mark with a custom title, Site title, Default title | `test/integration/site.test.ts` | the brand link now holds two marks (light and dark) before the title |
| Default title (Skills pages) | `test/integration/site-skills.test.ts` | same |
| Description with HTML | `test/integration/site-skills.test.ts` | removes the site's own images by the allow-list of §6, not only the brand mark |
| Map canvases and symbols in both themes | `test/browser/site.spec.ts` (existing theme tests) | must still pass with `display: revert`; a check that the map canvas and a legend symbol are block-level in both themes, by system preference and by the switch |
| Two links | `test/integration/site.test.ts` | unchanged: links without `icon` keep today's markup |
