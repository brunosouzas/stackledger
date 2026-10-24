## Scenario to test map

Levels: B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue-site, Map shown size | Map narrower than the page; Map wider than the page; Zoom keeps the shown size; Shown size without JavaScript | `test/browser/site.spec.ts` (describe "Map shown size"; the last one in a describe with JavaScript disabled) | B |
| catalogue-site, Map page (modified) | Zoom (unchanged, test "Zoom"); the modified "Without JavaScript" sentence is proven by "Shown size without JavaScript" | `test/browser/site.spec.ts` | B |
| skills-site, Skills map shown size | Skills map not enlarged; Same ink as the software map; Skills map just wider than the room; Skills map on a phone; Skills zoom keeps the shown size; Skills shown size without JavaScript | `test/browser/site-skills.spec.ts` (describe "Skills map shown size"; the last one with JavaScript disabled) | B |
| skills-site, Skills map page (modified) | Map without JavaScript: the existing test "Map without JavaScript" gains the width check of "Skills shown size without JavaScript"; the other five scenarios unchanged (tests "Station link", "Highlight a skill line", "Filter by a playbook zone", "No zone filter without zones", "No skill lines") | `test/browser/site-skills.spec.ts` | B |
| regression | "Pan", "The map and the full table are shown", "Pages work under the policy" (both files), unchanged, must still pass | as listed | B |

## 0. Evidence for gate 1

- [x] 0.1 Probe outside the branch: the example site built from `main`, served as files, with the candidate CSS injected by Playwright, measured at 390, 1360 and 1920 pixels in both themes (`~/.hermes/cache/scratch/ab178/shots/measure.json`: SVG width, viewBox width, gaps to the frame), and a contact sheet of today, A (centred in the full-width frame) and B (frame as wide as the map) (`~/.hermes/cache/scratch/ab178/contact-sheet.png`). Verify: at 1360 the frame is 1320 wide and the SVG 1318 (1-pixel borders); skills map 1.95 pixels per unit today, 1.00 in A and B; software map 0.976 in all.
- [ ] 0.2 Gate 1: the owner approves the spec and chooses A or B.

## 1. Tests first

- [ ] 1.1 Write the ten new browser tests of the table and the width check in "Map without JavaScript". Read each map's initial width from its `viewBox` attribute and the room from the frame's content box, never from fixed numbers. Verify: `npx playwright test -g "shown size|not enlarged|Same ink|on a phone|Map wider|Map narrower"` fails on the current CSS (the skills map is 1318 pixels wide at 1360; the frame is full width).

## 2. Stylesheet

- [ ] 2.1 `site/src/styles/pages.css`: `.map-canvas svg { display: block; width: auto; max-width: 100%; height: auto; }` and `.map-frame { width: fit-content; max-width: 100%; margin-inline: auto; }`. Verify: the new tests pass; `npm run test:browser` passes in full.
- [ ] 2.2 Check that the map SVGs are unchanged: `node dist/cli.js map examples/northwind --theme light --date 2027-06-01 | cmp - docs/images/map-light.svg` (and dark). Verify: no output.

## 3. Documentation

- [ ] 3.1 `docs/site.md`, Map row: the map is shown at most at its drawn size, in a frame as wide as the map, centred. Verify: `npm test` (docs tests) passes.
- [ ] 3.2 Archive the change in the same branch: `openspec archive map-scale -y`, then `openspec validate --all --strict`. Verify: all pass.
