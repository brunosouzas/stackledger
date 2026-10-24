## ADDED Requirements

### Requirement: Map shown size
The map page SHALL show the map at most at its drawn size, one viewBox unit per CSS pixel, keeping its proportions, and smaller only when the page's content column is narrower than the map. The map's frame SHALL be as wide as the shown map and centred in that column. Zoom and pan SHALL NOT change the map's size on the page. The page SHALL do this without inline styles or JavaScript.

#### Scenario: Map narrower than the page
- **GIVEN** a 1360-pixel-wide window and a software map whose viewBox is narrower than the page's content column (the small test catalogue under `/extra/`)
- **WHEN** the reader opens its map page
- **THEN** the map is as wide as its viewBox (within 1 pixel), and the frame's left and right distances to the content column's edges differ by at most 1 pixel

#### Scenario: Map wider than the page
- **GIVEN** a 390-pixel-wide window and the example software map
- **WHEN** the reader opens the map page
- **THEN** the map is as wide as its frame's content box, its height keeps the viewBox proportions (within 1 pixel), and the page has no horizontal scroll

#### Scenario: Zoom keeps the shown size
- **WHEN** the reader presses zoom in twice, then drags the map
- **THEN** the map's width and height on the page are the same as before (within 1 pixel)

#### Scenario: Shown size without JavaScript
- **GIVEN** JavaScript is disabled, a 1360-pixel-wide window and the small test catalogue's software map
- **WHEN** the reader opens its map page
- **THEN** the map is as wide as its viewBox (within 1 pixel)
