## ADDED Requirements

### Requirement: Round bends
Where a line turns 45 or 90 degrees at a grid node that is not a station position, its corner SHALL be drawn as a circular arc tangent to its two offset segments. The lines of a bundle that turn together SHALL share one centre, on the inside of the turn at `map.bendRadius` / cos(half the deflection) from the node, so the bundle's centre line has radius `map.bendRadius` and the gaps between lines stay the same.

#### Scenario: Single line turns round
- **WHEN** line `ship` turns 90 degrees at grid node `[1, 1]`, which holds no station
- **THEN** its drawn path holds one arc of radius `map.bendRadius`, tangent to both segments at `map.bendRadius` from the node, and no mitre corner

#### Scenario: 45-degree turn
- **WHEN** line `ship` turns from a horizontal edge onto a diagonal edge at a node with no station
- **THEN** its arc is centred at `map.bendRadius` / cos(22.5°) from the node, on the inside of the turn, and its radius is `map.bendRadius`

#### Scenario: Bundle turns around one centre
- **WHEN** lines `ship` and `secrets` share a horizontal edge and both turn onto the same vertical edge at a node with no station
- **THEN** both arcs have the same centre, their radii differ by the gap between the two lines, and neither line crosses the other

#### Scenario: Skills map turns round
- **WHEN** a skills map line turns 90 degrees at a node with no station
- **THEN** its drawn path holds an arc of radius `map.bendRadius`, as on the software map

## MODIFIED Requirements

### Requirement: Bundles through bends
When every line on a grid edge continues together onto the next edge, the bundle SHALL keep its order through the bend instead of re-sorting by the next edge. Its lines SHALL turn as described in "Round bends", except that the two offset segments of each line SHALL meet at a mitred corner when the bend is at a station position, when the line's offset differs between the two edges, or when an arc would not fit: a tangent point would fall outside the straight part of either edge, which is what is left after the arcs at its two ends. The lines of a bundle that share both edges at a bend SHALL either all turn round or all keep the mitre.

#### Scenario: Bundle keeps its sides through a bend
- **WHEN** lines `ship` and `secrets` run together along a horizontal edge and both turn onto the same diagonal edge at a node with no station
- **THEN** each line stays on its side of the bundle through the bend, both turn round, and neither line crosses the other

#### Scenario: Bend at a station stays mitred
- **WHEN** line `ship` turns 90 degrees at the position of its stop `b`
- **THEN** its drawn path has the mitred corner at `b`'s centre and no arc there

#### Scenario: Bundle splits at a bend
- **WHEN** lines `ship` and `secrets` share an edge into a node with no station, where `ship` turns and `secrets` goes straight on
- **THEN** `ship`'s offset changes at that node, and its corner there is mitred

#### Scenario: Arcs with no room stay mitred
- **WHEN** a bundle of three lines turns 90 degrees at two neighbouring nodes with no station, one grid edge apart, and the outer line's arcs at the two ends of that edge would overlap
- **THEN** both bends keep the mitred corner for all three lines

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, station markers, licence markers, rule counts and terminal badges grown by their outline and shadow, zone titles, and each part of a line's drawn path as a rectangle as wide as its casing: each straight part, and each arc as chords of at most 15 degrees. When every candidate overlaps, the one with the least intersected area wins, ties to the earlier candidate.

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

### Requirement: Design system tokens
The `light` and `dark` themes SHALL take their colours and ink measures from the tokens of `@brunosouzas/design-system`, pinned to one exact version: background, text, muted, grid, panel, shadow colour, rim colour and rim width from `surface.<theme>`; outline width, shadow offset, line width, casing and bend radius from `map`; ink, station, badge text, licence, renewal and accent colours from `color`. The font stack stays the one of "Themes".

#### Scenario: Theme values are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its background equals `surface.dark.background`, its shadow colour `surface.dark.shadow`, its rim width `surface.dark.rimWidth`, its outline width `map.outline`, its line width `map.lineWidth` and its bend radius `map.bendRadius`

#### Scenario: Light theme has no rim
- **WHEN** the `light` theme is read
- **THEN** its rim is disabled, because `surface.light.rimWidth` is 0, and `inkOf` gives an outline equal to `map.outline`

### Requirement: Software map unchanged
For the same catalogue, view, theme and map date, the software map SHALL place every station marker and label where stackledger 0.2.0 places them, and every line along the 0.2.0 path, unless the catalogue holds a file named `stackledger-skills.yaml`, which is no longer a catalogue file, or a station label that 0.2.0 cut: one that needs more than two rows or breaks inside a word. Only the painting may differ, and a corner that "Round bends" turns into an arc.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG has the same station marker centres and the same label texts at the same `x` and `y` as the one recorded from 0.2.0, and each line path equals the recorded one once each arc is replaced by the corner of its two tangent segments

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file

#### Scenario: A cut label now wraps
- **WHEN** the example catalogue is drawn with one component's title changed to `Northwind Customer Relationship Manager`
- **THEN** that station's label has the three rows of "Long title", no text of the SVG ends with `…`, and the other stations keep their rows

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
