## Context

The engine writes every map SVG with `width` and `height` equal to its viewBox size (`src/map/svg.ts`); the page overrides the width with `.map-canvas svg { width: 100%; height: auto }`. Both themed copies sit in `.map-frame`, a box with 1-pixel borders as wide as the page's content column (measured: 1320 pixels at a 1360-pixel window, the SVG 1318; 390 at a 390-pixel window, the SVG 388).

## Decisions

1. **CSS only.** `.map-canvas svg { width: auto; max-width: 100%; height: auto }`: with `width: auto` the browser uses the SVG's own `width` attribute (its drawn size), `max-width: 100%` shrinks it on a narrower page, and `height: auto` keeps the proportions. Alternatives: an inline `style="max-width: …px"` written by the build (refused: the site's CSP forbids inline styles), or a page script (refused: without JavaScript the map must still show correctly).
2. **Frame as wide as the map** (`.map-frame { width: fit-content; max-width: 100%; margin-inline: auto }`). Alternative A, the map centred in a full-width frame, leaves two bands of the page colour around the map; in the dark theme the navy map then sits between two grey bands. Both were drawn at 1360 pixels in both themes (contact sheet, gate 1). The owner decides at gate 1; this design assumes B.
3. **Zoom keeps working.** The page script changes only the viewBox (`site/src/scripts/map.ts`), and the pan reads the SVG's shown width, so neither depends on the frame's width.

## Test changes

New browser tests, one per new scenario, in `test/browser/site.spec.ts` and `test/browser/site-skills.spec.ts`. One existing test changes: "Map without JavaScript" (`site-skills.spec.ts`) also checks the map's width, because its scenario now says "at the size Skills map shown size gives". Two existing sentences change meaning and are modified in the deltas: catalogue-site "Map page" and skills-site "Map without JavaScript" said "at full size", which today means stretched to the frame.
