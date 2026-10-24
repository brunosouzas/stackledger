## ADDED Requirements

### Requirement: Map backdrop
`stackledger build` SHALL draw the software map of each view with the catalogue's backdrop ("Map settings"). When it is a city, the map page SHALL show, right under the map frame, the line `Map data © OpenStreetMap contributors`, with `OpenStreetMap contributors` an anchor to `https://www.openstreetmap.org/copyright` carrying `rel="noopener noreferrer"` and no `target`. With `neutral` there is no such line.

#### Scenario: London map on the page
- **WHEN** the site is built from a catalogue with `spec.map.backdrop: london`
- **THEN** the map page of each view embeds the light and the dark map, each with the `london` backdrop group and the SVG credit

#### Scenario: London credit on the page
- **WHEN** the site is built from a catalogue with `spec.map.backdrop: london`
- **THEN** the map page of each view shows the credit line under the map frame, with its anchor to the OpenStreetMap copyright page

#### Scenario: Credit readable on a phone
- **GIVEN** a 390-pixel-wide window and a site built with `spec.map.backdrop: london`
- **WHEN** the reader opens the map page
- **THEN** the credit line is visible with a computed font size of at least 12 pixels

#### Scenario: No credit without a city
- **WHEN** the site is built from the example catalogue, which has no `spec.map`
- **THEN** no page contains `OpenStreetMap`
