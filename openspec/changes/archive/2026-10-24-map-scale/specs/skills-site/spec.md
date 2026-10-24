## ADDED Requirements

### Requirement: Skills map shown size
`/skill-map/` SHALL size the skills map and its frame as the software map page does (catalogue-site, "Map shown size"): the initial viewBox width in CSS pixels, or narrower when the frame's room is smaller, the frame's content box as wide as the map and centred, and the same size while zooming and panning, with no inline style or script.

#### Scenario: Skills map not enlarged
- **GIVEN** a 1360-pixel-wide window and the example skills map, whose viewBox is narrower than the room
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the map is as wide as its viewBox, the frame's content box is as wide as the map, and the frame's left and right distances to the content column's edges are equal (each within 1 pixel)

#### Scenario: Same ink as the software map
- **GIVEN** a 1360-pixel-wide window
- **WHEN** the reader opens `/full/map/` and `/full/skill-map/`
- **THEN** neither map shows more than 1.01 pixels per initial viewBox unit, and the software map's pixels per unit are within 5% of the skills map's

#### Scenario: Skills map just wider than the room
- **GIVEN** a 677-pixel-wide window, so that the room is narrower than the skills map's 675.6-unit viewBox
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the map is as wide as the frame's content box (within 1 pixel) and the page has no horizontal scroll

#### Scenario: Skills map on a phone
- **GIVEN** a 390-pixel-wide window
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the map is as wide as the frame's content box (within 1 pixel) and the page has no horizontal scroll

#### Scenario: Skills zoom keeps the shown size
- **WHEN** the reader presses zoom in twice on `/full/skill-map/`, then drags the map
- **THEN** the map's width and height on the page are the same as before (within 1 pixel)

#### Scenario: Skills shown size without JavaScript
- **GIVEN** JavaScript is disabled and a 1360-pixel-wide window
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the whole map is shown, as wide as its viewBox (within 1 pixel)

## MODIFIED Requirements

### Requirement: Skills map page
`/skill-map/` SHALL show the skills map of the set in the page theme, with zoom, pan, reset, line highlight and, when a zone is drawn, the zone filter as on the software map page, reading `data-zone` as a space-separated list (a station in several zones stays lit for each), the line chips and the symbols of the skills map's legend. The page script SHALL make each station a link to its item page. A list of the drawn lines with their stops as links SHALL follow the map, as its text alternative.

#### Scenario: Station link
- **WHEN** the reader clicks station `skill:writer`, or focuses it and presses Enter
- **THEN** the browser opens `writer`'s page

#### Scenario: Highlight a skill line
- **WHEN** the reader chooses line `publish` in the line chips, then chooses it again
- **THEN** every other line is dimmed, then restored

#### Scenario: Filter by a playbook zone
- **WHEN** `writer` is in the zones `release` and `review`, `editor` only in `release`, and the reader chooses the zone `review`
- **THEN** `editor` is dimmed and `writer` is not; choosing `release` leaves both lit

#### Scenario: No zone filter without zones
- **WHEN** the skills layout declares no zone
- **THEN** the page has no zone filter

#### Scenario: No skill lines
- **WHEN** no given folder has a skills map file
- **THEN** the page says `No skill lines yet` and names `stackledger-skills.yaml`

#### Scenario: Map without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the whole map is shown, at the size "Skills map shown size" gives
