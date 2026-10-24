## ADDED Requirements

### Requirement: Skills map shown size
`/skill-map/` SHALL size the skills map and its frame as the software map page does (catalogue-site, "Map shown size"): at most one viewBox unit per CSS pixel, smaller only when the page's content column is narrower, the frame as wide as the map and centred, and the same size while zooming. A skills map SHALL therefore never show more pixels per unit than a software map that fills the column.

#### Scenario: Skills map not enlarged
- **GIVEN** a 1360-pixel-wide window and the example skills map, whose viewBox is narrower than the content column
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the map is as wide as its viewBox (within 1 pixel), and the frame's left and right distances to the content column's edges differ by at most 1 pixel

#### Scenario: Same ink as the software map
- **GIVEN** a 1360-pixel-wide window
- **WHEN** the reader opens `/full/map/` and `/full/skill-map/`
- **THEN** neither map shows more than 1 pixel per viewBox unit (within 0.01), and their pixels per unit differ by less than 5%

#### Scenario: Skills map on a phone
- **GIVEN** a 390-pixel-wide window
- **WHEN** the reader opens `/full/skill-map/`
- **THEN** the map is as wide as its frame's content box and the page has no horizontal scroll
