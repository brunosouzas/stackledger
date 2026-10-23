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
| `site/public/home-banner.svg` | `toSvg(coverTree(spec))` of `site/art/home-banner.json` |
| `site/public/brand-mark-dark.svg` | `ledgerMark({ x: 0, y: 0, size: 32, surface: "dark" })` in a 32 × 32 SVG |
| `site/public/link-icons/<icon>-<surface>.svg` | `linkIcon({ icon, x: 0, y: 0, surface })` in a 46 × 46 SVG, for the four icons and both surfaces |

`favicon.svg` is written by the same script with today's call, and must come out byte-identical. A unit test per file compares its shapes with the piece's, as "Favicon is the mark" does; so a package bump that changes a drawing fails until the script is run again.

Rejected: drawing at build time in `src/site/build.ts`. It would add the design system's cover code to every `stackledger build` for an image that never changes between catalogues; the files are also easier to review as SVG in the pull request.

### 2. The banner spec

`site/art/home-banner.json` is a cover spec with `"format": "banner"`, `"background": "navy"`, the rings of spike B (`cx` 860, `cy` 210, radius 40) and its pieces: three pipes (width 24, casing 10) in `illustration.accent`, `color.healthy` and `color.transitional`; ten `stationMarker`s (`r` 20, `inkScale` 1.6, `surface` dark, one interchange capsule and one `deprecated` stop); three `lineBadge`s (height 34, width 54, no `text`). The `ledgerMark` box at the right end of spike B is left out. `validateCoverSpec` must return no problem; the script refuses to write otherwise. Its `title` and `description` say what the picture shows, in English, since they go into the SVG's `title` and `desc`.

### 3. Where the banner sits

In `.home-banner`, after the `h1` and the text: `<img class="home-banner-art" src="home-banner.svg" alt="" width="1200" height="420">`. CSS gives it `width: 100%` and `height: auto` within the container (1320 px at most), so the 1200 × 420 ratio holds at every width. One image for both themes: its navy background is the same in both. Decorative (`alt=""`): the title and text are the page's words.

### 4. Link icons

`icon` is optional on each link, one of the four names of `LINK_ICON_NAMES` in 0.3.0. With `icon`, the link's anchor starts with two `img` elements (`themed-light` and `themed-dark`, `alt=""`, 24 × 24 CSS pixels), then the title; the description stays after the anchor. Without `icon`, the link is drawn as today. The list of allowed names is the schema's own copy of the four names, so `stackledger validate` does not import the design system; a unit test checks it equals `LINK_ICON_NAMES`.

### 5. Dark header mark

The header holds two marks: `favicon.svg` with `themed-light`, `brand-mark-dark.svg` with `themed-dark`. To keep an image inline when shown, the rules that show `themed-light` and `themed-dark` use `display: revert` instead of `block`: a `div` reverts to block, an `img` to inline. The map's canvases are `div`s, so they look the same.

### 6. Images the site writes

"Brand mark" said the header mark is the only `img`. It becomes: the site's templates write `img` elements only for the header marks, the home banner and the link icons, all from the site's own folder with `alt=""`. "Description with HTML" (skills-site) checks that a hostile description adds no `img`: it now ignores those with the class `brand-mark`, as it ignores the header mark today.

### 7. Example

`examples/northwind/stackledger.yaml` gets `spec.site.home` with a fictitious text and three links on `example.com` hosts, two with icons (`github`, `website`), so the README screenshot shows the feature. No real URL enters the repository.

## Risks

- **Cover code in the published package.** Only `scripts/site-art.mjs` and the tests import `coverTree`; the CLI does not, so `stackledger build` loads nothing new.
- **Package bumps.** A design system version that redraws a link icon or the banner makes the tests fail until the script runs; that is the intent.

## Test changes

| Test | File | Change |
| --- | --- | --- |
| Header mark with a custom title, Site title, Default title | `test/integration/site.test.ts` | the brand link now holds two marks (light and dark) before the title |
| Default title (Skills pages) | `test/integration/site-skills.test.ts` | same |
| Description with HTML | `test/integration/site-skills.test.ts` | ignores the site's own images by class, not only the brand mark |
| Two links | `test/integration/site.test.ts` | unchanged: links without `icon` keep today's markup |
