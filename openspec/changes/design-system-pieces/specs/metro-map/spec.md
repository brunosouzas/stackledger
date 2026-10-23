## ADDED Requirements

### Requirement: Map symbols drawn by the pieces
Licence markers, renewal rings, suggested halos and zones SHALL be drawn by the design system's `licenceMark`, `renewalRing`, `suggestedHalo` and `zone`, on the map and in its legend, and written by the map's own SVG writer under the same rules as the pieces of "Design system pieces"; a piece node outside those rules SHALL make drawing fail.

#### Scenario: Legend symbols drawn by the pieces
- **WHEN** `renderSymbol` draws `licence`, `licence to buy`, `suggested position` and `renewal within 30 days` in either theme
- **THEN** they equal `licenceMark` (`owned`, then `toBuy`), `suggestedHalo` with radius 9 and `renewalRing` with radius 6.5, at the symbol's centre and the theme's surface, written by the map's writer

#### Scenario: Far symbols drawn by the pieces
- **WHEN** a suggested station with an active licence renewing within 30 days in a zone is at `(6400000, 6400000)` in the `full` view
- **THEN** the map is drawn in both themes, with its halo, ring, licence marker and zone drawn by the pieces at that point

### Requirement: Piece colours in the themes
The `light` and `dark` themes SHALL hold the values the pieces paint: licence colour `color.healthy`, renewal colour `color.blocked`, zone opacity `surface.<theme>.zoneOpacity`, and zone title tint `map.zoneTitleTint` in `dark` and 0 in `light`.

#### Scenario: Piece colours are the tokens
- **WHEN** the `dark` theme is read
- **THEN** its licence colour is `color.healthy`, its renewal colour `color.blocked`, its zone opacity `surface.dark.zoneOpacity` and its zone title tint `map.zoneTitleTint`

#### Scenario: Light zone titles are not tinted
- **WHEN** the `light` theme is read
- **THEN** its zone title tint is 0 and its zone opacity `surface.light.zoneOpacity`

### Requirement: Blank zone title
A zone whose title is only whitespace (JavaScript `trim()` gives an empty string), which the catalogue accepts and the `zone` piece refuses, SHALL be drawn as its area alone, by `zone` without a title, with its title box still an obstacle.

#### Scenario: Blank zone title
- **WHEN** zone `finance` has the title `" "`, which the catalogue accepts
- **THEN** the map is drawn, with the area of `finance` equal to `zone` without a title and no text for that zone

### Requirement: Piece limits
A map whose renewal ring or suggested halo would need a radius above 10,000 map units (an interchange spanning about 1,200 parallel lines), or whose zone hull has more than 10,000 points, SHALL fail to draw with an error, because the design system's pieces refuse those inputs; the map is not drawn with a smaller ring or a cut zone. Both are far beyond "Size and speed".

#### Scenario: Ring beyond the piece's limit
- **WHEN** `renderSvg` is given a geometry whose renewed station has a halo of 10,010.75
- **THEN** it throws and returns no SVG

#### Scenario: Ring at the piece's limit
- **WHEN** `renderSvg` is given a geometry whose renewed, not suggested, station has a halo of 10,000
- **THEN** it draws the ring with radius 10,000

## MODIFIED Requirements

### Requirement: Suggestion without neighbours
A station with no placed or already-suggested neighbour SHALL be suggested at the free cell in row 0 with the smallest column greater than every stored and suggested column, or column 0 when there is none. A suggested station SHALL keep its normal tick or interchange marker and additionally carry the design system's `suggestedHalo` (a dashed circle in the surface's muted colour) centred on its grid point, with radius 3 more than the station's halo.

#### Scenario: Nothing placed
- **WHEN** line `ship` stops at `a`, `b` and `c` and there is no `MapLayout`
- **THEN** `a` is suggested at `[0, 0]`, `b` at `[1, 0]` and `c` at `[2, 0]`

#### Scenario: Suggested interchange
- **WHEN** unplaced `slack` is a stop of two lines
- **THEN** it has the interchange marker spanning both lines and the dashed suggestion disc

#### Scenario: Halo drawn by the piece
- **WHEN** unplaced station `a` is drawn in either theme
- **THEN** its group holds `suggestedHalo` for its centre, radius its halo plus 3 and the theme's surface, written by the map's writer

### Requirement: Zones
Each zone declared in the served `MapLayout` with at least one drawn station SHALL be drawn, in declaration order, by the design system's `zone`: the convex hull of its stations' points, widened by `map.zonePadding` (32) with rounded corners, in the zone's colour at the surface's `zoneOpacity`, with the zone's title at its title box (tinted on the dark surface). A station joins a zone through its component's `stackledger/zone` label. The area may cover stations outside the zone.

#### Scenario: Zone area
- **WHEN** zone `finance` has stations `xero` and `stripe`
- **THEN** the map has one area for `finance` containing both station points and the title of the zone

#### Scenario: Zone drawn by the piece
- **WHEN** zone `finance` (`#9B0056`) is drawn in either theme
- **THEN** its area and title equal `zone` for the zone's hull points, colour, title, title box corner and the theme's surface, written by the map's writer

#### Scenario: One-station zone
- **WHEN** zone `finance` has one drawn station
- **THEN** its area is a circle of radius 32 around that station, as `zone` draws a one-point hull

### Requirement: Licence markers
A station SHALL carry a solid licence marker when its component lists, in `spec.dependsOn`, a served licence whose `status` is `active` or `to-confirm`; otherwise a hollow licence marker when such a licence has `status` `to-buy`. The marker is one fixed glyph, independent of cost, currency and cycle, and needs `status` to be visible in the view. Both are the design system's `licenceMark`: the solid one with `state` `owned` (green, `color.healthy`), the hollow one with `state` `toBuy` (white).

#### Scenario: Active and to-buy
- **WHEN** `editor` lists one `active` and one `to-buy` licence
- **THEN** station `editor` has the solid licence marker

#### Scenario: Held licence is green
- **WHEN** `editor` lists an `active` licence and is drawn in either theme
- **THEN** its licence marker equals `licenceMark` with `state` `owned` at the licence point, written by the map's writer, and its face is filled `#3DDC84`

#### Scenario: Licence to buy is white
- **WHEN** `editor` lists only a `to-buy` licence
- **THEN** its licence marker equals `licenceMark` with `state` `toBuy`, and its face is filled `#FFFFFF`

### Requirement: Renewal ring
In the `full` view only, a station SHALL carry a renewal ring when a licence that gives it a solid marker has `renewsOn` from the map date to the map date plus 30 days, both included. Overdue renewals get no ring. The `staff` map SHALL NOT depend on the map date nor on any hidden field. The ring is the design system's `renewalRing` around the station's centre, with the station's halo as its radius.

#### Scenario: Renewal soon in full
- **WHEN** the view is `full`, the map date is `2027-06-01` and `editor` lists an active licence renewing on `2027-07-01`
- **THEN** station `editor` has a renewal ring

#### Scenario: Ring drawn by the piece
- **WHEN** station `editor` has a renewal ring in either theme
- **THEN** the ring equals `renewalRing` for the station's centre, its halo as radius and the theme's surface, written by the map's writer

#### Scenario: Staff ignores hidden fields and the date
- **WHEN** two catalogues are identical except that a drawn component's active licence renews on `2027-06-15` in the first and `2027-08-01` in the second, and their `staff` maps are drawn with dates `2027-06-01` and `2027-09-01`
- **THEN** the two `staff` SVGs are byte-identical, and the two `full` maps drawn with date `2027-06-01` differ, with a renewal ring only in the first

### Requirement: Theme ink comes from the design system
The map and diagram renderers SHALL refuse, with an error naming the field, a theme whose outline colour or width, shadow, rim, casing, line width, licence colour, renewal colour, zone opacity or zone title tint differs from the tokens of its `surface`, because the pieces paint those from the tokens and the layout must count the same ink. Other theme fields are not checked.

#### Scenario: Custom ink is refused
- **WHEN** `renderSvg` is given a copy of `themes.light` with `outlineWidth` 9, or with the shadow turned off
- **THEN** it throws an error naming `outlineWidth`, or `shadow`, and returns no SVG

#### Scenario: Custom piece colour is refused
- **WHEN** `renderSvg`, `renderSymbol` or `renderNeighbourhood` is given a copy of `themes.light` with `zoneOpacity` 0.5, or with `licence` `#FFD25A`
- **THEN** it throws an error naming `zoneOpacity`, or `licence`, and returns no SVG

#### Scenario: Other theme fields stay free
- **WHEN** `renderSvg` is given a copy of `themes.light` with `background` `#FFFFFF`
- **THEN** it draws the map with that background

