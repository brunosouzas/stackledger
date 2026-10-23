## Why

`@brunosouzas/design-system` 0.3.0 has the pieces stackledger still draws by itself: `renewalRing`, `suggestedHalo`, `licenceMark`, `zone`, `nodeBlock` with a placeholder subtitle, and the interface icons `uiIcon` (`sun`, `moon`, `zoomIn`, `zoomOut`, `reset`, `download`, `calendar`). 0.3.1 adds `currentColor` to `uiIcon`, so an icon inline in a button follows the button's text colour when the button inverts on hover and when pressed (AB#170). The map, the diagrams and the site's buttons should be drawn by those pieces, so the identity has one source.

## What Changes

- **Map pieces.** Renewal rings, the suggested-position halo, licence markers and zones on the map and in its legend are drawn by `renewalRing`, `suggestedHalo`, `licenceMark` and `zone`, through the map's own SVG writer (`src/map/pieces.ts`). Station positions, routes and every other geometry stay as they are; only the paint changes.
- **Licence colour.** The solid licence marker (a held licence) turns from amber (`color.transitional`, `#FFD25A`) to green (`color.healthy`, `#3DDC84`), the colour `licenceMark` gives an `owned` licence (decided at the gate of AB#167). The hollow marker (to buy) stays white. Rings, halos and zones keep their look.
- **Theme fields.** `licence`, `renewal`, `zoneOpacity` and `zoneTitleTint` of `Theme` are no longer read by the renderers: the pieces take them from the tokens. `checkInk` refuses a theme whose value for any of them differs from its surface's, naming the field, as it already does for the ink. `zoneOpacity` comes from `surface.<theme>.zoneOpacity` and the dark `zoneTitleTint` from `map.zoneTitleTint` (light keeps 0, as the piece tints titles on dark only); `licence` becomes `color.healthy`.
- **Neighbourhood placeholder.** A resource without a page keeps its dashed, muted, shadowless box, and gains its kind (`resource`) as a muted subtitle under its title, laid out like a linked box.
- **Interface icons.** The zoom in, zoom out and reset buttons of the map page and the skills map page, and the renewal calendar button of the Reports page, start with the `uiIcon` `zoomIn`, `zoomOut`, `reset` and `download`, in `currentColor`. The theme switch draws its sun (`color.white`) and moon (`color.ink`) with `uiIcon`. Every icon is an SVG inlined in the page's HTML at build time, never an `img` or a CSS background.
- **Dependency.** `@brunosouzas/design-system` 0.3.1, exact, production (0.3.0 calls draw byte-identically in 0.3.1).

Decisions taken with the owner (2026-10-23): green licence; the four `Theme` fields join `checkInk` rather than leave the type; icons inline with `currentColor`; no `calendar` icon (no obvious place; the `.ics` button uses `download`).

Out of scope: round bends (AB#166), map backgrounds (AB#134), icons on other buttons (line chips, zone filter, home cards), the `calendar` icon, any change to `@brunosouzas/design-system`.

### Behaviour changes (for the 0.5.0 release notes)

- A held licence's marker is green instead of amber, on the map and in its legend.
- A resource without a page shows its kind as a subtitle in the neighbourhood diagram.
- The zoom and calendar buttons and the theme switch show the design system's icons; zoom in and zoom out show a magnifier instead of `+` and `−`.
- `renderSvg`, `renderSymbol` and `renderNeighbourhood` refuse a theme whose `licence`, `renewal`, `zoneOpacity` or `zoneTitleTint` differs from the design system's (before, `zoneOpacity` and the others were honoured).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metro-map`: modified "Suggestion without neighbours" (the halo is `suggestedHalo`), "Zones", "Licence markers", "Renewal ring" and "Theme ink comes from the design system"; added "Map symbols drawn by the pieces", "Piece colours in the themes" and "Blank zone title" (kept apart from "Design system pieces" and "Design system tokens", which stay as they are, so no requirement grows past the validator's length limit).
- `catalogue-site`: modified "Map page" (icons on the zoom buttons) and "Diagram style" ("Resource without a shadow": the title moves to the inset, the kind under it); added "Interface icons" (where the icons are, the theme switch), "Inline icon markup" (how they are written) and "Neighbourhood placeholder box".
- `site-security`: modified "Escaped catalogue text" (the interface icons are a third thing inserted raw, and hold no catalogue text).

`skills-site` "Skills map page" needs no delta: it has zoom "as on the software map page", and "Interface icons" names `/skill-map/`. "Suggested positions" holds only the placement rule; the halo's drawing is in "Suggestion without neighbours". "Look and theme" is not modified: the theme switch icons are in "Interface icons".

## Impact

- `package.json`, `npm-shrinkwrap.json`: design system 0.3.1.
- `src/map/svg.ts` (licence, ring, halo, zones, legend symbols), `src/map/themes.ts` (fields from tokens, `checkInk`), `src/map/neighbourhood.ts` (placeholder subtitle), `src/map/ink.ts` and `src/map/xml.ts` only if a helper is left unused.
- New `src/site/ui-icons.ts`; `src/site/data.ts` (`icons` in the site data); `site/src/pages/map/index.astro`, `site/src/pages/skill-map/[...map].astro`, `site/src/pages/[reports].astro`, `site/src/components/ThemeSwitch.astro`, `site/src/styles/base.css`.
- Tests: `test/unit/map-svg.test.ts`, `test/unit/map-diagrams.test.ts`, a new `test/unit/site-icons.test.ts`, `test/integration/site.test.ts`, `test/integration/site-skills.test.ts`, `test/integration/map-example.test.ts`, `test/browser/site.spec.ts`.
- `docs/images/map-light.svg`, `map-dark.svg` and the README screenshots that show a licence marker, a zoom button or the Reports button.

## Implicit requirements

- **Errors and invalid input:** a theme with a custom `licence`, `renewal`, `zoneOpacity` or `zoneTitleTint` is refused with an error naming the field ("Theme ink comes from the design system"). A piece that rejects its input throws and the drawing fails, as for the 0.2.0 pieces.
- **Limits:** none new. A zone title that is only whitespace, which the catalogue accepts and the `zone` piece refuses, is drawn as no title ("Blank zone title"), so no valid catalogue stops drawing. The pieces accept every finite coordinate the layout gives ("Far station drawn by the piece" covers them).
- **Repetition and idempotency:** the same catalogue and date give byte-identical SVG and HTML, as today ("Deterministic output").
- **Concurrency:** n/a, pure drawing.
- **Security:** icons are inline SVG built from the package's fixed shapes at build time, with no catalogue text; they hold no `script`, `foreignObject` or `style` element, no `style` or `on…` attribute and no `href` or `url(…)`, so the Content Security Policy and "No inline code" hold unchanged. No new `img`, file or request.
- **Logs and observability:** n/a.

## Documentation

- `docs/map.md` (the "solid gold disc" and "amber ring" sentence), `docs/site.md` (icons), `docs/images/map-light.svg` and `map-dark.svg`, README screenshots, `docs/roadmap.md` if it names this change.
- Vault, after the merge: the project's `architecture.md`, `roadmap.md` and `changelog.md`.
