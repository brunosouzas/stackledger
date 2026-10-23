## Why

stackledger draws its map, its page diagrams and its site with values copied by hand from brunosouzas.com (`src/map/themes.ts`, `site/src/styles/tokens.css`) and with its own drawing code (`src/map/svg.ts`, `strip.ts`, `neighbourhood.ts`, `relations.ts`, all through the sticker helper in `src/map/ink.ts`). The same identity is now published as `@brunosouzas/design-system` 0.1.0 (tokens and the metro and diagram pieces, AB#155 and AB#157). Copies drift, and the site shows two identities today: the ink map on an Astroplate page, three different interchange drawings, and diagram edges with no direction (AB#164).

## What Changes

- **Dependency.** `@brunosouzas/design-system` 0.1.0 becomes an exact production dependency. It has no runtime dependency of its own.
- **Tokens instead of copied values.** The map themes read `surface.<theme>`, `map.*` and `color.*`; the ink measures used by the layout (`inkOf`, `widestInk`, `inkBox`) follow from the same values. The site's colour, font and type-scale variables read the package's `site.*` CSS variables. The accent and focus colours stay stackledger's own.
- **Pieces instead of own drawing.** Stops and interchanges (`stationMarker`), lines (`pipe`), terminal badges (`lineBadge`, `flat` in HTML lists), rule counts (`countBadge`), diagram boxes (`nodeBlock`, `pillNode`, `hexNode`, with `focus` for the centre item and `placeholder` for "Nothing" and unlinked resources) and diagram edges (`messageArrow`, with a head). Piece output is written through the map's own SVG writer, so the allow-lists and escaping stay as they are.
- **One interchange shape.** The interchange is a capsule on the map, on the journey strip and in the legend.
- **Edges with direction.** Diagram edges get an arrow head; they read left to right.
- **Brand mark.** The favicon becomes the package's `ledgerMark`, and the header shows it before the site title.
- **Ink frame.** Cards, buttons, line chips and tag chips get the ink outline and the hard shadow of the identity.
- Station positions do not change: only the painting changes.

Out of scope:

- the home banner (needs the banner format, AB#156);
- the city backdrop behind the map (AB#134);
- renewal ring, suggested-position halo, licence marker, zones, the CLI legend panel and interface icons (sun, moon, zoom, calendar, download): the package has no piece for them yet, so they keep their own drawing, now with token values;
- a new site palette;
- icons on the home cards;
- the release 0.5.0 (its own pull request).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metro-map`: two requirements added (tokens and pieces from the design system); "Stations and interchanges" (legend capsule) and "Hard offset shadow" (dark rim `#EEF2FF`) modified.
- `catalogue-site`: "Look and theme" (site tokens from the package) and "Diagram style" (pieces, arrows, strip capsule, placeholder) modified; "Ink frame" and "Brand mark" added.
- `skills-site`: "Relation diagram" modified (pieces, arrows, text room per shape).

## Impact

- `package.json`, `npm-shrinkwrap.json`: one new production dependency.
- `src/map/themes.ts`, `ink.ts`, `svg.ts`, `strip.ts`, `neighbourhood.ts`, `relations.ts`, a new `src/map/pieces.ts` (writer for piece output); `src/site/build.ts` (copies the package's `tokens.css` into the working copy, as it does for fonts).
- `site/src/styles/tokens.css`, `base.css`, `pages.css`, `site/src/components/Header.astro`, `site/public/favicon.svg`.
- Tests whose expected drawing changes: `test/unit/map-svg.test.ts`, `map-diagrams.test.ts`, `skills-relations-diagram.test.ts`, the map fixtures in `test/fixtures/map-0.2.0/` if they hold painted output, and browser screenshots. Each change is explained in the pull request.
- Visible: dark text and rim move from `#EEF1FF` to `#EEF2FF`; the `h1` size from `2.986rem` to `2.985984rem` (the token); interchange on the strip and in the legend becomes a capsule; diagram edges get heads; unlinked resources lose their kind line (the placeholder piece has no subtitle); playbook and agent boxes widen so their text clears the round and cut ends.

## Implicit requirements

- **Errors and invalid input:** a piece rejects bad parameters with a `RangeError`; the map's writer rejects any element, attribute or paint outside its allow-lists. Both make the build fail, as an invalid colour does today. Catalogue data reaches pieces only as text (escaped by the writer) and line colours (already validated `#RRGGBB`).
- **Limits:** the pieces' minimum sizes (shape at least four outlines) hold for every size stackledger uses; the licence marker (10 units) stays local for that reason.
- **Repetition and idempotency:** output stays byte-identical for the same input.
- **Concurrency:** n/a, pure functions.
- **Security:** the package has no runtime dependency and no install script; its output passes through the existing SVG writer, so the site-security and metro-map allow-lists are unchanged. No URL, font or script is added to the pages.
- **Logs and observability:** n/a.

## Documentation

- `README.md`: the dependency, the screenshots (`docs/images/site-home.png`, `site-map-light.png`, `site-map-dark.png` and other site images that change).
- `docs/map.md`, `docs/site.md`: where colours and shapes come from.
- `docs/roadmap.md`: this change.
- Vault, after the merge: the project's `architecture.md`, `roadmap.md` and `changelog.md`.
