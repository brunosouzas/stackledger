# metro-map Specification

## Purpose
Defines the metro map stackledger draws from one view of a catalogue: stations at stored grid positions, octilinear routes, parallel lines, labels, zones, legend, themes, licence markers, and a self-contained SVG safe to embed in a web page.

## Requirements

### Requirement: Map input
A software map SHALL be drawn from one view of the catalogue (`full` or `staff`), using only the documents that view serves. A station is a component that is a stop of at least one drawn line. Components on no line SHALL NOT be drawn. A line stop that matches no served component SHALL be skipped. A line with fewer than two served stops SHALL NOT be drawn nor listed in the legend.

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
A station served by one line SHALL be drawn as a circle in the theme's station colour, centred on its line and wider than the pipe. A station served by two or more lines SHALL be drawn as an interchange: a capsule (corner radius half its short side) in the station colour, larger than a stop circle, spanning every line through it. A component whose `spec.lifecycle` equals `deprecated`, ignoring case, has its station marker and label muted; its lines are not.

#### Scenario: Interchange
- **WHEN** `slack` is a stop of three lines
- **THEN** it is drawn as one interchange marker spanning the three lines

#### Scenario: Stations are circles
- **WHEN** `a` is a stop of one line and `slack` of two, in either theme
- **THEN** `a` is a white circle with an ink outline whose diameter exceeds the pipe's outer width, and `slack` is a capsule with a larger radius that contains all its contact points

#### Scenario: Diagonal interchange contains every contact
- **WHEN** eight lines share the diagonal edge from `a` at `[0, 0]` to `b` at `[4, 4]`
- **THEN** every contact of the lines at `a` lies inside the drawn interchange capsule, in both themes

### Requirement: Terminals
Each end of a drawn line SHALL carry a badge in the line's colour with its `code`, or the first character of `metadata.name` upper-cased when it has no code. Badges are pills (corner radius half their height), always wider than tall. Badges may repeat between lines.

#### Scenario: Line without code
- **WHEN** line `ship` has no `code`
- **THEN** its terminals carry the badge `S`

#### Scenario: One-character badge
- **WHEN** line `ship` has the badge `S`
- **THEN** its badges are pills wider than their height

### Requirement: Label text
Every station SHALL have one label with the component's `metadata.title`, or its name when there is no title, in as many rows as it needs, each at most 18 Unicode code points, wrapped at spaces, each row taking as many words as fit; a word longer than a row breaks as "Label word breaks" says. No label SHALL be cut or end with an added `…`. The station element SHALL have a `title` child with the full text.

#### Scenario: Long title
- **WHEN** a title is `Northwind Customer Relationship Manager`
- **THEN** the label rows are `Northwind Customer`, `Relationship` and `Manager`, none ends with `…`, and the station's `title` holds the full title

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, station markers, licence markers, rule counts and terminal badges grown by their outline and shadow, zone titles, and each line segment as a rectangle as wide as its casing. When every candidate overlaps, the one with the least intersected area wins, ties to the earlier candidate.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station, its shadow, a terminal badge or a badge's shadow

#### Scenario: Larger ink pushes a label out
- **WHEN** a label would fit next to a station marker without its ink but would touch the marker's shadow
- **THEN** the label is placed at a candidate clear of the marker grown by its outline and shadow

#### Scenario: Rule count pushes a label out
- **WHEN** a skills station's label would fit at its first candidate, to the right, only if the station had no rule count
- **THEN** the label is placed at a later candidate that does not cover the rule count grown by its outline and shadow

### Requirement: Zones
Each zone declared in the served `MapLayout` with at least one drawn station SHALL be drawn, in declaration order, as the convex hull of its stations' points widened by 32 units with rounded corners, in the zone's colour, with the zone's title. A station joins a zone through its component's `stackledger/zone` label. The area may cover stations outside the zone.

#### Scenario: Zone area
- **WHEN** zone `finance` has stations `xero` and `stripe`
- **THEN** the map has one area for `finance` containing both station points and the title of the zone

### Requirement: Legend
A software map SHALL have a legend listing every drawn line in line order with its badge, colour and title (or name), followed by a fixed set of symbols per view: interchange, licence, licence to buy and suggested position in both views, and renewal within 30 days in `full` only.

#### Scenario: Legend in staff
- **WHEN** the map is drawn in the `staff` view
- **THEN** the legend has no renewal symbol

### Requirement: Themes
The map SHALL support a `light` and a `dark` theme. Line and zone colours come from the catalogue in both themes; background, text, station, outline and shadow colours come from the theme. The `light` background SHALL be the tinted panel `#EEF2FF` and the `dark` background the navy `#14215A`. Text SHALL use the font stack `Lato, Helvetica Neue, Helvetica, Arial, sans-serif`, and station labels are bold.

#### Scenario: Dark theme
- **WHEN** the map is drawn with the `dark` theme
- **THEN** the background is `#14215A` and line colours are the catalogue's colours

#### Scenario: Light theme
- **WHEN** the map is drawn with the `light` theme
- **THEN** the background is `#EEF2FF`, the `font-family` starts with `Lato` and ends with `sans-serif`, and every station label has a `font-weight` of at least 700

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
The SVG SHALL be one XML document with `role="img"`, a `title`, one element per station with `data-ref` holding its station reference and one per line with `data-ref="line:<name>"`. Element names SHALL be limited to `svg`, `title`, `desc`, `g`, `path`, `line`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `text` and `tspan`. No attribute named `href`, `style`, `id` or starting with `on` SHALL appear; fonts are named, never embedded.

#### Scenario: Allowed names only
- **WHEN** any map is drawn
- **THEN** every element and attribute name in the SVG is on the allow-lists

#### Scenario: No embedded font
- **WHEN** any map is drawn in either theme
- **THEN** the SVG names its font stack in `font-family` and contains no `@font-face`, `url(` or font data

### Requirement: Allowed attributes
Attribute names SHALL be limited to `xmlns`, `role`, `viewBox`, `width`, `height`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `d`, `points`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, `opacity`, `fill-opacity`, `stroke-opacity`, `font-family`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline`, `data-ref`, `data-line` and `data-zone`.

#### Scenario: Unknown attribute
- **WHEN** the hostile fixture is drawn
- **THEN** no attribute outside this list appears, `xml:base` included

### Requirement: Allowed attribute values
`xmlns` SHALL be `http://www.w3.org/2000/svg` and `role` SHALL be `img`. Paint values SHALL be theme constants, validated `#RRGGBB` colours or `none`; no URL-valued paint is emitted. Numeric values SHALL be finite. The document SHALL contain no DOCTYPE, entity declaration or processing instruction.

#### Scenario: Paint values
- **WHEN** any map is drawn
- **THEN** every `fill` and `stroke` is `none`, a theme constant or a `#RRGGBB` colour, and no value contains `url(`

### Requirement: Safe SVG text
Every text taken from the catalogue or a skill set SHALL be XML-escaped (`&`, `<`, `>`, `"`, `'`), with characters not allowed in XML 1.0 replaced by U+FFFD. No such text SHALL appear in an attribute except `data-ref`, `data-line` and `data-zone`, and colours are written only after matching `#RRGGBB`.

#### Scenario: Hostile titles
- **WHEN** component, line and zone titles contain `<script>`, `&`, `"`, `'`, `]]>`, `javascript:`, U+0001 and U+FFFE
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the titles appear only as text

#### Scenario: Hostile skill names
- **WHEN** a skill on a skills map is named `a"><script>x</script>` and its line's title holds U+0001
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the name and title appear only as text

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

### Requirement: Data attributes
Every line stroke, station, terminal badge and legend entry SHALL carry `data-line` with the space-separated `line:<name>` references of the lines it belongs to, in line order. Every station whose component is in a drawn zone SHALL carry `data-zone` with the zone's declared name, lower-cased and XML-escaped.

#### Scenario: Interchange in a zone
- **WHEN** `xero` is a stop of `invoice` and `expenses` and is in zone `finance`
- **THEN** its station has `data-line` listing `line:invoice` and `line:expenses` in line order and `data-zone="finance"`

### Requirement: Ink casing and outline
In both themes every drawn line SHALL be a pipe: at least 12 units wide in the catalogue colour, over an ink `#0A1033` casing at least 6 units wider, both with round caps and joins. Lines sharing an edge SHALL be spaced at least the line width plus half the casing apart, so their colours never overlap. Stations, terminal badges, licence markers, renewal rings and the legend panel SHALL have an ink outline.

#### Scenario: Pipe line
- **WHEN** line `ship` in `#FF0000` is drawn in either theme
- **THEN** its group holds a path stroked `#0A1033` at least 6 units wider than the line, followed by the same path stroked `#FF0000`, both with round joins

#### Scenario: Bundled pipes fit side by side
- **WHEN** lines `ship` and `design` both run from `a` to `b`
- **THEN** their strokes are at least the line width plus half the casing apart

### Requirement: Hard offset shadow
Stations, terminal badges, licence markers and the legend panel SHALL have a hard offset shadow: a copy of the shape in the theme's shadow colour, moved right and down by the theme's offset, drawn first in the same group, without `transform` or `filter`. Lines and renewal rings have no shadow.

#### Scenario: Shadow under an interchange
- **WHEN** `slack` is an interchange drawn in the `light` theme
- **THEN** its group holds, before the outlined marker, a shape filled `#0A1033` at the marker's position plus the theme's offset, and the SVG has no `transform` or `filter`

#### Scenario: Dark shadow and rim
- **WHEN** the map is drawn with the `dark` theme
- **THEN** shadows are filled `#4C5CB8`, outlined stickers carry a `#EEF1FF` rim, and no shadow is filled `#0A1033`

### Requirement: Station references
A station reference SHALL be `component:<name>` on a software map, with the component's `metadata.name`, and `skill:<file>`, `playbook:<file>` or `agent:<file>` on a skills map, `<file>` being the item's page file name as `stackledger skills map` gives it, without `.md`, so the reference is ASCII and names one item of its kind. A skills station's `title` SHALL hold the item's name.

#### Scenario: Software station
- **WHEN** component `editor` is a station of a software map
- **THEN** its element has `data-ref="component:editor"`

#### Scenario: Skills stations
- **WHEN** a skill line stops at the playbook `publishing`, the skill `writer` and the agent `reviewer`
- **THEN** the skills map has stations with `data-ref` `playbook:publishing`, `skill:writer` and `agent:reviewer`

#### Scenario: Names that XML cannot hold
- **WHEN** two skills on one line are named `a` U+0001 `b` and `a` U+FFFD `b`
- **THEN** their stations have different `data-ref` values, both of the form `skill:_` and hexadecimal digits

### Requirement: Skills map input
A skills map SHALL be drawn from a skill set's lines and layout, as `skill-source` reads them. A station is a skill, playbook or agent of the set that is a stop of at least one drawn line, labelled with its name. A stop naming no item of the set SHALL be skipped; a line left with fewer than two stops SHALL NOT be drawn nor listed. A layout key naming no item of the set still reserves its cell.

#### Scenario: Stop not in the set
- **WHEN** skill line `publish` stops at `skill:writer`, `skill:broken` and `skill:editor`, and `broken`'s `SKILL.md` has no frontmatter, so `broken` is not in the set
- **THEN** the map draws `publish` from `writer` to `editor` with no station `skill:broken`

#### Scenario: Relation error keeps the station
- **WHEN** skill line `publish` stops at `skill:writer` and `skill:editor`, and `editor` is valid but lists the missing skill `ghost`
- **THEN** the map draws `publish` with the station `skill:editor`

#### Scenario: No skill lines
- **WHEN** the skill set has no drawn line
- **THEN** the skills map is a valid SVG showing the text `No skill lines yet`

### Requirement: Skills map drawing
A skills map SHALL follow every other requirement of this spec except "Map input", "Legend", "Licence markers", "Renewal ring", the muting in "Stations and interchanges", the label source in "Label text" (its label is the item's name), and zone membership and `data-zone` (see "Skills map zones"): no licence marker or renewal ring, no view or date dependence, the SVG title `Skills map`, a legend of the lines, then only interchange, number of rules and suggested position.

#### Scenario: Legend of a skills map
- **WHEN** a skills map with two lines is drawn with its title band and legend
- **THEN** its legend lists the two lines and exactly the symbols interchange, number of rules and suggested position, in that order, and its `title` is `Skills map`

#### Scenario: Same skills map everywhere
- **WHEN** one skill set is drawn for the `full` and the `staff` site, with two different dates, and again read through a folder listing in reversed order
- **THEN** the SVGs of each theme are byte-identical

#### Scenario: Suggested skill station
- **WHEN** skill line `publish` stops at `a`, `b` and `c` and there is no `MapLayout`
- **THEN** `skill:a` is suggested at `[0, 0]`, `skill:b` at `[1, 0]` and `skill:c` at `[2, 0]`, each with the dashed suggestion disc

### Requirement: Skills map zones
On a skills map, a station SHALL join every zone whose members (skill-source, "Playbook zones") include its item, so zones may overlap; each zone is drawn as the "Zones" requirement says. A station in a drawn zone SHALL carry `data-zone` with the page file names of its zones' playbooks, separated by spaces, in declaration order.

#### Scenario: Overlapping zones
- **WHEN** the layout declares the zones `release` then `review`, and both have `writer` among their members, with other drawn members each
- **THEN** both zone areas contain `writer`'s point, and its station has `data-zone="release review"`

#### Scenario: Multi-word software zone
- **WHEN** a software map's component is in the zone `Team tools`
- **THEN** its station has `data-zone="team tools"`, as before this change

### Requirement: Playbook zone titles
On a skills map, a zone's title SHALL be placed next to its playbook's station, as a second label of that station: after the station labels, at the first of the label candidates that overlaps nothing, obstacles as in "Label placement" plus earlier labels and zone titles; when all overlap, the least overlap wins. A zone whose playbook is not drawn keeps the corner title, moved up by its height plus 4 units while it overlaps an earlier zone title.

#### Scenario: Title by its playbook
- **WHEN** the zone `review` has its playbook `review` drawn at `[0, 4]` and another member at `[2, 1]`
- **THEN** `review`'s title box is next to the `review` station, not at the zone's top-left corner

#### Scenario: Title clear of the lines
- **WHEN** a line runs below and to the right of the playbook `release`'s station
- **THEN** `release`'s zone title box overlaps no line segment, station marker or label

#### Scenario: Two zones with one corner
- **WHEN** the layout declares the zones `release` then `review`, neither playbook is a station of a drawn line, and the zones have the same top-left member
- **THEN** their title boxes do not overlap, and `review`'s is above `release`'s

### Requirement: Software map unchanged
For the same catalogue, view, theme and map date, the software map SHALL be byte-identical to the one stackledger 0.2.0 draws, unless the catalogue holds a file named `stackledger-skills.yaml`, which is no longer a catalogue file, or a station label that 0.2.0 cut: one that needs more than two rows or breaks inside a word.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG equals the one recorded from 0.2.0

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file

#### Scenario: A cut label now wraps
- **WHEN** the example catalogue is drawn with one component's title changed to `Northwind Customer Relationship Manager`
- **THEN** that station's label has the three rows of "Long title", no text of the SVG ends with `…`, and the other stations keep their rows

### Requirement: Label word breaks
A word longer than 18 code points SHALL start a new row and break, again and again, after its last `-`, `_`, `.` or `/` that keeps the row within 18 code points, or after 18 code points when there is none. Its last piece SHALL continue the row as a word, so the next words may join it.

#### Scenario: Long hyphenated name
- **WHEN** a label text is `openspec-archive-change`
- **THEN** its rows are `openspec-archive-` and `change`

#### Scenario: Long word after other words
- **WHEN** a label text is `Run openspec-archive-change now`
- **THEN** its rows are `Run`, `openspec-archive-` and `change now`

#### Scenario: Long word with no break character
- **WHEN** a title is 30 times the letter `a`, or 40 times the emoji `😀`, with no space
- **THEN** its rows are 18 and 12 code points long (18, 18 and 4 for the emoji), and joined they give the title

### Requirement: Rule count is an obstacle
A rule count SHALL be one of the station markers for placement: labels, terminal badges and zone titles avoid it grown by its outline and shadow, and the map frame contains it.

#### Scenario: Terminal badge clear of a rule count
- **WHEN** a skill line ends at a station with a rule count and its terminal badge's first position would cover the count
- **THEN** the badge is placed where it does not cover the rule count grown by its outline and shadow

#### Scenario: Rule count inside the frame
- **WHEN** a station with a rule count is the top-right station of a skills map
- **THEN** the rule count's box, grown by its ink, lies inside the map frame

### Requirement: Rule count on skills stations
On a skills map, the station of a skill or playbook with at least one rule in the skill set (skill-source "Rules files", "Rule IDs"; the number the `/skills/` list shows) SHALL carry a rule count at the upper right of its marker: that number, or `99+` above 99, in a circle for one digit or a pill for more, in the panel colour, outlined and shadowed as a licence marker. Agents and software maps have none.

#### Scenario: Skill with rules
- **WHEN** skill `writer` defines 3 rules and agent `reviewer` and skill `editor` (no `rules.md`) are stations of the same skills map
- **THEN** station `skill:writer` holds a rule count showing `3`, and `agent:reviewer` and `skill:editor` hold none

#### Scenario: Duplicate rule ID
- **WHEN** skill `writer`'s `rules.md` defines `WR-1` twice and nothing else
- **THEN** the set holds one rule for `writer` and its station's rule count shows `1`

#### Scenario: Many rules
- **WHEN** a playbook defines 100 rules
- **THEN** its station's rule count shows `99+`

#### Scenario: Software map has no rule count
- **WHEN** a software map of the fictitious example catalogue is drawn
- **THEN** no station holds a rule count
