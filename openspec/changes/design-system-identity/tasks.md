## Scenario to test map

Levels: U unit, I integration (built site), B browser (Playwright). Every scenario has one test named after it. Tests that change are listed in design §11.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| metro-map | Theme values are the tokens; Light theme has no rim; Dark shadow and rim (`#EEF2FF`); Shadow under an interchange (unchanged) | `test/unit/map-svg.test.ts` | U |
| metro-map | Stop drawn by the piece; Piece node outside the allow-list | `test/unit/map-pieces.test.ts` (new) | U |
| metro-map | Far station drawn by the piece | `test/unit/map-layout.test.ts` (next to "Far-away typo") | U |
| metro-map | Legend interchange is a capsule (replaces the circle check of "Legend symbols on their own") | `test/unit/map-svg.test.ts` | U |
| metro-map | Example map (positions parsed from the 0.2.0 SVGs); Software lines in a skills map file name and A cut label now wraps (unchanged) | `test/unit/map-svg.test.ts` | U |
| catalogue-site | Neighbourhood boxes (unchanged); Edges point right; Strip line and stops (pipe paths); Terminal badge over an end interchange (capsule bounds); Resource without a shadow; Strip interchange is a capsule; Blank title | `test/unit/map-diagrams.test.ts` | U |
| skills-site | Diagram of a skill; Long playbook name fits; Name with only control characters; Two playbooks that load each other and Shapes (unchanged) | `test/unit/skills-relations-diagram.test.ts` | U |
| skills-site | Description with HTML (header mark allowed); Hostile script text and Bidirectional override (unchanged) | `test/integration/site-skills.test.ts` | I |
| catalogue-site | Favicon is the mark | `test/unit/site-brand.test.ts` (new) | U |
| catalogue-site | Header mark with a custom title; Palette from the design system (stylesheet part); Accent stays stackledger's | `test/integration/site.test.ts` | I |
| catalogue-site | Card frame in light; Card frame in dark; Focus still visible; Palette from the design system (computed background) | `test/browser/site.spec.ts` | B |

## 0. Evidence for gate 1

- [ ] 0.1 Build the Northwind example from `main` and from a throwaway prototype of this change (outside the branch), take the home, map, a software item, a journey, the skills map and an agent page in light and dark, and put them in a before and after contact sheet. Verify: both sheets opened and looked at; shown to the owner at gate 1.

## 1. Dependency and tokens

- [ ] 1.1 Add `@brunosouzas/design-system` at the first version whose coordinate limit covers the map (design §10) as an exact production dependency and refresh `npm-shrinkwrap.json`. Verify: `npm ls @brunosouzas/design-system` shows that version; `test/unit/package-metadata.test.ts` and the package tests pass.
- [ ] 1.2 Tests first: "Theme values are the tokens", "Light theme has no rim", "Dark shadow and rim" with `#EEF2FF`. Verify: they fail on the branch base.
- [ ] 1.3 `src/map/themes.ts` reads the tokens (design §2). Verify: `npm test`.

## 2. Piece writer

- [ ] 2.1 Tests first: "Stop drawn by the piece", "Piece node outside the allow-list", "Far station drawn by the piece". Verify: they fail.
- [ ] 2.2 `src/map/pieces.ts`: write a piece's `{ body, text }` node tree with `tag()`. Verify: `npm test`.

## 3. Map

- [ ] 3.1 Tests first: "Legend interchange is a capsule" (no circle, every shape grown by half its stroke inside 24 × 24); rewrite "Example map" to compare line paths, marker centres and label positions parsed from the 0.2.0 fixtures. Verify: the capsule test fails; the rewritten "Example map" passes on the base.
- [ ] 3.2 `src/map/svg.ts`: markers, lines, terminal and legend badges, rule counts and the legend's interchange through the pieces; licence marker, renewal ring, halo, zones, title band and legend panel stay local (design §3). Verify: `npm test`.

## 4. Diagrams

- [ ] 4.1 Tests first: "Edges point right", "Strip interchange is a capsule", "Blank title", "Resource without a shadow" (title centred), "Diagram of a skill" (edge head), "Long playbook name fits", "Name with only control characters"; migrate "Strip line and stops" to pipe paths and "Terminal badge over an end interchange" to the capsule's bounds, failing when no marker shape is found. Verify: the new tests fail; the migrated ones fail only where the shape changed.
- [ ] 4.2 `strip.ts`, `neighbourhood.ts`, `relations.ts` through the pieces (design §3 to §5, §9). Verify: `npm test`.

## 5. Site

- [ ] 5.1 Tests first: "Favicon is the mark", "Header mark with a custom title", "Palette from the design system", "Accent stays stackledger's", "Card frame in light", "Card frame in dark", "Focus still visible"; update "Description with HTML". Verify: they fail.
- [ ] 5.2 `src/site/build.ts` copies the package's `tokens.css`; `tokens.css` reads `--ds-site-*`; `base.css` and `pages.css` get the ink frame; `Header.astro` shows the mark; `favicon.svg` is the `ledgerMark` (design §6 to §8). Verify: `npm run build && npm test`, `npm run test:browser`.

## 6. Images and documentation

- [ ] 6.1 Build the Northwind example site again from the branch, take the same pages in both themes, look at each, and regenerate the README images that changed (`docs/images/site-home.png`, `site-map-light.png`, `site-map-dark.png`, and any other in `docs/images/` that shows a changed page). Verify: images opened and checked.
- [ ] 6.2 Update `README.md` (dependency, images), `docs/map.md`, `docs/site.md` and `docs/roadmap.md`. Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
