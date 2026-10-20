## 0. Spike

- [x] 0.1 Prove the Astro workarounds before building pages: from an `npm pack` tarball installed into a read-only folder, build a two-page Astro site from a working copy inside the output staging folder (D2), with the config in D2, the relative-URL rewrite (D3) and the fixed CSP (D4); serve it under `/full/` and `/staff/` and load it in Playwright with no failed request and no CSP violation; list every path written (including under `$HOME` and the package); include nested pages, a shared chunk and a CSS font; confirm the installed dependency tree uses Vite 8 without the old override and that the pinned Astro 7.x runs on Node 22.12. Report findings in `docs/spikes/<date>-astro-build/README.md`; stop and report if a workaround does not hold.

## Scenario to test map

Levels: U unit, I integration (built files or CLI), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Staff hide list; Unknown field name in the hide list; Repeated field name; Title and accent; Title too long; Colour name; Logo not supported | `test/unit/settings.test.ts` | U |
| mcp-server | No folder; Unknown view; Missing folder; Help; Global help lists both commands | `test/integration/cli.test.ts` | I |
| metro-map | Unknown attribute; Hostile titles; Interchange in a zone | `test/unit/map-svg.test.ts` | U |
| catalogue-site | Neighbourhood diagram: Dependencies and dependants, Resource without a page; Journey pages: Interchange on a strip (SVG part) | `test/unit/map-diagrams.test.ts` | U |
| catalogue-site | Item pages; No journeys; Site title; View in the footer; Accent override; Broken settings; Journeys; Line with one served stop; Staff licence page; Indirect dependant; Interchange on a strip (page part); Diagram alternative; Without JavaScript (table present) | `test/integration/site.test.ts` | I |
| catalogue-site | Theme remembered; Zoom; Station link; Highlight a line; Search; Nothing matches; Without JavaScript | `test/browser/site.spec.ts` | B |
| site-security | No trace of the cost; Staff ignores hidden fields and the date; Custom-hidden vendor and status; Broken settings hide the defaults; Same policy everywhere; Only local URLs; Root headers; Root robots; Hostile title | `test/integration/site.test.ts` | I |
| site-security | Pages work under the policy; Two sites on one host | `test/browser/site.spec.ts` | B |
| build-command | Two sites; Missing out; Impossible date; Output inside the catalogue; Unrelated non-empty folder; Rebuild; Failure leaves the old site (one case per publication step); Documented; Sandboxed build; One error; Proxy reminder; Built twice; Large catalogue | `test/integration/build.test.ts` | I |

## 1. Catalogue and data

- [x] 1.1 `spec.site` in the `Settings` schema and validator; unit tests (`test/unit/settings.test.ts`) for every scenario of the `catalogue` delta; global help and unknown-command message list `build` (`test/integration/cli.test.ts`).
- [x] 1.2 `src/site/data.ts`: `SiteData` per view; unit tests (`test/unit/site-data.test.ts`) that staff data carries no hidden value and ignores the date.

## 2. Map engine and diagrams

- [x] 2.1 `data-line` and `data-zone` in the map engine and its allow-list; unit tests (`test/unit/map-svg.test.ts`) for the `metro-map` delta scenarios.
- [x] 2.2 `src/map/neighbourhood.ts` and `src/map/strip.ts`; unit tests (`test/unit/map-diagrams.test.ts`) for the diagram parts of `Neighbourhood diagram` and `Journey pages`, plus the safe-SVG checks.

## 3. Astro site

- [ ] 3.1 `site/` project: tokens, fonts, `Base` layout, header, footer, theme switch, Astroplate credit.
- [ ] 3.2 Pages and scripts: map, software list, component, licence, journeys list, journey.
- [x] 3.3 `src/site/relative.ts` and the fixed CSP; `_headers`, `robots.txt`, marker.
- [ ] 3.4 Build-output tests (`test/integration/site.test.ts`): every `catalogue-site` and `site-security` scenario that can be checked on the built files.

## 4. Build command

- [ ] 4.1 `src/site/build.ts` and `stackledger build`: options, usage errors, safe output folder, atomic replace, writes, report; integration tests (`test/integration/build.test.ts`) for every `build-command` scenario, including the sandboxed build and the 300-item timing.

## 5. Browser checks and documentation

- [ ] 5.1 Playwright test (`test/browser/site.spec.ts`, CI job): both sites under `/full/` and `/staff/` of one local server; no CSP violation, no failed or external request; zoom, filters, highlight, station and diagram links, search; without JavaScript the map and table are shown.
- [ ] 5.2 `docs/site.md` (pages, hosting, headers, the trailing-slash redirect the host must do, what to publish and not serving `--out` during a build), `spec.site` in `docs/catalogue-format.md`, README Usage row and screenshots of each page from `examples/northwind`, roadmap row 4 wording (own SVG diagrams, not Mermaid).
