## Why

The software map sits on a flat panel. The roadmap idea "map backgrounds" (AB#134) puts a city behind it, as a decoration that gives the map a sense of place. The spike of 2026-10-24 (outside the repository) drew the example map over central London from OpenStreetMap data in both themes, on desktop and phone widths: the labels, zones and lines stay readable with one colour per theme and no opacity, and the simplified data weighs 9.8 KB.

## What Changes

- **A backdrop setting.** `spec.map.backdrop` in `Settings` is `neutral` (the default, the flat panel of today) or `london`. `stackledger map` and `stackledger build` follow it; `stackledger map --backdrop neutral|london` overrides it for one drawing.
- **The `london` backdrop.** The software map draws the Thames, the docks and lakes, and the large parks of central London in a layer between the background and the grid. It is decorative: it covers the whole map, cropped, and nothing lines up with the stations, because the map is schematic.
- **Colours from the design system.** The water, water edge, park and credit colours come from new `@brunosouzas/design-system` tokens, one set per surface (AB#180). No colour is written in stackledger.
- **Attribution.** A map with the `london` backdrop carries "© OpenStreetMap contributors" in its bottom-right corner, and the site's map page shows the same credit, linked to the OpenStreetMap copyright page, under the map (the SVG text is too small to read on a phone).
- **Data in the package.** The London shapes ship as a generated module in `dist/`, made by a maintainer script from an OpenStreetMap extract; the user's build never downloads anything.
- `neutral` draws nothing: a map without a backdrop setting, or with `neutral`, is the same byte for byte as today.

Out of scope:

- `sao-paulo` and any other city (a later change, with the coastline);
- the skills map, the neighbourhood diagrams, the strips and the relation diagram, which keep the flat panel;
- a textured or ringed `neutral` (the spike drew the rings of the site's diagram panels; kept flat so the default does not change);
- aligning the city with the stations, or a backdrop per view.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue`: "Map settings" added; "Settings" modified (it MAY have `spec.map`).
- `metro-map`: "Map backdrop", "Backdrop layer", "Backdrop scale", "Backdrop data", "Backdrop data generation" and "Backdrop credit" added.
- `map-command`: "Command" and "Usage errors" modified (`--backdrop`).
- `catalogue-site`: "Map backdrop" added (the build follows the setting; the credit line under the map).
- `site-security`: "No external requests" modified (the credit anchor to the OpenStreetMap copyright page on the map page of a city map is exempt).

`package-release` is unchanged: the data lives in `dist/`, already shipped.

## Implicit requirements

- Errors and invalid input: an unknown `spec.map.backdrop` is a catalogue error, and the map falls back to `neutral`; an unknown `--backdrop` is a usage error (exit 2).
- Limits: the bundled data of one city SHALL stay under 16 KB; the "Size and speed" budget of the engine is unchanged.
- Repetition and idempotency: the drawing is deterministic ("Deterministic output"); the generated data module is reproducible from the committed extract and the generator script with pinned tool versions ("Reproducible data").
- Concurrency: n/a.
- Security: the backdrop paths go through the map's own writer and pieces, so "Safe SVG structure", "Allowed attributes" and "Allowed attribute values" apply; no URL-valued paint, no external reference. The site credit link carries `rel="noopener noreferrer"`.
- Licensing: the OpenStreetMap data is under the ODbL; the generated module and the package README carry the attribution and the licence name; share-alike applies to that data only.
- Logs and observability: n/a.

## Impact

`src/schema.ts` (Settings), `src/map/command.ts`, `src/map/svg.ts`, `src/map/pieces.ts`, `src/map/themes.ts`, a new `src/map/backdrops/` (generated `london.ts`), `scripts/backdrops/` (maintainer only, not published), `src/site/` (credit under the map), `docs/map.md`, `docs/site.md`, `README.md`. Depends on the design system release that adds the `backdrop` tokens (AB#180); the code waits for it.
