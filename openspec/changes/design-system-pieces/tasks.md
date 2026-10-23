## Scenario to test map

Levels: U unit, I integration (built site), B browser (Playwright). Every new or changed scenario has one test named after it. Tests that change are listed in design "Test changes".

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| metro-map | Halo drawn by the piece; Zone drawn by the piece; One-station zone; Held licence is green; Licence to buy is white; Ring drawn by the piece; Legend symbols drawn by the pieces; Far symbols drawn by the pieces; Custom piece colour is refused; Other theme fields stay free (changed); Custom ink is refused, Suggested interchange, Zone area, Active and to-buy, Renewal soon in full, Staff ignores hidden fields and the date (unchanged) | `test/unit/map-svg.test.ts` | U |
| metro-map | Piece colours are the tokens; Light zone titles are not tinted | `test/unit/map-svg.test.ts`, next to "Theme values are the tokens" | U |
| metro-map | `renderNeighbourhood` part of Custom piece colour is refused | `test/unit/map-diagrams.test.ts` | U |
| catalogue-site | Resource without a page (changed, drawing part in "Resource without a shadow"; text-list part unchanged in `test/integration/site.test.ts`); Empty column keeps no subtitle | `test/unit/map-diagrams.test.ts` | U |
| catalogue-site | Icon is the design system's | `test/unit/site-icons.test.ts` (new) | U |
| catalogue-site | Zoom buttons with icons; Calendar button with an icon; Interface icons are inert; No icon from catalogue text | `test/integration/site.test.ts`, `/skill-map/` part in `test/integration/site-skills.test.ts` | I |
| catalogue-site | Icon follows the button colour; Theme switch icons; Zoom (unchanged) | `test/browser/site.spec.ts` | B |
| metro-map | Map symbols drawn by the pieces, Piece colours in the themes: "Map symbols drawn by the pieces" refuses an out-of-rule node through the existing "Piece node outside the allow-list" test of the shared writer | `test/unit/map-svg.test.ts` | U |
| metro-map | Example map and SVG heroes (unchanged; images regenerated) | `test/integration/map-example.test.ts` | I |

## 0. Evidence for gate 1

- [x] 0.1 Prototype outside the branch: Northwind map details, legend symbols, a neighbourhood diagram with a placeholder, the zoom and calendar buttons (rest and hover) and the theme switch, before and after, in light and dark, in one contact sheet. Verify: sheet looked at; shown to the owner (2026-10-23).
- [x] 0.2 Owner decisions (2026-10-23): green licence, the four fields in `checkInk`, inline icons with `currentColor`, no `calendar`.
- [ ] 0.3 Spec review by Codex (at most 2 rounds) and gate 1 on this spec.

## 1. Dependency

- [ ] 1.1 Pin `@brunosouzas/design-system` 0.3.1, exact, production; refresh `npm-shrinkwrap.json`; own commit. Verify: `npm ls @brunosouzas/design-system`, `npm test` unchanged (0.3.0 calls draw byte-identically).

## 2. Map pieces and theme

- [ ] 2.1 Tests first: the metro-map scenarios of the table, and the changed "Other theme fields stay free". Verify: the new ones fail.
- [ ] 2.2 `src/map/themes.ts` (fields from tokens, `checkInk`), `src/map/svg.ts` (design §1), remove unused helpers. Verify: `npm run build && npm test`.

## 3. Neighbourhood placeholder

- [ ] 3.1 Tests first: "Resource without a shadow" (changed), "Empty column keeps no subtitle". Verify: the changed one fails.
- [ ] 3.2 `src/map/neighbourhood.ts` (design §3). Verify: `npm test`.

## 4. Interface icons

- [ ] 4.1 Tests first: the catalogue-site icon scenarios of the table. Verify: they fail.
- [ ] 4.2 `src/site/ui-icons.ts`, `src/site/data.ts` (`icons`), the map, skill map and reports pages, `ThemeSwitch.astro`, `base.css` (design §4). Verify: `npm run build && npm test`, `npm run test:browser`.

## 5. Images and docs

- [ ] 5.1 Regenerate `docs/images/map-light.svg` and `map-dark.svg` with the commands of `docs/map.md`, and the README screenshots that show a licence marker, a zoom button, the calendar button or the theme switch, through the throwaway copy of the example (`readme-cat`), without touching `examples/`. Look at each in both themes and show the owner before the pull request is ready. Verify: images opened and checked; `test/integration/map-example.test.ts` passes.
- [ ] 5.2 `docs/map.md` (green disc; the ring's colour), `docs/site.md` (icons), `docs/roadmap.md` if it names this work. Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
- [ ] 5.3 Code review by Codex (at most 2 rounds), then `openspec archive design-system-pieces`. Verify: `openspec validate --all --strict --no-interactive` after the archive.
