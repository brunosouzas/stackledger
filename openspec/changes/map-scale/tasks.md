## Scenario to test map

Levels: B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue-site, Map shown size | Map narrower than the page; Map wider than the page; Zoom keeps the shown size; Shown size without JavaScript | `test/browser/site.spec.ts` (describe "Map shown size") | B |
| skills-site, Skills map shown size | Skills map not enlarged; Same ink as the software map; Skills map on a phone | `test/browser/site-skills.spec.ts` (describe "Skills map shown size") | B |
| regression | catalogue-site "Zoom", "Pan" and "Map without JavaScript"; skills-site "Map without JavaScript"; "Pages work under the policy" (both files), unchanged, must still pass | as listed | B |

## 0. Evidence for gate 1

- [x] 0.1 Probe outside the branch: the built example site with the candidate CSS injected, measured at 390, 1360 and 1920 pixels in both themes (`~/.hermes/cache/scratch/ab178/shots/measure.json`), and a contact sheet of today, A (centred in the full-width frame) and B (frame as wide as the map) (`~/.hermes/cache/scratch/ab178/contact-sheet.png`). Verify: skills map 1.95 pixels per unit today, 1.00 in A and B; software map 0.98 in all.
- [ ] 0.2 Gate 1: the owner approves the spec and chooses A or B.

## 1. Tests first

- [ ] 1.1 Write the seven browser tests of the table. Verify: `npx playwright test -g "shown size|not enlarged|Same ink|on a phone|Map wider|Map narrower"` fails on the current CSS (the skills map is 1318 pixels wide at 1360; the frame is full width).

## 2. Stylesheet

- [ ] 2.1 `site/src/styles/pages.css`: `.map-canvas svg { display: block; width: auto; max-width: 100%; height: auto; }` and `.map-frame { width: fit-content; max-width: 100%; margin-inline: auto; }`. Verify: the seven tests pass; `npm run test:browser` passes in full.
- [ ] 2.2 Check that the map SVGs are unchanged: `node dist/cli.js map examples/northwind --theme light --date 2027-06-01 | cmp - docs/images/map-light.svg` (and dark). Verify: no output.

## 3. Documentation

- [ ] 3.1 `docs/site.md`, Map row: the map is shown at most at its drawn size, in a frame as wide as the map, centred. Verify: `npm test` (docs tests) passes.
- [ ] 3.2 Archive the change in the same branch: `openspec archive map-scale -y`, then `openspec validate --all --strict`. Verify: all pass.
