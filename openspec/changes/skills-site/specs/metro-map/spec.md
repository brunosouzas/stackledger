## MODIFIED Requirements

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

### Requirement: Legend
A software map SHALL have a legend listing every drawn line in line order with its badge, colour and title (or name), followed by a fixed set of symbols per view: interchange, licence, licence to buy and suggested position in both views, and renewal within 30 days in `full` only.

#### Scenario: Legend in staff
- **WHEN** the map is drawn in the `staff` view
- **THEN** the legend has no renewal symbol

### Requirement: Safe SVG structure
The SVG SHALL be one XML document with `role="img"`, a `title`, one element per station with `data-ref` holding its station reference and one per line with `data-ref="line:<name>"`. Element names SHALL be limited to `svg`, `title`, `desc`, `g`, `path`, `line`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `text` and `tspan`. No attribute named `href`, `style`, `id` or starting with `on` SHALL appear; fonts are named, never embedded.

#### Scenario: Allowed names only
- **WHEN** any map is drawn
- **THEN** every element and attribute name in the SVG is on the allow-lists

#### Scenario: No embedded font
- **WHEN** any map is drawn in either theme
- **THEN** the SVG names its font stack in `font-family` and contains no `@font-face`, `url(` or font data

### Requirement: Safe SVG text
Every text taken from the catalogue or a skill set SHALL be XML-escaped (`&`, `<`, `>`, `"`, `'`), with characters not allowed in XML 1.0 replaced by U+FFFD. No such text SHALL appear in an attribute except `data-ref`, `data-line` and `data-zone`, and colours are written only after matching `#RRGGBB`.

#### Scenario: Hostile titles
- **WHEN** component, line and zone titles contain `<script>`, `&`, `"`, `'`, `]]>`, `javascript:`, U+0001 and U+FFFE
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the titles appear only as text

#### Scenario: Hostile skill names
- **WHEN** a skill on a skills map is named `a"><script>x</script>` and its line's title holds U+0001
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the name and title appear only as text

## ADDED Requirements

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
A skills map SHALL follow every other requirement of this spec except "Map input", "Legend", "Licence markers", "Renewal ring", the muting in "Stations and interchanges", the label source in "Label text" (its label is the item's name), and zone membership and `data-zone` (see "Skills map zones"): no licence marker or renewal ring, no view or date dependence, the SVG title `Skills map`, a legend of the lines, then only interchange and suggested position.

#### Scenario: Legend of a skills map
- **WHEN** a skills map with two lines is drawn with its title band and legend
- **THEN** its legend lists the two lines and exactly the symbols interchange and suggested position, and its `title` is `Skills map`

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
For the same catalogue, view, theme and map date, the software map SHALL be byte-identical to the one stackledger 0.2.0 draws, unless the catalogue holds a file named `stackledger-skills.yaml`, which is no longer a catalogue file.

#### Scenario: Example map
- **WHEN** the example catalogue is drawn with `stackledger map` in both views and both themes
- **THEN** each SVG equals the one recorded from 0.2.0

#### Scenario: Software lines in a skills map file name
- **WHEN** a catalogue keeps its software `Line` documents in a file named `stackledger-skills.yaml`
- **THEN** those lines are not drawn, and drawing them again needs only renaming the file
