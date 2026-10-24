## Scenario to test map

Levels: U unit (vitest, `npm test`), B browser (Playwright, `npm run test:browser`). Every scenario has one test named after it. "New" tests must fail before the code; "kept" ones pass before and after.

| Spec | Scenarios | File | Level | Kind |
| --- | --- | --- | --- | --- |
| catalogue, Map settings | London backdrop; Unknown backdrop; Typo under map | `test/unit/settings.test.ts` | U | new |
| catalogue, Map settings | Invalid backdrop falls back to neutral | `test/unit/settings.test.ts` | U | kept (passes today: no backdrop exists) |
| catalogue, Map settings | Option wins over invalid settings | `test/unit/map-command.test.ts` | U | new |
| catalogue, Settings (modified) | Staff hide list; Unknown field name in the hide list; Repeated field name | `test/unit/settings.test.ts` | U | kept |
| map-command, Command (modified) | Backdrop option overrides the settings; Backdrop from the settings; London backdrop offline | `test/unit/map-command.test.ts` | U | new |
| map-command, Command and Usage errors (modified) | Default options; Read-only; Unknown theme; Impossible date | `test/unit/map-command.test.ts` | U | kept |
| map-command, Usage errors (modified) | Unknown backdrop option | `test/unit/map-command.test.ts` | U | new |
| metro-map, Map backdrop | Neutral is today's map; Neutral site map is today's map; Skills map stays flat | `test/unit/map-backdrop.test.ts` (fixtures recorded from 0.5.1 in task 1.1) | U | kept (guard the default) |
| metro-map, Map backdrop, Backdrop layer, Backdrop scale | Backdrop moves nothing; London layer order; London colours are the tokens; Holes without fill-rule; Backdrop covers the map | `test/unit/map-backdrop.test.ts` | U | new |
| metro-map, Backdrop data, Backdrop data generation | Data size; Data provenance; Reproducible data | `test/unit/map-backdrop.test.ts` | U | new |
| metro-map, Backdrop credit | Credit on London | `test/unit/map-backdrop.test.ts` | U | new |
| metro-map, Backdrop credit | No credit on neutral | `test/unit/map-backdrop.test.ts` | U | kept |
| catalogue-site, Map backdrop | London map on the page; London credit on the page; Credit readable on a phone | `test/browser/site.spec.ts` (describe "Map backdrop", a scratch catalogue with `spec.map.backdrop: london`) | B | new |
| catalogue-site, Map backdrop | No credit without a city | `test/browser/site.spec.ts` | B | kept |
| regression | "Safe SVG structure", "Allowed attributes", "Allowed attribute values", "Deterministic output", "Software map unchanged" | as today | U | kept |
| regression | "Pages work under the policy" | as today | B | kept |
| regression | "Size and speed", Large catalogue with `neutral` | `test/unit/map-performance.test.ts` | U | kept |
| metro-map, Size and speed (no change to the requirement) | Large catalogue drawn with `london`, same 5-second budget | `test/unit/map-performance.test.ts` | U | new |

## 0. Evidence and dependency

- [x] 0.1 Spike outside the repository (`~/.hermes/spikes/stackledger/map-backgrounds/`): data source, size per simplification, prototype in both themes at 1200 and 390 pixels, contact sheet.
- [x] 0.2 Gate 1: the owner approves the spec (2026-10-24).
- [ ] 0.3 Design system release with the `backdrop` tokens for both surfaces (AB#180). Bump the exact pin in `package.json` and `npm-shrinkwrap.json`. Verify: the maps of the example catalogue stay byte-identical after the bump.

## 1. Tests first

- [x] 1.1 Record from 0.5.1 the `staff` SVGs of the example catalogue and the site-style SVGs without header and legend of both views (both themes, map date 2027-06-01) into `test/fixtures/`. Write the tests of the table. Verify: every "new" test fails on the current code and every "kept" one passes. Done: fixtures in `test/fixtures/map-0.5.1/` (`record.mjs`), recorded and committed before any code change. "London colours are the tokens" and "Credit colour is the token" are `it.todo` and "London credit on the page" and "Credit readable on a phone" are `test.fixme`, waiting on AB#180 and 2.5. "Reproducible data" runs only with `STACKLEDGER_BACKDROP_BUILD=1` (it runs mapshaper through npx).

## 2. Code

- [x] 2.1 `scripts/backdrops/london.overpassql`, `refresh.mjs` (network, by hand) and `build.mjs` (offline, pinned tool versions); commit `london-extract.json` and the generated `src/map/backdrops/london.ts`. Verify: `build.mjs` twice gives the same module; under 16 KB.
- [x] 2.2 `spec.map.backdrop` in the Settings schema.
- [ ] 2.3 Backdrop paths and credit in `src/map/svg.ts` through the writer, colours in `src/map/themes.ts`. Partial: geometry, layer order and SVG credit done; the colours are a placeholder from existing surface tokens (`placeholderBackdrop`, `TODO AB#180`) until the `backdrop` tokens ship.
- [x] 2.4 `--backdrop` in `src/map/command.ts`; the build passes the setting to the software map only.
- [ ] 2.5 Credit line under the map frame in the site.
- [ ] 2.6 Docs: `docs/map.md`, `docs/site.md`, `README.md` (ODbL attribution for the bundled data). Partial: done for 2.1 to 2.4 (and `docs/catalogue-format.md`); the site credit line (2.5) and the final colour note wait on AB#180.

## 3. Close

- [ ] 3.1 `npm test` (in the background), `npm run test:browser` and `npm run test:perf` green; Codex code review; archive the change.
