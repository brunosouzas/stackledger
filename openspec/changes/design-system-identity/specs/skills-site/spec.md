## MODIFIED Requirements

### Requirement: Relation diagram
Each item page SHALL hold a safe SVG drawn by stackledger in the style of the neighbourhood diagram: the item in the centre, what brings it in on the left, what it brings in on the right, each box naming the item and its relation kind, and each edge an arrow pointing right. A neighbour on both sides SHALL appear on both; a self-relation SHALL show the item on both sides. Skills SHALL be `nodeBlock` boxes, playbooks `pillNode` pills and agents `hexNode` hexagons, each wide enough that its text clears the shape's ends.

#### Scenario: Diagram of a skill
- **WHEN** `writer` is loaded by `release`
- **THEN** `writer`'s diagram has a box `release` with the text `loads` on the left of the centre box `writer`, and an edge from `release` whose head's tip touches `writer`'s box

#### Scenario: Two playbooks that load each other
- **WHEN** `a` loads `b` and `b` loads `a`
- **THEN** `a`'s diagram shows `b` on both sides

#### Scenario: Shapes
- **WHEN** a diagram shows a skill, a playbook and an agent
- **THEN** the playbook's box is a `rect` whose `rx` is half its height, the agent's a six-point `polygon`, and the skill's a `rect` with a smaller `rx`

#### Scenario: Long playbook name fits
- **WHEN** a playbook whose name has 64 code points is on a diagram
- **THEN** its name's estimated width ends at least half the box height before the box's right edge
