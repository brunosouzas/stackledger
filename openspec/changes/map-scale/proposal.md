## Why

The map pages stretch every map to the width of the page (`.map-canvas svg { width: 100% }` in `site/src/styles/pages.css`). A map drawn narrower than the page is therefore enlarged: on a 1360-pixel screen the example skills map (viewBox 675.6 units wide) shows at 1.95 pixels per unit, while the example software map (1350 units) shows at 0.98. The same pipes, outlines and labels look about twice as thick on the skills map (AB#178). The owner wants both maps to show the same ink thickness.

## What Changes

- **A map is never enlarged.** The software map page and the skills map page show the map at most at its drawn size, one viewBox unit per CSS pixel, keeping its proportions; it is smaller only when the page is narrower. A map wider than the page still fills it, as today.
- **The frame follows the map.** The map's frame is as wide as the shown map and centred on the page, so a small map does not sit in a wide empty box.
- **Zoom and pan unchanged.** They change the viewBox, so the map's size on the page stays the same while zooming and panning, as today.
- Pure CSS in `site/src/styles/pages.css`: no inline style (the site's fixed CSP stays as it is), no new attribute, no change to the map engine or its SVG.

Out of scope:

- the phone width: on a page narrower than both maps, both shrink to fit, so their scales still differ (0.29 and 0.57 pixels per unit at 390 pixels); equal thickness there would mean a horizontal scroll on the software map;
- the component and relation diagrams, which are drawn 1,200 units wide with their own ink scale;
- the map engine, the drawn SVG and the README images (unchanged byte for byte).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue-site`: "Map shown size" added.
- `skills-site`: "Skills map shown size" added.

## Implicit requirements

- Errors and invalid input: n/a, the change is CSS only; a map SVG always carries its `width` from the engine.
- Limits: a map wider than the frame shrinks to fit (scenario "Map wider than the page"); there is no lower limit, as today.
- Repetition and idempotency: n/a, a stylesheet rule.
- Concurrency: n/a.
- Security: the site's fixed CSP is unchanged (no inline style); covered by the existing "Pages work under the policy" browser tests.
- Logs and observability: n/a.

## Impact

`site/src/styles/pages.css` (`.map-canvas svg`, `.map-frame`), the browser tests in `test/browser/site.spec.ts` and `test/browser/site-skills.spec.ts`, and `docs/site.md` (Map page row). The demo is rebuilt by hand at the next release, as today.

## Documentation

- `docs/site.md`: the Map row says the map is shown at most at its drawn size, centred.
- Vault `10-personal/projects/stackledger/`: changelog, roadmap (row 4i) and architecture, after the merge.
- No ADR: no project-wide decision.
