## ADDED Requirements

### Requirement: Design system tokens
The `light` and `dark` themes SHALL take their colours and ink measures from the tokens of `@brunosouzas/design-system`, pinned to one exact version: background, text, muted, grid, panel, shadow colour, rim colour and rim width from `surface.<theme>`; outline width, shadow offset, line width and casing from `map`; ink, station, badge text, licence, renewal and accent colours from `color`; the font stack from `font.sans`.

#### Scenario: Theme values are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its background equals `surface.dark.background`, its shadow colour `surface.dark.shadow`, its rim width `surface.dark.rimWidth`, its outline width `map.outline` and its line width `map.lineWidth`

#### Scenario: Light theme has no rim
- **WHEN** the `light` theme is read
- **THEN** its rim is disabled, because `surface.light.rimWidth` is 0, and `inkOf` gives an outline equal to `map.outline`

### Requirement: Design system pieces
Stop and interchange markers, lines, terminal badges and rule counts SHALL be drawn by the design system's `stationMarker`, `pipe`, `lineBadge` and `countBadge`. Their output SHALL be written by the map's own SVG writer, which applies "Safe SVG structure", "Allowed attributes", "Allowed attribute values" and "Safe SVG text"; a piece node outside those rules SHALL make drawing fail.

#### Scenario: Stop drawn by the piece
- **WHEN** station `a`, a stop of one line, is drawn in the `light` theme
- **THEN** its marker equals `stationMarker` for the same centre and radius, written by the map's writer

#### Scenario: Piece node outside the allow-list
- **WHEN** the map's writer is given a piece node with a `transform` attribute
- **THEN** it throws and returns no SVG

## MODIFIED Requirements

### Requirement: Stations and interchanges
A station served by one line SHALL be drawn as a circle in the theme's station colour, centred on its line and wider than the pipe. A station served by two or more lines SHALL be drawn as an interchange: a capsule (corner radius half its short side) in the station colour, larger than a stop circle, spanning every line through it. The legend's interchange symbol SHALL be a capsule too. A component whose `spec.lifecycle` equals `deprecated`, ignoring case, has its station marker and label muted; its lines are not.

#### Scenario: Interchange
- **WHEN** `slack` is a stop of three lines
- **THEN** it is drawn as one interchange marker spanning the three lines

#### Scenario: Stations are circles
- **WHEN** `a` is a stop of one line and `slack` of two, in either theme
- **THEN** `a` is a white circle with an ink outline whose diameter exceeds the pipe's outer width, and `slack` is a capsule with a larger radius that contains all its contact points

#### Scenario: Diagonal interchange contains every contact
- **WHEN** eight lines share the diagonal edge from `a` at `[0, 0]` to `b` at `[4, 4]`
- **THEN** every contact of the lines at `a` lies inside the drawn interchange capsule, in both themes

#### Scenario: Legend interchange is a capsule
- **WHEN** the interchange symbol is drawn on its own, in either theme
- **THEN** its outlined marker is a closed `path` with two arcs and the symbol has no `circle`

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
