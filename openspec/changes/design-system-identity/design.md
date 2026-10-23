# Design: design-system-identity

## Context

`@brunosouzas/design-system` 0.1.0 exports tokens (`/tokens` in TypeScript, `/tokens.css` with `--ds-*` variables) and pure pieces that return an SVG node tree (`{ body, text }` of `{ tag, attrs, children }`), with `toSvg` to write it. The pieces only paint: position, text measurement, truncation and collision stay in stackledger (`labels.ts`, `badges.ts`, `layout.ts`). Measures and parameters are in the package's archived change `metro-and-diagram-pieces`, design §3.

## Decisions

### 1. Piece output goes through stackledger's writer, not `toSvg`

A new `src/map/pieces.ts` walks a piece's node tree and writes each node with `tag()` from `src/map/xml.ts`. `tag()` already enforces the element and attribute allow-lists, writes paint only as `#RRGGBB` or `none`, rejects nonfinite numbers and escapes text. So the metro-map and site-security rules keep one writer and one escaping path, and a future piece that emits something outside the lists (for example `transform`) fails loudly instead of reaching a page.

Rejected: `toSvg` from the package. It escapes text, but does not check names or paints against stackledger's lists, and it adds indentation that changes every snapshot for nothing.

### 2. Themes are built from the tokens

`themes.ts` keeps its `Theme` shape, so renderers and the layout do not change their inputs. Each field reads a token: `surface.<t>.background/text/muted/grid/panel`, shadow colour `surface.<t>.shadow`, rim `surface.<t>.rim` with `enabled = rimWidth > 0` and `width = rimWidth`, `outline` and `casing.color` `color.ink`, `outlineWidth` `map.outline`, shadow offset `map.shadow`, `lineWidth` `map.lineWidth`, `casing.extraWidth` `map.casing`, `station` and `badgeText` `color.white`, `licence` `color.transitional`, `renewal` `color.blocked`, `accent` `color.caller`, `font` `font.sans`. Without a token, and so staying in `themes.ts`: `header`, `headerText` (the CLI title band), `zoneOpacity`, `zoneTitleTint`. `inkOf`, `widestInk` and `inkBox` are unchanged code over those values, so the layout's obstacles match the pieces' ink (the pieces' sticker uses the same outline, rim and offset).

The font stack becomes the token `Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif`. Its quotes are escaped as `&apos;` in attributes; it still starts with `Lato` and ends with `sans-serif`.

### 3. Which drawing becomes which piece

| Today | Piece | Note |
|---|---|---|
| stop, interchange on the map (`svg.ts` `marker`) | `stationMarker` (`to` for the capsule, `state: deprecated`) | same geometry: the radius comes from the layout's marker |
| legend interchange (disc) | `stationMarker`, radius 6, from 1.5 above to 1.5 below the symbol's centre (10.5, 10.5) | one shape everywhere; with the dark rim and shadow it spans x 2 to 22.5 and y 0.5 to 24, inside 24 × 24 |
| strip stop, strip interchange (larger disc, radius 15) | `stationMarker`; interchange radius 14 (`stopRadius` + `interchangeExtra`), from 4 above to 4 below the line | parallel lines on a horizontal edge stack vertically, so the map's capsules on such edges are vertical too. Top with outline and dark rim: line − 20.5; the terminal badge's shadow ends at line − 22; the label's top is at about line + 26 |
| lines and legend samples, strip line | `pipe` | |
| terminal badges, strip badges, HTML badges | `lineBadge` (`flat` for `renderLineBadge`) | width still from `badges.ts` |
| rule count and its legend symbol | `countBadge` | box from the layout |
| neighbourhood and skill boxes | `nodeBlock` (radius 10, skills 6), centre `focus` | `inkScale` 1.6 as today |
| playbook, agent | `pillNode`, `hexNode` | |
| "Nothing", unlinked resource | `nodeBlock` `placeholder` | the placeholder has no subtitle: an unlinked resource loses its `resource` line; the text list still says it has no page |
| diagram edges | `messageArrow`, `bezier`, head at the right-hand end, `surface` of the theme | |
| favicon, header mark | `ledgerMark` | |

Stays local, with token values: licence marker (a 10-unit disc, below the pieces' minimum of 12), renewal ring, suggested halo, zones, the grid, the CLI title band and legend panel. `ink.ts`'s `sticker` stays for the licence marker and legend panel only.

### 4. Arrow direction: left to right

Both diagrams have three columns. With heads at the right-hand end, every edge reads the same way: on a relation diagram "brings in" (left brings in the centre, the centre brings in the right), on a neighbourhood diagram "is used by" (a dependency is used by the item, the item by its dependants). Rejected: arrows pointing at the dependency (UML "depends on"), which would make the two diagrams read in opposite directions.

### 5. Text room per shape

`nodeBlock` starts text 12 units in; `pillNode` and `hexNode` start it at half the height (23). `relations.ts` sizes each column from the widest text plus twice its shape's inset, so a playbook or agent name never runs into the round or cut end. Station positions and the map layout are not affected.

### 6. Site tokens

The build copies `@brunosouzas/design-system/tokens.css` into the working copy (`src/styles/ds-tokens.css`) next to the fonts it already copies, and `tokens.css` imports it. `--color-*`, `--font-*` and `--text-*` are then `var(--ds-site-…)` (headings `calc(var(--ds-site-heading-h1) * 1rem)`). The accent (`#000f9f`, dark `#9da8ff`) and `--color-on-primary` stay literal. Values are the same as today except `h1` (`2.986rem` to `2.985984rem`) and `h1-sm` (`2.6874rem` to `2.6873856rem`), below a pixel.

Rejected: importing the package's CSS through the Vite resolver (the working copy has no `node_modules`; the fonts already set the copy pattern).

### 7. Ink frame on the page

`.card`, `.btn`, `.tags li` and the line chips get `border: var(--ds-outline-small) solid var(--ds-color-ink)` and `box-shadow: var(--ds-shadow-small) var(--ds-shadow-small) 0 var(--frame-shadow)`. On the light page the shadow is the ink. On the dark page (grey `#1c1c1c`) an ink outline alone disappears, so the frame takes the map's dark sticker: a 1-unit `surface.dark.rim` ring outside the outline and the `surface.dark.shadow` indigo. Hover and focus styles keep working (focus outline unchanged).

### 8. Brand mark

`site/public/favicon.svg` is the `ledgerMark` at size 32 in a 32 × 32 `svg`, written once and checked by a unit test against the piece, so it cannot drift. The header shows it as `<img src="…favicon.svg" alt="" width="28" height="28">` before the title link text: a decorative image from the site's own folder, no inline SVG, style or script.

### 9. Blank text never reaches a piece

The pieces reject a `title`, `subtitle` or `text` that is empty after trimming. The catalogue allows a title of spaces, and cleaning a skill name can leave nothing. So a diagram box whose title would be blank shows the item's reference (`component:forge`, `skill:writer`), which is never empty. Line badges are safe: a code is one to three ASCII letters or digits, and the fallback is a name's first character.

### 10. Coordinate limit of the pieces (blocking)

`@brunosouzas/design-system` 0.1.0 accepts positions and points only within ±10,000 (`MAX_SIZE` in `params.js`). The map places grid point `[c, r]` at `(64c, 64r)`, and "Far-away typo" draws a stop at `[100000, 100000]`, that is 6,400,000 units away; a column of 157 already passes the limit. stackledger cannot keep its contract with 0.1.0. This change therefore needs a design-system release whose limit covers the map (request below), and pins that version instead of 0.1.0. Rejected: drawing far stations with stackledger's own code (two drawing paths for one shape), and clamping coordinates (moves stations).

### 11. Tests that change

| Test | Today | After |
|---|---|---|
| `map-svg.test.ts` "Example map" | bytes equal the 0.2.0 SVGs | line `d`, marker centres and label positions equal those parsed from the same 0.2.0 SVGs |
| `map-svg.test.ts` "Legend symbols on their own" | every symbol has a `circle` | interchange has none (a capsule `path`); others unchanged; every symbol inside 24 × 24 |
| `map-svg.test.ts` "Dark shadow and rim" | rim `#EEF1FF` | `#EEF2FF` |
| `map-diagrams.test.ts` "Strip line and stops" | selects `line` and `circle` | selects the pipe `path`s and marker shapes (`circle` or `path`) |
| `map-diagrams.test.ts` "Terminal badge over an end interchange" | top of the interchange `circle` | top of the capsule's bounding box with outline and rim; the test fails when no marker shape is found |
| `site-skills.test.ts` "Description with HTML" | no `<img` on any page | no `<img` except the header mark |

Each is named in the pull request with its reason.

## Requests to the design system (not in this change)

- **Blocking:** position and point limit of at least ±6,400,000 (or any finite number) on every piece stackledger uses.
- `placeholder` with an optional subtitle (to keep `resource` on unlinked boxes).
- Pieces for the renewal ring, suggested halo, licence marker (at 10 units) and zone; interface icons.

## Risks

- Every map snapshot changes byte-wise (attribute order, `stroke-linejoin`, `font-family` on texts). The rewritten "Example map" test compares geometry parsed from the 0.2.0 SVGs, not bytes, so it proves positions did not move.
- A future package version could change a measure; the dependency is pinned exactly, and a bump is its own change.
