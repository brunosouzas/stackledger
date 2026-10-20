# metro-map Specification

## Purpose
Defines the metro map stackledger draws from one view of a catalogue: stations at stored grid positions, octilinear routes, parallel lines, labels, zones, legend, themes, licence markers, and a self-contained SVG safe to embed in a web page.

## Requirements

### Requirement: Map input
The map SHALL be drawn from one view of the catalogue (`full` or `staff`), using only the documents that view serves. A station is a component that is a stop of at least one drawn line. Components on no line SHALL NOT be drawn. A line stop that matches no served component SHALL be skipped. A line with fewer than two served stops SHALL NOT be drawn nor listed in the legend.

#### Scenario: Component on no line
- **WHEN** component `scanner` is a stop of no line
- **THEN** the map has no station `component:scanner`

#### Scenario: Stop with errors
- **WHEN** line `ship` stops at `editor`, `forge` and `deploy`, and `forge` has a field error
- **THEN** the map draws `ship` from `editor` to `deploy` with no station `forge`

#### Scenario: Line left with one stop
- **WHEN** line `ship` has two stops and one of them has a field error
- **THEN** `ship` is neither drawn nor listed in the legend

#### Scenario: No lines
- **WHEN** the catalogue has no drawn line
- **THEN** the map is a valid SVG showing the text `No journeys yet`

### Requirement: Map units
Geometry SHALL be in map units: grid point `[c, r]` of the `MapLayout` (column to the right, row downwards) is at `(64c, 64r)`. The SVG `viewBox` MAY move with the extent of the map, but the coordinates of a station in the geometry depend only on its grid point. Numbers in the SVG are written with at most two decimals.

#### Scenario: Station coordinates
- **WHEN** a station is stored at `[3, 2]`
- **THEN** its point in the geometry is `(192, 128)`

### Requirement: Stored positions
A station with a usable stored position SHALL be drawn at that grid point. Adding, removing or changing a line or another station SHALL NOT move it. Only station positions are stable: the route of a hop MAY change when any line or station changes.

#### Scenario: New line does not move stations
- **WHEN** a line is added between two placed stations
- **THEN** every placed station has the same point as before

### Requirement: Layout with problems
When two keys of the served `MapLayout` match the same component, the first in the file SHALL be used. When two stations share a cell, the one whose key comes first in the file SHALL keep it and the others SHALL be treated as unplaced. A `MapLayout` that is not served (it has a field error) SHALL provide no positions.

#### Scenario: Two stations in one cell
- **WHEN** `component:a` and then `component:b` are both stored at `[3, 2]`
- **THEN** `a` is drawn at `[3, 2]` and `b` gets a suggested position

#### Scenario: Layout with a fractional position
- **WHEN** the `MapLayout` has a position `[2.5, 1]`
- **THEN** no stored position is used and every station gets a suggested position

### Requirement: Free cells
A cell SHALL count as free only when no key of the served `MapLayout`'s `spec.stations` holds it, whether that station is drawn or not, no earlier suggestion took it, and its column and row are zero or more.

#### Scenario: Cell of an undrawn station
- **WHEN** `component:old` is stored at `[3, 2]` but is a stop of no line
- **THEN** no station is suggested at `[3, 2]`

### Requirement: Suggested positions
Stations without a usable stored position SHALL get suggestions one by one in reference order. The target is the mean of the points of their placed or already-suggested neighbours (stops right before or after them on any line), each counted once. The suggestion is the free cell nearest the target by octile distance (`max(dx, dy) + (√2 − 1) · min(dx, dy)`), ties by smaller row then smaller column.

#### Scenario: Between two neighbours
- **WHEN** `forge` is unplaced, its neighbours on `ship` are at `[2, 2]` and `[4, 2]`, and `[3, 2]` is free
- **THEN** `forge` is suggested at `[3, 2]`

### Requirement: Suggestion without neighbours
A station with no placed or already-suggested neighbour SHALL be suggested at the free cell in row 0 with the smallest column greater than every stored and suggested column, or column 0 when there is none. A suggested station SHALL keep its normal tick or interchange marker and additionally carry a hollow disc with a dashed outline in the theme's muted colour, centred on its grid point.

#### Scenario: Nothing placed
- **WHEN** line `ship` stops at `a`, `b` and `c` and there is no `MapLayout`
- **THEN** `a` is suggested at `[0, 0]`, `b` at `[1, 0]` and `c` at `[2, 0]`

#### Scenario: Suggested interchange
- **WHEN** unplaced `slack` is a stop of two lines
- **THEN** it has the interchange marker spanning both lines and the dashed suggestion disc

### Requirement: Octilinear routing
Each hop SHALL first get a centreline of horizontal, vertical and 45-degree segments between grid points. The centreline SHALL NOT pass through the point of any station other than its two ends, and SHALL NOT turn by more than 90 degrees at a grid point. It stays inside the bounding box of the hop's two ends widened by three cells. Rendered parallel strokes MAY lie off-grid.

#### Scenario: Station in the way
- **WHEN** line `ship` goes from `[0, 0]` to `[4, 0]` and component `vault` is at `[2, 0]`
- **THEN** the path of that hop does not pass through `[2, 0]`

#### Scenario: Straight when nothing is in the way
- **WHEN** two consecutive stops are at `[0, 0]` and `[3, 0]`, no station lies between them and no other hop uses those edges
- **THEN** the hop is one horizontal segment

#### Scenario: Angles
- **WHEN** a map is laid out
- **THEN** every segment of every rendered stroke, offset connectors included, is horizontal, vertical or at 45 degrees, except reported straight fallbacks

### Requirement: Routing budget
A hop search SHALL expand at most 50,000 direction states. When no valid route is found within the routing box or the budget, the hop SHALL be drawn as a straight segment and reported as unrouted.

#### Scenario: Far-away typo
- **WHEN** consecutive stops are at `[0, 0]` and `[100000, 100000]`
- **THEN** the map is drawn within the time limit and that hop is reported as unrouted

### Requirement: Line order
Line order SHALL be: lines with a `code` first, by `code` upper-cased and compared by Unicode code point, then lines without a code; ties by name. Hops are routed and legends listed in line order.

#### Scenario: Codes before names
- **WHEN** lines `ship` (code `2`), `alpha` (no code) and `secrets` (code `10`) exist
- **THEN** the line order is `secrets`, `ship`, `alpha`

### Requirement: Parallel lines
Two lines SHALL NOT be drawn along the same grid edge at the same offset: every line using a grid edge is drawn side by side on it, whichever hops they belong to. Lines connecting the same two stations consecutively share one route. Walking an edge from its end whose coordinates sort first, lines are placed left to right in line order, whatever direction they travel. Offset transitions SHALL use horizontal, vertical or 45-degree connectors.

#### Scenario: Two lines on one hop
- **WHEN** lines `ship` and `secrets` both go from `actions` to `deploy`
- **THEN** both use the same route, drawn as two parallel strokes

#### Scenario: Different hops on one edge
- **WHEN** hop A–B of `ship` and hop C–D of `secrets` both use the edge `[3, 2]`–`[4, 2]`
- **THEN** the two strokes on that edge are parallel and do not coincide

### Requirement: Bundles through bends
When every line on a grid edge continues together onto the next edge, the bundle SHALL keep its order through the bend instead of re-sorting by the next edge, and the two offset segments of each line SHALL meet at a mitred corner.

#### Scenario: Bundle keeps its sides through a bend
- **WHEN** lines `ship` and `secrets` run together along a horizontal edge and both turn onto the same diagonal edge
- **THEN** the corner is mitred and neither line crosses the other

### Requirement: Stations and interchanges
A station served by one line SHALL be drawn as a tick on that line. A station served by two or more lines SHALL be drawn as an interchange: a marker in the theme's station colour with an outline, spanning every line through it. A component whose `spec.lifecycle` equals `deprecated`, ignoring case, has its station marker and label muted; its lines are not.

#### Scenario: Interchange
- **WHEN** `slack` is a stop of three lines
- **THEN** it is drawn as one interchange marker spanning the three lines

### Requirement: Terminals
Each end of a drawn line SHALL carry a badge in the line's colour with its `code`, or the first character of `metadata.name` upper-cased when it has no code. Badges may repeat between lines.

#### Scenario: Line without code
- **WHEN** line `ship` has no `code`
- **THEN** its terminals carry the badge `S`

### Requirement: Label text
Every station SHALL have one label with the component's `metadata.title`, or its name when there is no title, in at most two rows of at most 18 Unicode code points, wrapped at spaces; a longer word is cut, and every cut ends with `…`. The station element SHALL have a `title` child with the full text.

#### Scenario: Long title
- **WHEN** a title is `Northwind Customer Relationship Manager`
- **THEN** the label has two rows, the second ending with `…`, and the station's `title` holds the full title

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, station markers, terminal badges, zone titles, and each line segment as a rectangle as wide as its stroke. When every candidate overlaps, the one with the least intersected area wins, ties to the earlier candidate.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station or a terminal badge

### Requirement: Zones
Each zone declared in the served `MapLayout` with at least one drawn station SHALL be drawn, in declaration order, as the convex hull of its stations' points widened by 32 units with rounded corners, in the zone's colour, with the zone's title. A station joins a zone through its component's `stackledger/zone` label. The area may cover stations outside the zone.

#### Scenario: Zone area
- **WHEN** zone `finance` has stations `xero` and `stripe`
- **THEN** the map has one area for `finance` containing both station points and the title of the zone

### Requirement: Legend
The map SHALL have a legend listing every drawn line in line order with its badge, colour and title (or name), followed by a fixed set of symbols per view: interchange, licence, licence to buy and suggested position in both views, and renewal within 30 days in `full` only.

#### Scenario: Legend in staff
- **WHEN** the map is drawn in the `staff` view
- **THEN** the legend has no renewal symbol

### Requirement: Themes
The map SHALL support a `light` and a `dark` theme. Line and zone colours come from the catalogue in both themes; background, text and station colours come from the theme.

#### Scenario: Dark theme
- **WHEN** the map is drawn with the `dark` theme
- **THEN** the background is dark and line colours are the catalogue's colours

### Requirement: Licence markers
A station SHALL carry a solid licence marker when its component lists, in `spec.dependsOn`, a served licence whose `status` is `active` or `to-confirm`; otherwise a hollow licence marker when such a licence has `status` `to-buy`. The marker is one fixed glyph, independent of cost, currency and cycle, and needs `status` to be visible in the view.

#### Scenario: Active and to-buy
- **WHEN** `editor` lists one `active` and one `to-buy` licence
- **THEN** station `editor` has the solid licence marker

### Requirement: Renewal ring
In the `full` view only, a station SHALL carry a renewal ring when a licence that gives it a solid marker has `renewsOn` from the map date to the map date plus 30 days, both included. Overdue renewals get no ring. The `staff` map SHALL NOT depend on the map date nor on any hidden field.

#### Scenario: Renewal soon in full
- **WHEN** the view is `full`, the map date is `2027-06-01` and `editor` lists an active licence renewing on `2027-07-01`
- **THEN** station `editor` has a renewal ring

#### Scenario: Staff ignores hidden fields and the date
- **WHEN** two catalogues are identical except that a drawn component's active licence renews on `2027-06-15` in the first and `2027-08-01` in the second, and their `staff` maps are drawn with dates `2027-06-01` and `2027-09-01`
- **THEN** the two `staff` SVGs are byte-identical, and the two `full` maps drawn with date `2027-06-01` differ, with a renewal ring only in the first

### Requirement: Safe SVG structure
The SVG SHALL be one XML document with `role="img"`, a `title`, one element per station with `data-ref="component:<name>"` and one per line with `data-ref="line:<name>"`, names as in `metadata.name`. Element names SHALL be limited to `svg`, `title`, `desc`, `g`, `path`, `line`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `text` and `tspan`. No attribute named `href`, `style`, `id` or starting with `on` SHALL appear; fonts come from a system font stack.

#### Scenario: Allowed names only
- **WHEN** any map is drawn
- **THEN** every element and attribute name in the SVG is on the allow-lists

### Requirement: Allowed attributes
Attribute names SHALL be limited to `xmlns`, `role`, `viewBox`, `width`, `height`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `d`, `points`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, `opacity`, `fill-opacity`, `stroke-opacity`, `font-family`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline` and `data-ref`.

#### Scenario: Unknown attribute
- **WHEN** the hostile fixture is drawn
- **THEN** no attribute outside this list appears, `xml:base` included

### Requirement: Allowed attribute values
`xmlns` SHALL be `http://www.w3.org/2000/svg` and `role` SHALL be `img`. Paint values SHALL be theme constants, validated `#RRGGBB` colours or `none`; no URL-valued paint is emitted. Numeric values SHALL be finite. The document SHALL contain no DOCTYPE, entity declaration or processing instruction.

#### Scenario: Paint values
- **WHEN** any map is drawn
- **THEN** every `fill` and `stroke` is `none`, a theme constant or a `#RRGGBB` colour, and no value contains `url(`

### Requirement: Safe SVG text
Every text taken from the catalogue SHALL be XML-escaped (`&`, `<`, `>`, `"`, `'`), with characters not allowed in XML 1.0 replaced by U+FFFD. No catalogue text SHALL appear in an attribute except `data-ref`, and colours are written only after matching `#RRGGBB`.

#### Scenario: Hostile titles
- **WHEN** component, line and zone titles contain `<script>`, `&`, `"`, `'`, `]]>`, `javascript:`, U+0001 and U+FFFE
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the titles appear only as text

### Requirement: Deterministic output
The same view, theme and map date SHALL produce byte-identical SVG whatever the order of files and documents in the folder, as long as the same documents are served.

#### Scenario: Files renamed
- **WHEN** the same documents, with no duplicates, are split across files with other names
- **THEN** the SVG is byte-identical

### Requirement: Size and speed
The engine SHALL lay out and draw 200 stations and 20 lines within 5 seconds.

#### Scenario: Large catalogue
- **WHEN** a seeded catalogue of 200 stations on a 50 by 24 grid at even coordinates and 20 lines of 12 stops each is drawn
- **THEN** the SVG is produced within 5 seconds
