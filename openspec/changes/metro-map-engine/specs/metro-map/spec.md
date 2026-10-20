## ADDED Requirements

### Requirement: Map input
The map SHALL be drawn from one view of the catalogue (`full` or `staff`), using only the documents that view serves. A station is a component that is a stop of at least one served line. Components on no line SHALL NOT be drawn. A line stop that matches no served component SHALL be skipped, and the line drawn through its other stops.

#### Scenario: Component on no line
- **WHEN** component `scanner` is a stop of no line
- **THEN** the map has no station `component:scanner`

#### Scenario: Stop with errors
- **WHEN** line `ship` stops at `editor`, `forge` and `deploy`, and `forge` has a field error
- **THEN** the map draws `ship` from `editor` to `deploy` with no station `forge`

#### Scenario: No lines
- **WHEN** the catalogue has no served line
- **THEN** the map is a valid SVG that says there are no journeys yet

### Requirement: Stored positions
A station with a position in the `MapLayout` SHALL be drawn at that grid cell, column to the right and row downwards, whatever else the catalogue contains. Adding, removing or changing a line or another station SHALL NOT move it.

#### Scenario: New line does not move stations
- **WHEN** a line is added between two placed stations
- **THEN** every placed station has the same coordinates as before

### Requirement: Suggested positions
A station with no stored position SHALL get a suggested cell: the free cell nearest to the mean position of its placed neighbours on its lines (stops right before or after it), ties broken by smaller row and then smaller column; with no placed neighbour, the first free cell to the right of all placed stations in row 0. Suggestions are assigned one by one in reference order, each taking its cell before the next. A suggested station SHALL be drawn with a dashed outline.

#### Scenario: Between two neighbours
- **WHEN** `forge` is unplaced, its neighbours on `ship` are at `[2, 2]` and `[4, 2]`, and `[3, 2]` is free
- **THEN** `forge` is suggested at `[3, 2]`

#### Scenario: Nothing placed
- **WHEN** the catalogue has a line of three stops and no `MapLayout`
- **THEN** every stop gets a distinct suggested cell and the map is drawn

### Requirement: Octilinear routing
Each hop between two consecutive stations of a line SHALL be drawn along horizontal, vertical and 45-degree segments between grid points, and SHALL NOT pass through the cell of a station the line does not stop at. Among valid routes the engine prefers fewer bends and shorter paths. When no valid route exists inside the grid around the stations plus a margin of two cells, the hop SHALL be drawn as a straight segment and reported as unrouted.

#### Scenario: Station in the way
- **WHEN** line `ship` goes from `[0, 0]` to `[4, 0]` and component `vault`, not on `ship`, is at `[2, 0]`
- **THEN** the path of that hop does not pass through `[2, 0]`

#### Scenario: Angles
- **WHEN** a map is laid out
- **THEN** every segment of every routed hop is horizontal, vertical or at 45 degrees

### Requirement: Shared hops
When several lines connect the same two stations consecutively, they SHALL share one route and be drawn side by side, in the order of their `code` and then their name, on both sides of the hop.

#### Scenario: Two lines on one hop
- **WHEN** lines `ship` and `secrets` both go from `actions` to `deploy`
- **THEN** both use the same route, drawn as two parallel strokes

### Requirement: Stations and interchanges
A station served by one line SHALL be drawn as a tick on that line; a station served by two or more lines SHALL be drawn as an interchange (a white or dark disc with a ring). A component whose `spec.lifecycle` is `deprecated` SHALL be drawn in a muted colour.

#### Scenario: Interchange
- **WHEN** `slack` is a stop of three lines
- **THEN** it is drawn as an interchange

### Requirement: Terminals
Each end of a line SHALL carry a badge with the line's `code`, or the first letter of its name when it has no code, in the line's colour.

#### Scenario: Line without code
- **WHEN** line `ship` has no `code`
- **THEN** its terminals carry the badge `S`

### Requirement: Labels
Every station SHALL have one label with the component's `metadata.title`, or its name when there is no title, wrapped to at most two lines of 18 characters. The label SHALL be placed at the first of eight candidate positions around the station, in a fixed order, that overlaps no other label, station or line segment; when every candidate overlaps, at the one with the least overlap.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station

### Requirement: Zones
Each zone declared in the `MapLayout` with at least one drawn station SHALL be drawn as a shaded area around its stations, in the zone's colour, with the zone's title. A station joins a zone through its component's `stackledger/zone` label.

#### Scenario: Zone area
- **WHEN** zone `finance` has stations `xero` and `stripe`
- **THEN** the map has one area for `finance` containing both stations and the title of the zone

### Requirement: Legend
The map SHALL have a legend listing every drawn line with its badge, colour and title (or name), in the order of shared hops, and the symbols the map uses.

#### Scenario: Legend entries
- **WHEN** the map draws three lines
- **THEN** the legend lists those three lines

### Requirement: Themes
The map SHALL support a `light` and a `dark` theme. Line and zone colours come from the catalogue in both themes; background, text and station colours come from the theme.

#### Scenario: Dark theme
- **WHEN** the map is drawn with the `dark` theme
- **THEN** the background is dark and line colours are the catalogue's colours

### Requirement: Licence and renewal markers
A station SHALL carry a licence marker when its component lists, in `spec.dependsOn`, a served licence whose `status` is `active`, and a dashed licence marker when that status is `to-buy`. In the `full` view a station SHALL carry a renewal ring when such a licence has `renewsOn` from the map date to 30 days after it. Markers SHALL be derived only from fields present in the view, so in the `staff` view with default hidden fields there is no renewal ring.

#### Scenario: Renewal soon in full
- **WHEN** the view is `full`, the map date is `2027-06-01` and `editor` lists an active licence renewing on `2027-06-20`
- **THEN** station `editor` has a renewal ring

#### Scenario: No renewal ring in staff
- **WHEN** the same catalogue is drawn in the `staff` view with default hidden fields
- **THEN** no station has a renewal ring and the SVG is identical to the one for any other renewal dates

### Requirement: Self-contained and safe SVG
The SVG SHALL be one XML document with a `title`, `role="img"`, and an element per station carrying `data-ref` with the component reference. It SHALL contain no `script` element, no event-handler attribute, no `foreignObject`, no link, and no reference to an external resource; fonts come from a system font stack. Every text taken from the catalogue SHALL be XML-escaped.

#### Scenario: Title with markup
- **WHEN** a component's title is `<script>alert(1)</script> & co`
- **THEN** the SVG parses as XML, has no `script` element, and shows the title as text

#### Scenario: No external references
- **WHEN** any map is drawn
- **THEN** the SVG contains no `href`, `xlink:href`, `url(http`, `@import` or `<script`

### Requirement: Deterministic output
The same view, theme and map date SHALL produce byte-identical SVG, whatever the order of files and documents in the catalogue folder.

#### Scenario: Files renamed
- **WHEN** the same documents are split across files with other names
- **THEN** the SVG is byte-identical

### Requirement: Size and speed
The engine SHALL lay out and draw 200 stations and 20 lines within 5 seconds.

#### Scenario: Large catalogue
- **WHEN** a generated catalogue of 200 placed stations and 20 lines of 12 stops each is drawn
- **THEN** the SVG is produced within 5 seconds
