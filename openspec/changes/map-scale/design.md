## Context

The engine writes every map SVG with `width` and `height` equal to its viewBox size (`src/map/svg.ts`); the page overrides the width with `.map-canvas svg { width: 100%; height: auto }`. Both themed copies sit in `.map-frame`, a bordered box as wide as the page container (1320 pixels at most).

## Decisions

1. **CSS only.** `.map-canvas svg { width: auto; max-width: 100%; height: auto }`: with `width: auto` the browser uses the SVG's own `width` attribute (its drawn size), `max-width: 100%` shrinks it on a narrower page, and `height: auto` keeps the proportions. Alternatives: an inline `style="max-width: …px"` written by the build (refused: the site's CSP forbids inline styles), or a page script (refused: without JavaScript the map must still show correctly).
2. **Frame as wide as the map** (`.map-frame { width: fit-content; max-width: 100%; margin-inline: auto }`). Alternative A, the map centred in a full-width frame, leaves two bands of the page colour around the map; in the dark theme the navy map then sits between two grey bands. Both were drawn at 1360 pixels in both themes (contact sheet, gate 1). The owner decides at gate 1; this design assumes B.
3. **Zoom keeps working.** The page script changes only the viewBox (`site/src/scripts/map.ts`), and the pan reads the SVG's shown width, so neither depends on the frame's width.

## Test changes

No existing test changes. New browser tests, one per scenario, in `test/browser/site.spec.ts` (Map page) and `test/browser/site-skills.spec.ts` (Skills map page).
