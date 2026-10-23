## MODIFIED Requirements

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

## ADDED Requirements

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
