## Scenario to test map

Levels: U unit, I integration (built files or CLI), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| metro-map | Pipe line; Shadow under an interchange; Dark shadow and rim; Light theme; Dark theme; Larger ink pushes a label out; Allowed names only; No embedded font | `test/unit/map-svg.test.ts` | U |
| metro-map | Labels do not collide in the example | `test/integration/map-example.test.ts` | I |
| catalogue-site | Neighbourhood boxes; Strip line and stops; Resource without a shadow | `test/unit/map-diagrams.test.ts` | U |
| catalogue-site | Accent override; Broken settings (unchanged tests) | `test/integration/site.test.ts` | I |
| catalogue-site | Lato shipped locally | `test/integration/site.test.ts` | I |

## 1. Theme data and the map

- [x] 1.1 Tests first: replace the test that asserts casing and shadow are off; add the metro-map scenarios above. Verify: they fail on `main`'s renderer.
- [x] 1.2 `src/map/themes.ts`: the new colours, `outlineWidth`, `rim`, `accent`, Lato stack, casing and shadow on; `inkOf(theme)`. Verify: `npm test`.
- [x] 1.3 `src/map/layout.ts` and `badges.ts`: obstacles grown by the ink; `src/map/svg.ts`: outlines, shadows, rims, pipe ticks. Callers pass `inkOf(theme)`. Verify: `npm test`, `npm run test:perf`.

## 2. Diagrams

- [x] 2.1 `src/map/neighbourhood.ts` and `strip.ts` in the ink style, with the catalogue-site scenarios as unit tests. Verify: `npm test`.

## 3. Font

- [x] 3.1 `@fontsource/lato` `5.3.0` pinned; `src/site/build.ts` copies Lato 400, 700 and 900; `site/src/styles/fonts.css` declares them. Verify: "Lato shipped locally" test, `npm run test:browser` (CSP), `npm audit` with 0 vulnerabilities.

## 4. Images and documentation

- [x] 4.1 Regenerate `docs/images/map-light.svg` and `map-dark.svg` with `stackledger map`, and the site screenshots; look at PNG renders of the map and diagrams in both themes and fix visible defects.
- [x] 4.2 `docs/map.md`, `docs/site.md`, `docs/roadmap.md` (item 8, In review), README, font credit. Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
