## Scenario to test map

Levels: U unit, I integration, B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| metro-map | Long title; Long hyphenated name; Long word with no break character | `test/unit/map-layout.test.ts` | U |
| metro-map | Example map (unchanged test); A cut label now wraps; Software map has no rule count | `test/unit/map-svg.test.ts` | U |
| metro-map | Labels do not collide in the example; Larger ink pushes a label out (unchanged tests) | `test/integration/map-example.test.ts`, `test/unit/map-svg.test.ts` | I, U |
| metro-map | Rule count pushes a label out; Legend of a skills map; Skill with rules; Many rules; Same skills map everywhere; Suggested skill station (unchanged tests) | `test/unit/skills-metro.test.ts` | U |

## 1. Label rows

- [ ] 1.1 Tests first: rewrite "Long title" and "Long title keeps full station title" for rows without `…`; add "Long hyphenated name", "Long word with no break character" and "A cut label now wraps". Verify: they fail on `main`'s `wrapLabel`.
- [ ] 1.2 `src/map/labels.ts`: `wrapLabel` with unlimited rows, breaks after `-`, `_`, `.` or `/`, hard break at 18 code points, no `…`. Verify: `npm test`, including "Example map" against the 0.2.0 fixtures.

## 2. Rule count

- [ ] 2.1 Tests first: "Skill with rules", "Many rules", "Rule count pushes a label out", "Software map has no rule count" and the new "Legend of a skills map". Verify: they fail on `main`.
- [ ] 2.2 `src/map/model.ts` (`MapStation.rules`, 0 on software maps), `src/skills/metro.ts` (the item's rule count; 0 for agents), `src/map/layout.ts` (the sticker's box at the marker's upper right, grown by its ink as a label obstacle; skills legend symbols), `src/map/svg.ts` (pill with the number or `99+`, legend symbol `number of rules`). Verify: `npm test`, `npm run test:perf`.

## 3. Site, images and documentation

- [ ] 3.1 Build the kit's real map (`stackledger build` with the kit and OpenSpec) and look at PNG renders of `/skill-map/` in both themes: `openspec-apply-change` and `openspec-archive-change` whole, rule counts readable, no label over a count. Update the browser tests and screenshots that show the skills map. Verify: `npm run test:browser`.
- [ ] 3.2 `docs/map.md`, `docs/skills.md`, `docs/roadmap.md` (item 4a). Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
