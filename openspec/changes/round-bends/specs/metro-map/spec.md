## ADDED Requirements

### Requirement: Round bends
An eligible bend SHALL be drawn round: every line of its bundle turns along a circular arc around one shared centre, on the inside of the turn at `map.bendRadius` / cos(half the deflection) from the node, tangent to the line's two offset segments. Every line of a bend that is not eligible keeps the mitred corner. A bend is eligible when it is a candidate ("Bend candidates") and every line of its bundle has room ("Room for an arc").

#### Scenario: Single line turns round
- **WHEN** line `ship` turns 90 degrees at grid node `[1, 1]`, which holds no station, between straight segments long enough for the arc
- **THEN** its drawn path holds one arc of radius `map.bendRadius`, tangent to both segments at `map.bendRadius` from the node, and no mitre corner

#### Scenario: 45-degree turn
- **WHEN** line `ship` turns from a horizontal edge onto a diagonal edge at a node with no station
- **THEN** its arc is centred at `map.bendRadius` / cos(22.5°) from the node, on the inside of the turn, its radius is `map.bendRadius`, and its tangent points are `map.bendRadius` × tan(22.5°) from the node

#### Scenario: Mirrored turns
- **WHEN** one line turns clockwise on screen and another, elsewhere, turns anticlockwise by the same angle
- **THEN** the first arc has sweep flag 1 and the second sweep flag 0, both with large-arc flag 0

#### Scenario: Bundle turns around one centre
- **WHEN** lines `ship` and `secrets` share a horizontal edge and both turn onto the same vertical edge at a node with no station
- **THEN** both arcs have the same centre, their radii differ by the gap between the two lines, and neither line crosses the other

#### Scenario: Reversed travel draws the same bends
- **WHEN** the same map is drawn with the stops of `secrets` in reverse order
- **THEN** every arc has the same centre and radius as before

#### Scenario: Skills map turns round
- **WHEN** a skills map line turns 90 degrees at a node with no station
- **THEN** its drawn path holds an arc of radius `map.bendRadius`, as on the software map

### Requirement: Bend candidates
A bend SHALL be a candidate when it is a grid node, not a station position, where lines turn 45 or 90 degrees between two grid edges that hold the same lines, each running from one edge onto the other there, and every line's signed radius is at least half its outer width (line width plus casing). The bundle is every line on those two edges, whatever its direction of travel. A line's signed radius is `map.bendRadius` minus its offset towards the inside of the turn.

#### Scenario: Wide bundle stays mitred
- **WHEN** five lines share an edge and turn 90 degrees together at a node with no station
- **THEN** the innermost line's signed radius is less than half its outer width, and all five keep the mitred corner

#### Scenario: Middle line goes straight on
- **WHEN** three lines share an edge into a node with no station, the outer two turn and the middle one goes straight on
- **THEN** the node is not a candidate for the two that turn

### Requirement: Room for an arc
A line SHALL have room for an arc when its setback, its signed radius ("Bend candidates") × tan(half the deflection), fits on both straight segments of its mitred polyline that meet at the bend. A segment whose other end is also a candidate gives each end half its length; any other segment gives the whole length. Room is decided from every bend's candidate state at once, never from another bend's outcome.

#### Scenario: Arcs with no room stay mitred
- **WHEN** a bundle of three lines turns 90 degrees at two candidate nodes one grid edge apart, and the outer line's setback is more than half that edge
- **THEN** both bends keep the mitred corner for all three lines

#### Scenario: Chained conflicts
- **WHEN** one line turns at three candidate nodes in a row, one grid edge apart, and every setback is more than half an edge
- **THEN** all three bends keep the mitred corner, in either direction of travel

#### Scenario: Bend next to a connector or an end
- **WHEN** a line turns at a candidate node one edge after a slot-change connector, and another one edge before its last stop
- **THEN** each turns round when its setback fits within the whole shared segment, and keeps the mitre otherwise

## MODIFIED Requirements

### Requirement: Octilinear routing
Each hop SHALL first get a centreline of horizontal, vertical and 45-degree segments between grid points. The centreline SHALL NOT pass through the point of any station other than its two ends, and SHALL NOT turn by more than 90 degrees at a grid point. It stays inside the bounding box of the hop's two ends widened by three cells. Rendered parallel strokes MAY lie off-grid, and their round bends are circular arcs.

#### Scenario: Station in the way
- **WHEN** line `ship` goes from `[0, 0]` to `[4, 0]` and component `vault` is at `[2, 0]`
- **THEN** the path of that hop does not pass through `[2, 0]`

#### Scenario: Straight when nothing is in the way
- **WHEN** two consecutive stops are at `[0, 0]` and `[3, 0]`, no station lies between them and no other hop uses those edges
- **THEN** the hop is one horizontal segment

#### Scenario: Angles
- **WHEN** a map is laid out
- **THEN** every straight part of every drawn stroke, offset connectors included, is horizontal, vertical or at 45 degrees, except reported straight fallbacks, and every other part is a circular arc of a round bend

### Requirement: Bundles through bends
When every line on a grid edge continues together onto the next edge, the bundle SHALL keep its order through the bend instead of re-sorting by the next edge. Its lines turn round, as in "Round bends", or, when the bend is not eligible, each line's two offset segments meet at a mitred corner.

#### Scenario: Bundle keeps its sides through a bend
- **WHEN** lines `ship` and `secrets` run together along a horizontal edge and both turn onto the same diagonal edge at a node with no station
- **THEN** each line stays on its side of the bundle through the bend, both turn round, and neither line crosses the other

#### Scenario: Bend at a station stays mitred
- **WHEN** line `ship` turns 90 degrees at the position of its stop `b`
- **THEN** its drawn path has the mitred corner at `b`'s centre and no arc there

#### Scenario: Bundle splits at a bend
- **WHEN** lines `ship`, `docs` and `secrets` share an edge into a node with no station, where `ship` and `secrets` turn and `docs`, the middle line, goes straight on
- **THEN** the bend keeps the mitred corner for `ship` and `secrets`

#### Scenario: Bundles merge at a bend
- **WHEN** line `ship` turns at a node with no station onto an edge that `secrets` joins at that node
- **THEN** the bend keeps the mitred corner for `ship`

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, station markers, licence markers, rule counts and terminal badges grown by their outline and shadow, zone titles, and each part of a line's drawn path: each straight part as a rectangle as wide as its casing, and each arc as chords of at most 15 degrees, each a rectangle as wide as the casing plus twice the chord's sagitta. When every candidate overlaps, the one with the least intersected area wins, ties to the earlier candidate.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station, its shadow, a terminal badge or a badge's shadow

#### Scenario: Larger ink pushes a label out
- **WHEN** a label would fit next to a station marker without its ink but would touch the marker's shadow
- **THEN** the label is placed at a candidate clear of the marker grown by its outline and shadow

#### Scenario: Rule count pushes a label out
- **WHEN** a skills station's label would fit at its first candidate, to the right, only if the station had no rule count
- **THEN** the label is placed at a later candidate that does not cover the rule count grown by its outline and shadow

#### Scenario: Label clears a round bend
- **WHEN** a station's first label candidate is clear of the line's mitred polyline but would cover the inside of the arc that replaces the corner
- **THEN** the label is placed at a later candidate clear of the arc

#### Scenario: Label clears the outside of a curve
- **WHEN** a label candidate would touch only the outer edge of an arc's casing, midway between two chord ends
- **THEN** that candidate counts as overlapping the line

### Requirement: Design system tokens
The `light` and `dark` themes SHALL take their colours and ink measures from the tokens of `@brunosouzas/design-system`, pinned to one exact version: background, text, muted, grid, panel, shadow colour, rim colour and rim width from `surface.<theme>`; outline width, shadow offset, line width, casing and bend radius from `map`; ink, station, badge text, licence, renewal and accent colours from `color`. The font stack stays the one of "Themes".

#### Scenario: Theme values are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its background equals `surface.dark.background`, its shadow colour `surface.dark.shadow`, its rim width `surface.dark.rimWidth`, its outline width `map.outline`, its line width `map.lineWidth` and its bend radius `map.bendRadius`

#### Scenario: Light theme has no rim
- **WHEN** the `light` theme is read
- **THEN** its rim is disabled, because `surface.light.rimWidth` is 0, and `inkOf` gives an outline equal to `map.outline`

### Requirement: Theme ink comes from the design system
The map and diagram renderers SHALL refuse, with an error naming the field, a theme whose outline colour or width, shadow, rim, casing, line width or bend radius differs from the tokens of its `surface`, because the pieces paint those from the tokens and the layout must count the same ink and the same arcs.

#### Scenario: Custom ink is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `outlineWidth` 9, or with the shadow turned off
- **THEN** it throws an error naming `outlineWidth`, or `shadow`, and returns no SVG

#### Scenario: Custom bend radius is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `bendRadius` 16
- **THEN** it throws an error naming `bendRadius` and returns no SVG

#### Scenario: Other theme fields stay free
- **WHEN** `renderSvg` is given a copy of `themes.light` with another `zoneOpacity`
- **THEN** it draws the map with that zone opacity

### Requirement: Software map unchanged
For the same catalogue, view, theme and map date, the software map SHALL place every station marker where stackledger 0.2.0 places it and every line along the 0.2.0 path, unless the catalogue holds a file named `stackledger-skills.yaml`, which is no longer a catalogue file. Labels stay where 0.2.0 places them, except a station label that 0.2.0 cut (one that needs more than two rows or breaks inside a word) and a label whose candidate a round bend's obstacle now covers. Only the painting may differ, and a corner that "Round bends" turns into an arc.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG has the same station marker centres and the same label texts at the same `x` and `y` as the one recorded from 0.2.0, and each line path equals the recorded one once each arc is replaced by the corner of its two tangent segments

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file

#### Scenario: A cut label now wraps
- **WHEN** the example catalogue is drawn with one component's title changed to `Northwind Customer Relationship Manager`
- **THEN** that station's label has the three rows of "Long title", no text of the SVG ends with `…`, and the other stations keep their rows
