## Scenario to test map

Levels: U unit, I integration (built site), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| metro-map | Theme values are the tokens; Light theme has no rim | `test/unit/map-svg.test.ts` | U |
| metro-map | Stop drawn by the piece; Piece node outside the allow-list | `test/unit/map-pieces.test.ts` (new) | U |
| metro-map | Interchange; Stations are circles; Diagonal interchange contains every contact (unchanged tests, now over piece output); Legend interchange is a capsule | `test/unit/map-svg.test.ts` | U |
| metro-map | Shadow under an interchange (unchanged); Dark shadow and rim (`#EEF2FF`) | `test/unit/map-svg.test.ts` | U |
| metro-map | Example map (positions, not bytes); Software lines in a skills map file name and A cut label now wraps (unchanged) | `test/unit/map-svg.test.ts` | U |
| catalogue-site | Neighbourhood boxes, Strip line and stops, Terminal badge over an end interchange (unchanged); Edges point right; Strip interchange is a capsule; Resource without a shadow | `test/unit/map-diagrams.test.ts` | U |
| skills-site | Diagram of a skill; Long playbook name fits; Two playbooks that load each other and Shapes (unchanged) | `test/unit/skills-relations-diagram.test.ts` | U |
| catalogue-site | Favicon is the mark | `test/unit/site-brand.test.ts` (new) | U |
| catalogue-site | Header mark with a custom title; Palette from the design system (stylesheet part); Accent override, Broken settings, Lato shipped locally (unchanged) | `test/integration/site.test.ts` | I |
| catalogue-site | Card frame in light; Card frame in dark; Focus still visible; Palette from the design system (computed background) | `test/browser/site.spec.ts` | B |

## 1. Dependency and tokens

- [ ] 1.1 Add `@brunosouzas/design-system` `0.1.0` as an exact production dependency and refresh `npm-shrinkwrap.json`. Verify: `npm ls @brunosouzas/design-system` shows `0.1.0`; `test/unit/package-metadata.test.ts` and the package tests pass.
- [ ] 1.2 Tests first: "Theme values are the tokens", "Light theme has no rim", "Dark shadow and rim" with `#EEF2FF`. Verify: they fail on the branch base.
- [ ] 1.3 `src/map/themes.ts` reads the tokens (design §2). Verify: `npm test`.

## 2. Piece writer

- [ ] 2.1 Tests first: "Stop drawn by the piece", "Piece node outside the allow-list". Verify: they fail.
- [ ] 2.2 `src/map/pieces.ts`: write a piece's `{ body, text }` node tree with `tag()`. Verify: `npm test`.

## 3. Map

- [ ] 3.1 Tests first: "Legend interchange is a capsule"; rewrite "Example map" to compare line paths, marker centres and label positions with the 0.2.0 fixtures instead of bytes. Verify: the capsule test fails; "Example map" passes on the base.
- [ ] 3.2 `src/map/svg.ts`: markers, lines, terminal and legend badges, rule counts and the legend's interchange through the pieces; licence marker, renewal ring, halo, zones, title band and legend panel stay local (design §3). Verify: `npm test`; every map test that changes is listed with its reason in the pull request.

## 4. Diagrams

- [ ] 4.1 Tests first: "Edges point right", "Strip interchange is a capsule", "Resource without a shadow" (title centred), "Diagram of a skill" (edge head), "Long playbook name fits". Verify: they fail.
- [ ] 4.2 `strip.ts`, `neighbourhood.ts`, `relations.ts` through the pieces (design §3 to §5). Verify: `npm test`.

## 5. Site

- [ ] 5.1 Tests first: "Favicon is the mark", "Header mark with a custom title", "Palette from the design system", "Card frame in light", "Card frame in dark", "Focus still visible". Verify: they fail.
- [ ] 5.2 `src/site/build.ts` copies the package's `tokens.css`; `tokens.css` reads `--ds-site-*`; `base.css` and `pages.css` get the ink frame; `Header.astro` shows the mark; `favicon.svg` is the `ledgerMark` (design §6 to §8). Verify: `npm run build && npm test`, `npm run test:browser`.

## 6. Images and documentation

- [ ] 6.1 Build the Northwind example site, take the home, map (light and dark), a software item, a journey, the skills map and an agent page in both themes, and look at each. Regenerate the README images that changed (`docs/images/site-home.png`, `site-map-light.png`, `site-map-dark.png`, and any other in `docs/images/` that shows a changed page). Verify: images opened and checked.
- [ ] 6.2 Update `README.md` (dependency, images), `docs/map.md`, `docs/site.md` and `docs/roadmap.md`. Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
