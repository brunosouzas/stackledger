## RENAMED Requirements

- FROM: `### Requirement: Hard offset shadow`
- TO: `### Requirement: Sticker shadow`

## MODIFIED Requirements

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, markers, licence markers, rule counts and terminal badges grown by their ink, zone titles, and a line's drawn path: straight parts as rectangles as wide as the casing, arcs as in "Arc obstacles". When all overlap, the least intersected area wins, ties to the earlier candidate.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station or a terminal badge grown by its outline

#### Scenario: Larger ink pushes a label out
- **WHEN** a label would fit next to a station marker without its ink but would touch the marker's outline
- **THEN** the label is placed at a candidate clear of the marker grown by its outline

#### Scenario: Rule count pushes a label out
- **WHEN** a skills station's label would fit at its first candidate, to the right, only if the station had no rule count
- **THEN** the label is placed at a later candidate that does not cover the rule count grown by its outline

#### Scenario: Label clears a round bend
- **WHEN** a station's first label candidate is clear of the line's mitred polyline but would cover the inside of the arc that replaces the corner
- **THEN** the label is placed at a later candidate clear of the arc

#### Scenario: Terminal badge clears a round bend
- **WHEN** a terminal badge's first position is clear of the mitred polyline but would cover the arc of a round bend next to the line's end
- **THEN** the badge takes a later position clear of the arc

### Requirement: Themes
The map SHALL support a `light` and a `dark` theme. Line and zone colours come from the catalogue in both themes; background, text, station, outline and header colours come from the theme. The `light` background SHALL be `#F6F3EC` and the `dark` background `#121110`; the header band SHALL be `color.ink` in `light` and `surface.dark.panel` in `dark`. Text SHALL use the design system's `font.sans` stack as is, quotes included, and station labels are bold.

#### Scenario: Dark theme
- **WHEN** the map is drawn with the `dark` theme and its header
- **THEN** the background is `#121110`, the header band is filled `#1D1C1A` and line colours are the catalogue's colours

#### Scenario: Light theme
- **WHEN** the map is drawn with the `light` theme and its header
- **THEN** the background is `#F6F3EC`, the header band is filled `#121212`, the parsed `font-family` starts with `'Source Sans 3'` and ends with `sans-serif`, and every station label has a `font-weight` of at least 700

#### Scenario: Font stack with its quotes
- **WHEN** any map is drawn in either theme
- **THEN** the parsed `font-family` of its root equals `font.sans` character for character, quotes included, and the SVG text writes each of its `'` as `&apos;`

#### Scenario: No header band without the header
- **WHEN** the map is drawn in the `dark` theme without header and legend, as the site draws it
- **THEN** the SVG has no header layer and no shape filled `#1D1C1A`

### Requirement: Allowed attribute values
`xmlns` SHALL be `http://www.w3.org/2000/svg` and `role` SHALL be `img`. Paint values SHALL be theme constants, validated `#RRGGBB` colours or `none`; no URL-valued paint is emitted. Numeric values SHALL be finite. An apostrophe SHALL appear only in `font-family`, written as `&apos;`, and in catalogue text as "Safe SVG text" allows; the writer SHALL refuse any other value holding one. The document SHALL contain no DOCTYPE, entity declaration or processing instruction.

#### Scenario: Paint values
- **WHEN** any map is drawn
- **THEN** every `fill` and `stroke` is `none`, a theme constant or a `#RRGGBB` colour, and no value contains `url(`

#### Scenario: Apostrophe in the font stack
- **WHEN** the example catalogue is drawn in either theme
- **THEN** the root's `font-family` is the only attribute whose written value holds `&apos;`, and the SVG parses as XML with that attribute equal to `font.sans`

#### Scenario: Apostrophe in another attribute
- **WHEN** the map's writer is given a node whose `stroke-dasharray`, or `font-weight`, holds `'`
- **THEN** it throws and returns no SVG

### Requirement: Design system pieces
Stop and interchange markers, lines, terminal badges and rule counts SHALL be drawn by the design system's `stationMarker`, `pipe`, `lineBadge` and `countBadge`, at every finite coordinate the layout gives. Their output SHALL be written by the map's own SVG writer, which applies "Safe SVG structure", "Allowed attributes", "Allowed attribute values" and "Safe SVG text", and leaves out the pieces' `font-family`, which the SVG root names; a piece node outside those rules SHALL make drawing fail.

#### Scenario: Stop drawn by the piece
- **WHEN** station `a`, a stop of one line, is drawn in the `light` theme
- **THEN** its marker equals `stationMarker` for the same centre and radius, written by the map's writer

#### Scenario: Piece node outside the allow-list
- **WHEN** the map's writer is given a piece node with a `transform` attribute
- **THEN** it throws and returns no SVG

#### Scenario: Far station drawn by the piece
- **WHEN** consecutive stops are at `[0, 0]` and `[100000, 100000]`
- **THEN** the whole map, with its terminal badges and legend, is drawn in both themes, and both stations are drawn by `stationMarker` at `(0, 0)` and `(6400000, 6400000)`

#### Scenario: Piece text has no font of its own
- **WHEN** any map is drawn
- **THEN** only the root `svg` element carries `font-family`, and no attribute other than `font-family` and those carrying catalogue text (`data-zone`, escaped as `&apos;`) holds an apostrophe

### Requirement: Software map unchanged
For the same catalogue, view, theme and map date, the software map SHALL place every station marker and line where stackledger 0.2.0 places them, unless the catalogue holds a file named `stackledger-skills.yaml`, no longer a catalogue file. A label or terminal badge SHALL leave 0.2.0's place only when 0.2.0 cut the label, a round bend moves it ("Arc obstacles") or the ink around markers changed ("Sticker shadow"). Only the painting may differ, and corners "Round bends" turns into arcs.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG has the station marker centres of the one recorded from 0.2.0, each line path equals the recorded one once each arc is replaced by the corner of its two tangent segments, and the label texts are at the `x` and `y` of that recording as re-recorded with design system 0.8.1

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file

#### Scenario: A cut label now wraps
- **WHEN** the example catalogue is drawn with one component's title changed to `Northwind Customer Relationship Manager`
- **THEN** that station's label has the three rows of "Long title", no text of the SVG ends with `…`, and the other stations keep their rows

#### Scenario: Same ink, same labels
- **WHEN** the example catalogue is laid out by `layoutMap` with the line width and `Ink` of the themes before this change (design system 0.6.0)
- **THEN** every label and terminal badge is where 0.2.0 places it, except a label 0.2.0 cut and one moved by a round bend

### Requirement: Ink casing and outline
In both themes every drawn line SHALL be a pipe: at least 12 units wide in the catalogue colour, over an ink `#121212` (`color.ink`) casing at least 6 units wider, both with round caps and joins. Lines sharing an edge SHALL be spaced at least the line width plus half the casing apart. Stations, terminal badges, licence markers, renewal rings and the legend panel SHALL have an outline: `color.ink` in `light` and `surface.dark.muted` in `dark`, where ink vanishes.

#### Scenario: Pipe line
- **WHEN** line `ship` in `#FF0000` is drawn in either theme
- **THEN** its group holds a path stroked `#121212` at least 6 units wider than the line, followed by the same path stroked `#FF0000`, both with round joins

#### Scenario: Bundled pipes fit side by side
- **WHEN** lines `ship` and `design` both run from `a` to `b`
- **THEN** their strokes are at least the line width plus half the casing apart

#### Scenario: Casing on the dark surface
- **WHEN** line `ship` in `#FF0000` is drawn in the `dark` theme
- **THEN** its casing is stroked `#121212`, the same as in `light`

#### Scenario: Outline on the dark surface
- **WHEN** the example catalogue is drawn in the `dark` theme with its header and legend
- **THEN** the legend panel and every station marker are stroked `#ADA79D`, and no station, terminal badge, licence marker or legend panel is stroked `#121212`

### Requirement: Sticker shadow
Stations, terminal badges, licence markers and the legend panel SHALL have a shadow only when the design system's `map.shadow` is above 0: a copy of the shape in the theme's shadow colour, moved right and down by that offset, drawn first in the same group, without `transform` or `filter`. With the pinned package `map.shadow` is 0, so no shadow copy is drawn. Lines and renewal rings have no shadow.

#### Scenario: Shadow under an interchange
- **WHEN** `slack` is an interchange drawn in the `light` theme
- **THEN** the first shape of its group is its outlined marker, with no copy of it before it, and the SVG has no `transform` or `filter`

#### Scenario: Dark shadow and rim
- **WHEN** the map is drawn with the `dark` theme
- **THEN** no station, terminal badge, licence marker or legend panel has a copy filled `#121110` or a rim filled `#F1EEE8` behind it

#### Scenario: Shadow when the token is above 0
- **WHEN** the sticker of `src/map/ink.ts` draws a shape with a theme whose shadow offset is 4, as a package with `map.shadow` 4 would give
- **THEN** its first shape is a copy in the shadow colour moved 4 right and 4 down, followed by the outlined shape

### Requirement: Rule count is an obstacle
A rule count SHALL be one of the station markers for placement: labels, terminal badges and zone titles avoid it grown by its outline, and the map frame contains it.

#### Scenario: Terminal badge clear of a rule count
- **WHEN** a skill line ends at a station with a rule count and its terminal badge's first position would cover the count
- **THEN** the badge is placed where it does not cover the rule count grown by its outline

#### Scenario: Rule count inside the frame
- **WHEN** a station with a rule count is the top-right station of a skills map
- **THEN** the rule count's box, grown by its ink, lies inside the map frame

### Requirement: Rule count on skills stations
On a skills map, the station of a skill or playbook with at least one rule in the skill set (skill-source "Rules files", "Rule IDs"; the number the `/skills/` list shows) SHALL carry a rule count at the upper right of its marker: that number, or `99+` above 99, in a circle for one digit or a pill for more, in the panel colour, outlined as a licence marker. Agents and software maps have none.

#### Scenario: Skill with rules
- **WHEN** skill `writer` defines 3 rules and agent `reviewer` and skill `editor` (no `rules.md`) are stations of the same skills map
- **THEN** station `skill:writer` holds a rule count showing `3`, and `agent:reviewer` and `skill:editor` hold none

#### Scenario: Duplicate rule ID
- **WHEN** skill `writer`'s `rules.md` defines `WR-1` twice and nothing else
- **THEN** the set holds one rule for `writer` and its station's rule count shows `1`

#### Scenario: Many rules
- **WHEN** a playbook defines 100 rules
- **THEN** its station's rule count shows `99+`

#### Scenario: Software map has no rule count
- **WHEN** a software map of the fictitious example catalogue is drawn
- **THEN** no station holds a rule count

### Requirement: Licence markers
A station SHALL carry a solid licence marker when its component lists, in `spec.dependsOn`, a served licence whose `status` is `active` or `to-confirm`; otherwise a hollow licence marker when such a licence has `status` `to-buy`. The marker is one fixed glyph, independent of cost, currency and cycle, and needs `status` to be visible in the view. Both are the design system's `licenceMark`: the solid one with `state` `owned` (`color.state.healthy`), the hollow one with `state` `toBuy` (white).

#### Scenario: Active and to-buy
- **WHEN** `editor` lists one `active` and one `to-buy` licence
- **THEN** station `editor` has the solid licence marker

#### Scenario: Held licence is green
- **WHEN** `editor` lists an `active` licence and is drawn in either theme
- **THEN** its licence marker equals `licenceMark` with `state` `owned` at the licence point, written by the map's writer, and its face is filled `#3DDC84`

#### Scenario: Licence to buy is white
- **WHEN** `editor` lists only a `to-buy` licence
- **THEN** its licence marker equals `licenceMark` with `state` `toBuy`, and its face is filled `#FFFFFF`

### Requirement: Design system tokens
The `light` and `dark` themes SHALL take their colours and ink measures from the tokens of `@brunosouzas/design-system`, pinned to one exact version: background, text, muted, grid, panel, shadow colour, rim colour and rim width from `surface.<theme>`; outline width, shadow offset, line width, casing and bend radius from `map`; ink, station and badge text from `color`; licence, renewal and accent colours from `color.state`; the font stack from `font.sans` ("Themes").

#### Scenario: Theme values are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its background equals `surface.dark.background`, its outline colour `surface.dark.muted`, its shadow colour `surface.dark.shadow`, its rim width `surface.dark.rimWidth`, its outline width `map.outline`, its line width `map.lineWidth` and its bend radius `map.bendRadius`

#### Scenario: Light theme has no rim
- **WHEN** the `light` theme is read
- **THEN** its rim is disabled, because `surface.light.rimWidth` is 0, its outline colour is `color.ink`, and `inkOf` gives an outline equal to `map.outline`

#### Scenario: Dark theme has no rim and no shadow
- **WHEN** the `dark` theme is read
- **THEN** its rim is disabled, because `surface.dark.rimWidth` is 0, and `inkOf` gives an outline equal to `map.outline` and a shadow of `[0, 0]`, because `map.shadow` is 0

#### Scenario: State colours are the tokens
- **WHEN** either theme is read
- **THEN** its licence colour is `color.state.healthy` (`#3DDC84`), its renewal colour `color.state.blocked` (`#FF8A3D`) and its accent `color.state.caller` (`#8FB2FF`)

### Requirement: Theme ink comes from the design system
The map and diagram renderers SHALL refuse, with an error naming the field, a theme whose outline colour or width, shadow, rim, casing, line width, bend radius, licence colour, renewal colour, zone opacity or zone title tint differs from the tokens of its `surface`, because the pieces paint those from the tokens and the layout must count the same ink and the same arcs. Other theme fields are not checked.

#### Scenario: Custom ink is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `outlineWidth` 9, or with a shadow offset of 4
- **THEN** it throws an error naming `outlineWidth`, or `shadow`, and returns no SVG

#### Scenario: Custom piece colour is refused
- **WHEN** `renderSvg`, `renderSymbol` or `renderNeighbourhood` is given a copy of `themes.light` with `zoneOpacity` 0.5, or with `licence` `#FFD25A`
- **THEN** it throws an error naming `zoneOpacity`, or `licence`, and returns no SVG

#### Scenario: Custom bend radius is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `bendRadius` 16
- **THEN** it throws an error naming `bendRadius` and returns no SVG

#### Scenario: Other theme fields stay free
- **WHEN** `renderSvg` is given a copy of `themes.light` with `background` `#FFFFFF`
- **THEN** it draws the map with that background

### Requirement: Legend interchange symbol
The legend's interchange symbol SHALL be a vertical capsule drawn by `stationMarker` with radius 6 from 1.5 units above to 1.5 units below the symbol's centre point, so that with its outline it stays inside the 24 × 24 symbol in both themes.

#### Scenario: Legend interchange is a capsule
- **WHEN** the interchange symbol is drawn on its own, in either theme
- **THEN** its outlined marker is a closed `path` with two arcs, the symbol has no `circle`, and every shape of the symbol, grown by half its stroke width, lies inside `0 0 24 24`

### Requirement: Piece colours in the themes
The `light` and `dark` themes SHALL hold the values the pieces paint: licence colour `color.state.healthy`, renewal colour `color.state.blocked`, zone opacity `surface.<theme>.zoneOpacity`, and zone title tint `map.zoneTitleTint` in `dark` and 0 in `light`.

#### Scenario: Piece colours are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its licence colour is `color.state.healthy`, its renewal colour `color.state.blocked`, its zone opacity `surface.dark.zoneOpacity` and its zone title tint `map.zoneTitleTint`

#### Scenario: Light zone titles are not tinted
- **WHEN** the `light` theme is read
- **THEN** its zone title tint is 0 and its zone opacity `surface.light.zoneOpacity`

### Requirement: Map backdrop
The software map SHALL take a backdrop, `neutral` or `london`, with or without its header and legend. With `neutral` the SVG SHALL have no backdrop group and no credit, and be the same, byte for byte, as the neutral maps re-recorded with design system 0.8.1. A backdrop SHALL NOT move any station, line, label, badge, zone, header or legend. The skills map, the neighbourhood diagrams, the strips and the relation diagram SHALL NOT take a backdrop.

#### Scenario: Neutral is today's map
- **WHEN** the example catalogue is drawn with `neutral`, map date 2027-06-01, in the `full` view and both themes
- **THEN** each SVG equals, byte for byte, `docs/images/map-light.svg` and `docs/images/map-dark.svg` as re-recorded with design system 0.8.1, and the `staff` view in both themes equals the SVG re-recorded with design system 0.8.1 with the same options

#### Scenario: Neutral site map is today's map
- **WHEN** the example catalogue's software map is drawn without header and legend, as the site draws it, with `neutral`, in both views and both themes
- **THEN** each SVG equals, byte for byte, the one re-recorded with design system 0.8.1 with the same options

#### Scenario: Backdrop moves nothing
- **WHEN** the example catalogue is drawn with `london` and with `neutral` in both views and both themes
- **THEN** both SVGs, with the backdrop group and the credit removed, are identical

#### Scenario: Skills map stays flat
- **WHEN** a skills map is drawn for a catalogue whose settings have `spec.map.backdrop: london`
- **THEN** its SVG has no backdrop group and no credit

### Requirement: Backdrop layer
With `london` the SVG SHALL hold one more group, right after the background layer and right before the grid layer, with exactly two paths: the water, filled with the surface's `backdropWater` and outlined with `backdropWaterEdge`, then the parks, filled with `backdropPark`, from the theme's surface tokens of `@brunosouzas/design-system` ("Design system tokens"). The writer's allow-list ("Allowed attributes") SHALL stay unchanged: no `fill-rule`, `transform`, `clip-path` or new attribute name.

#### Scenario: London layer order
- **WHEN** the example catalogue is drawn with `london` in either theme, with and without its header and legend
- **THEN** the group right after the background layer holds exactly two paths, the water path first, and the grid layer comes right after it

#### Scenario: London colours are the tokens
- **WHEN** the example catalogue is drawn with `london` in the `dark` theme
- **THEN** the water fill equals `surface.dark.backdropWater`, its stroke `surface.dark.backdropWaterEdge` and the park fill `surface.dark.backdropPark`

#### Scenario: London colours on the v2 surfaces
- **WHEN** the example catalogue is drawn with `london` in the `light` theme, then in the `dark` theme
- **THEN** the water is filled `#C7DAEA` and stroked `#A9C4DA` and the parks filled `#D6E4CF` in `light`, and `#1C2733`, `#2A3846` and `#1A241D` in `dark`

#### Scenario: Holes without fill-rule
- **WHEN** the London data is drawn in either theme
- **THEN** every hole of a polygon is wound opposite to its outer ring, so the default non-zero fill rule leaves it empty

### Requirement: Backdrop credit
A software map drawn with a city backdrop SHALL end, before the closing tag, with the text `© OpenStreetMap contributors`, right-aligned near the bottom-right corner of the viewBox, in the surface's `backdropCredit` colour, inside the viewBox and, when the legend is drawn, clear of it. A map drawn with `neutral` SHALL NOT carry it.

#### Scenario: Credit on London
- **WHEN** the example catalogue is drawn with `london` in either theme, with and without its header and legend
- **THEN** the SVG contains the text `© OpenStreetMap contributors`, its box lies inside the viewBox and does not overlap the legend

#### Scenario: Credit colour on the v2 surfaces
- **WHEN** the example catalogue is drawn with `london` in the `light` theme, then in the `dark` theme
- **THEN** the credit text is filled `#5C5852` in `light` and `#ADA79D` in `dark`

#### Scenario: No credit on neutral
- **WHEN** the example catalogue is drawn with `neutral`
- **THEN** the SVG does not contain `OpenStreetMap`
