## ADDED Requirements

### Requirement: Map shown size
The map page SHALL show the map at its initial viewBox width in CSS pixels (one unit per pixel), or narrower when the frame's room is smaller, keeping its proportions. The room is the page's content column minus the frame's borders. The frame's content box SHALL be as wide as the shown map, and the frame centred in the column. Zoom and pan SHALL NOT change the map's size on the page. No inline style or script SHALL be needed for this.

#### Scenario: Map narrower than the page
- **GIVEN** a 1360-pixel-wide window and a software map whose viewBox is narrower than the room (the small test catalogue under `/extra/`)
- **WHEN** the reader opens its map page
- **THEN** the map is as wide as its viewBox, the frame's content box is as wide as the map, and the frame's left and right distances to the content column's edges are equal (each within 1 pixel)

#### Scenario: Map wider than the page
- **GIVEN** a 390-pixel-wide window and the example software map
- **WHEN** the reader opens the map page
- **THEN** the map is as wide as the frame's content box, its height keeps the viewBox proportions (within 1 pixel), and the page has no horizontal scroll

#### Scenario: Zoom keeps the shown size
- **WHEN** the reader presses zoom in twice, then drags the map
- **THEN** the map's width and height on the page are the same as before (within 1 pixel)

#### Scenario: Shown size without JavaScript
- **GIVEN** JavaScript is disabled, a 1360-pixel-wide window and the small test catalogue's software map
- **WHEN** the reader opens its map page
- **THEN** the whole map is shown, as wide as its viewBox (within 1 pixel)

## MODIFIED Requirements

### Requirement: Map page
The map page SHALL show the map of its view, in the light or dark theme following the page theme, with zoom in, zoom out and reset buttons, each with its icon ("Interface icons"), and drag to pan. Without JavaScript the whole map is still shown, at the size "Map shown size" gives.

#### Scenario: Zoom
- **WHEN** the reader presses zoom in twice and then reset
- **THEN** the map scales up twice and returns to its initial size
