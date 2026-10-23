## ADDED Requirements

### Requirement: Design system tokens
The `light` and `dark` themes SHALL take their colours and ink measures from the tokens of `@brunosouzas/design-system`, pinned to one exact version: background, text, muted, grid, panel, shadow colour, rim colour and rim width from `surface.<theme>`; outline width, shadow offset, line width and casing from `map`; ink, station, badge text, licence, renewal and accent colours from `color`. The font stack stays the one of "Themes".

#### Scenario: Theme values are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its background equals `surface.dark.background`, its shadow colour `surface.dark.shadow`, its rim width `surface.dark.rimWidth`, its outline width `map.outline` and its line width `map.lineWidth`

#### Scenario: Light theme has no rim
- **WHEN** the `light` theme is read
- **THEN** its rim is disabled, because `surface.light.rimWidth` is 0, and `inkOf` gives an outline equal to `map.outline`

### Requirement: Theme ink comes from the design system
The map and diagram renderers SHALL refuse, with an error naming the field, a theme whose outline colour or width, shadow, rim, casing or line width differs from the tokens of its `surface`, because the pieces paint those from the tokens and the layout must count the same ink.

#### Scenario: Custom ink is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `outlineWidth` 9, or with the shadow turned off
- **THEN** it throws an error naming `outlineWidth`, or `shadow`, and returns no SVG

#### Scenario: Other theme fields stay free
- **WHEN** `renderSvg` is given a copy of `themes.light` with another `zoneOpacity`
- **THEN** it draws the map with that zone opacity

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
- **THEN** only the root `svg` element carries `font-family`, and no attribute value holds an apostrophe

### Requirement: Legend interchange symbol
The legend's interchange symbol SHALL be a vertical capsule drawn by `stationMarker` with radius 6 from 1.5 units above to 1.5 units below the symbol's centre point, so that with its outline, rim and shadow it stays inside the 24 × 24 symbol in both themes.

#### Scenario: Legend interchange is a capsule
- **WHEN** the interchange symbol is drawn on its own, in either theme
- **THEN** its outlined marker is a closed `path` with two arcs, the symbol has no `circle`, and every shape of the symbol, grown by half its stroke width, lies inside `0 0 24 24`

## MODIFIED Requirements

### Requirement: Hard offset shadow
Stations, terminal badges, licence markers and the legend panel SHALL have a hard offset shadow: a copy of the shape in the theme's shadow colour, moved right and down by the theme's offset, drawn first in the same group, without `transform` or `filter`. Lines and renewal rings have no shadow.

#### Scenario: Shadow under an interchange
- **WHEN** `slack` is an interchange drawn in the `light` theme
- **THEN** its group holds, before the outlined marker, a shape filled `#0A1033` at the marker's position plus the theme's offset, and the SVG has no `transform` or `filter`

#### Scenario: Dark shadow and rim
- **WHEN** the map is drawn with the `dark` theme
- **THEN** shadows are filled `#4C5CB8`, outlined stickers carry a `#EEF2FF` rim, and no shadow is filled `#0A1033`

### Requirement: Software map unchanged
For the same catalogue, view, theme and map date, the software map SHALL place every line, station marker and label where stackledger 0.2.0 places them, unless the catalogue holds a file named `stackledger-skills.yaml`, which is no longer a catalogue file, or a station label that 0.2.0 cut: one that needs more than two rows or breaks inside a word. Only the painting may differ.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG has the same line paths (`d`), the same station marker centres and the same label texts at the same `x` and `y` as the one recorded from 0.2.0

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file

#### Scenario: A cut label now wraps
- **WHEN** the example catalogue is drawn with one component's title changed to `Northwind Customer Relationship Manager`
- **THEN** that station's label has the three rows of "Long title", no text of the SVG ends with `…`, and the other stations keep their rows
