## Why

The owner decided on 2026-10-21 that v1 ships with the map and the page diagrams in the illustrated style of brunosouzas.com: thick ink outlines, hard offset shadows, "pipe" lines with an ink casing, a tinted panel and the Lato font stack. Today the map is flat, its casing and shadow hooks are off, and the diagrams use a system font.

## What Changes

- The `light` and `dark` themes get the new look as Theme data; theme names and CLI options stay the same.
- Lines are drawn as pipes: an ink casing with the catalogue colour inside.
- Stations, interchanges, terminal badges, licence markers, renewal rings and the legend panel get an ink outline and a hard offset shadow: an ink copy shifted down and right in `light`, an indigo copy with a light rim in `dark`. Shadows are offset geometry, never `transform` or `filter`.
- The map background is the tinted panel `#EEF2FF` (`light`) or navy `#14215A` (`dark`); labels are bold, in `Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif`.
- Label and badge placement count the casing, outline and shadow of markers, badges and segments as obstacles.
- The neighbourhood and strip diagrams use the same style.
- The site ships Lato from the pinned `@fontsource/lato` package, copied locally like Heebo and Signika. Standalone `stackledger map` SVGs name the font stack and embed no font.

Out of scope: a third theme or a theme option, icons and line badges redrawn as illustrations, the concentric rings of the reference panels (they need a `clipPath`, which the allow-list forbids), city backgrounds, changes to the site pages' own colours and fonts, and the badge text colour (white on the line colour, as today).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metro-map`: Themes, Label placement and Safe SVG structure change; one requirement is added for the ink outline and offset shadow.
- `catalogue-site`: Look and theme names Lato for the diagrams; one requirement is added for the diagram style.

## Impact

- `src/map/themes.ts`, `svg.ts`, `layout.ts`, `badges.ts`, `neighbourhood.ts`, `strip.ts`; `src/site/build.ts` (font files), `site/src/styles/fonts.css`.
- `package.json`: new dependency `@fontsource/lato` `5.3.0`, pinned exactly (owner approved).
- `layoutMap` takes an optional third argument with the ink extents; existing calls keep working and default to the `light` theme's extents.
- Regenerated `docs/images/map-light.svg`, `map-dark.svg` and the site screenshots.

## Implicit requirements

- Errors and invalid input: unchanged; a colour in Theme data is validated like any paint and an invalid one throws.
- Limits: the performance limits of the map stay as specified; the timing test proves it.
- Repetition and idempotency: the same input still gives byte-identical SVG (Determinism requirement, unchanged).
- Concurrency: n/a, pure functions.
- Security: the element and attribute allow-lists, escaping and the CSP are unchanged; the font is served from the site's own files (`font-src 'self'`).
- Logs and observability: n/a, rendering prints nothing.

## Documentation

`docs/map.md` (themes), `docs/site.md` (fonts), `docs/roadmap.md` (`map-theme-ink` moves into v1 as item 8), README screenshots, the font credit in `site/src/styles/fonts.css`.
