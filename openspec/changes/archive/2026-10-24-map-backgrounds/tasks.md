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
| site-security, Map credit link | Map credit is the only other external URL | `test/integration/site.test.ts` | U | new |
| site-security, Map credit link | Credit URL outside the map page | `test/unit/site-relative.test.ts` | U | new |
| site-security, No external requests (modified) | Only local URLs; Home links are the only external URLs; Link URL outside the home | as today | U | kept |
| regression | "Size and speed", Large catalogue with `neutral` | `test/unit/map-performance.test.ts` | U | kept |
| metro-map, Size and speed (no change to the requirement) | Large catalogue drawn with `london`, same 5-second budget | `test/unit/map-performance.test.ts` | U | new |

## 0. Evidence and dependency

- [x] 0.1 Spike outside the repository (`~/.hermes/spikes/stackledger/map-backgrounds/`): data source, size per simplification, prototype in both themes at 1200 and 390 pixels, contact sheet.
- [x] 0.2 Gate 1: the owner approves the spec (2026-10-24).
- [x] 0.3 Design system release with the `backdrop` tokens for both surfaces (AB#180). Bump the exact pin in `package.json` and `npm-shrinkwrap.json`. Verify: the maps of the example catalogue stay byte-identical after the bump. Done: 0.5.3, whose tokens are flat (`surface.<theme>.backdropWater`, `backdropWaterEdge`, `backdropPark`, `backdropCredit`); the specs name them so. "Neutral is today's map" and "Neutral site map is today's map" pass unchanged after the bump.

## 1. Tests first

- [x] 1.1 Record from 0.5.1 the `staff` SVGs of the example catalogue and the site-style SVGs without header and legend of both views (both themes, map date 2027-06-01) into `test/fixtures/`. Write the tests of the table. Verify: every "new" test fails on the current code and every "kept" one passes. Done: fixtures in `test/fixtures/map-0.5.1/` (`record.mjs`), recorded and committed before any code change. "London colours are the tokens" and "Credit colour is the token" were `it.todo` and "London credit on the page" and "Credit readable on a phone" `test.fixme` until AB#180 and 2.5; all four are real tests now. "Reproducible data" runs only with `STACKLEDGER_BACKDROP_BUILD=1` (it runs the pinned mapshaper from the npm cache with `npx --offline`).

## 2. Code

- [x] 2.1 `scripts/backdrops/london.overpassql`, `refresh.mjs` (network, by hand) and `build.mjs` (offline, pinned tool versions); commit `london-extract.json` and the generated `src/map/backdrops/london.ts`. Verify: `build.mjs` twice gives the same module; under 16 KB.
- [x] 2.2 `spec.map.backdrop` in the Settings schema.
- [x] 2.3 Backdrop paths and credit in `src/map/svg.ts` through the writer, colours in `src/map/themes.ts` (from the design system's `backdrop` tokens).
- [x] 2.4 `--backdrop` in `src/map/command.ts`; the build passes the setting to the software map only.
- [x] 2.5 Credit line under the map frame in the site; the build's URL scan lets its anchor through on the map page of a city map only (`site-security` delta, added with this task: the credit is the first external link off the home) (`site/src/pages/map/index.astro`, `SiteData.map.credit`, colour `--color-map-credit` from the `backdrop-credit` CSS variable of each theme).
- [x] 2.6 Docs: `docs/map.md`, `docs/site.md`, `README.md` (ODbL attribution for the bundled data), `docs/catalogue-format.md`, `docs/roadmap.md`, `AGENTS.md`.

## 3. Close

- [x] 3.1 `npm test` (in the background), `npm run test:browser` and `npm run test:perf` green; Codex code review; archive the change. Done: Codex review in three rounds (round 1: staff view missing from the backdrop browser tests, fixed; `build.mjs` could download mapshaper, now `npx --offline`; round 2: "London backdrop offline" did not prove the network denied, now a probe on Node 25+ and an import inspection; a stale "only links" sentence in the catalogue format, fixed; round 3: no findings). On archive, "Map credit link" was split out of "No external requests" to keep requirement texts under the 500-character limit of `openspec validate --strict`.
