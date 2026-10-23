## ADDED Requirements

### Requirement: Relation box text room
On a relation diagram, skills SHALL be `nodeBlock` boxes with radius 6, playbooks `pillNode` pills and agents `hexNode` hexagons. Each box SHALL be wide enough that its shown name, measured as the layout measures bold text, ends at least the piece's text inset before its right edge (12 for a box, half the height for a pill or a hexagon). A shown name empty after cleaning SHALL be replaced by the item's station reference.

#### Scenario: Long playbook name fits
- **WHEN** a playbook whose name has 64 code points is on a diagram
- **THEN** its name's estimated width ends at least half the box height before the box's right edge

#### Scenario: Name with only control characters
- **WHEN** a skill's name is made only of control characters and it is loaded by `release`
- **THEN** `release`'s diagram is drawn and that box shows the skill's station reference

## MODIFIED Requirements

### Requirement: Relation diagram
Each item page SHALL hold a safe SVG drawn by stackledger in the style of the neighbourhood diagram: the item in the centre, what brings it in on the left, what it brings in on the right, each box naming the item and its relation kind, and each edge an arrow pointing right. A neighbour on both sides SHALL appear on both; a self-relation SHALL show the item on both sides. Skills SHALL be boxes, playbooks pills and agents hexagons.

#### Scenario: Diagram of a skill
- **WHEN** `writer` is loaded by `release`
- **THEN** `writer`'s diagram has a box `release` with the text `loads` on the left of the centre box `writer`, and an edge from `release` whose head's tip touches `writer`'s box

#### Scenario: Two playbooks that load each other
- **WHEN** `a` loads `b` and `b` loads `a`
- **THEN** `a`'s diagram shows `b` on both sides

#### Scenario: Shapes
- **WHEN** a diagram shows a skill, a playbook and an agent
- **THEN** the playbook's box is a `rect` whose `rx` is half its height, the agent's a six-point `polygon`, and the skill's a `rect` with a smaller `rx`

### Requirement: Text from skill files
Text from skill files and map files SHALL be shown only as text, escaped by the template engine or the SVG renderer. Descriptions SHALL be made one line, lose control and format characters (Unicode `Cc` and `Cf`) and be cut at 1,024 code points as `stackledger skills map` does. Names, rule IDs, texts, whys, checks and groups, and line titles SHALL lose those characters where shown; identities, file names and references are unchanged.

#### Scenario: Description with HTML
- **WHEN** a description holds `<img src=x onerror=alert(1)>`
- **THEN** the pages show it as text and no page has an `img` element other than the header's brand mark

#### Scenario: Hostile script text
- **WHEN** a description and a rule text hold `</script><script>alert(1)</script>`
- **THEN** no page has a script element other than the site's script files

#### Scenario: Bidirectional override
- **WHEN** a skill name, a description, a rule text, a rule group and a skill line title hold U+202E
- **THEN** no file of the site holds U+202E, and the skill's page is still named after its page file name
