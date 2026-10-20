## 1. Catalogue and data

- [ ] 1.1 `spec.site` in the `Settings` schema and validator; tests for every scenario of the `catalogue` delta; update the global help scenario.
- [ ] 1.2 `src/site/data.ts`: `SiteData` per view (items, lines, graph results, map SVGs, diagrams); unit tests that the staff data carries no hidden value and ignores the date.

## 2. Diagrams

- [ ] 2.1 `src/map/neighbourhood.ts` and `src/map/strip.ts`, safe SVG with `data-ref`; add `data-line` and `data-zone` to the map engine's attributes and allow-list; tests for `Neighbourhood diagram`, `Journey pages` (strip) and the safe-SVG checks.

## 3. Astro site

- [ ] 3.1 `site/` Astro project: tokens, fonts, `Base` layout, header, footer, theme switch; Astroplate credit; tests for `Layout` and `Look and theme`.
- [ ] 3.2 Pages: map, software list, component, licence, journeys list and journey; scripts for zoom, pan, filters, highlight and search; tests for every `catalogue-site` scenario that can be checked on the built HTML.
- [ ] 3.3 `_headers`, `robots.txt`, CSP; tests for every `site-security` scenario on the built files.

## 4. Build command

- [ ] 4.1 `src/site/build.ts` and `stackledger build` in `src/cli.ts`: options, usage errors, safe output folder, temporary folder and atomic replace, stderr report; tests for every `build-command` scenario, including the offline and read-only sandbox runs and the 300-item timing.

## 5. Browser checks and documentation

- [ ] 5.1 Playwright (development dependency) test: the four page kinds under CSP without violations; zoom, filter, highlight, station link and search work; without JavaScript the map and table are shown. Add it to CI.
- [ ] 5.2 `docs/site.md`, `spec.site` in `docs/catalogue-format.md`, README Usage row and screenshots of each page from `examples/northwind` (PNG under `docs/images/`).
