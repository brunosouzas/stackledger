## ADDED Requirements

### Requirement: How it works diagram
`docs/images/how-it-works.svg`, shown by `docs/how-it-works.md` and the README, SHALL be the design system's body diagram (`coverTree`, `"format": "diagram"`) of `scripts/how-it-works.json`, drawn by the pinned package, which `validateCoverSpec` accepts with no problem. The spec SHALL use the design system's pieces and token colours only, and the SVG SHALL be inert.

#### Scenario: Diagram file is the design system's drawing
- **GIVEN** the repository
- **WHEN** `scripts/how-it-works.json` is validated and drawn with `coverTree`
- **THEN** `validateCoverSpec` returns no problem, the spec's `format` is `diagram`, and the shapes of `docs/images/how-it-works.svg` (every element with its attributes and text) equal those of the drawing

#### Scenario: Stale diagram file
- **GIVEN** a copy of the drawing in which one attribute of one shape differs
- **WHEN** it is compared with the drawing as in "Diagram file is the design system's drawing"
- **THEN** the comparison fails

#### Scenario: Colour literal refused
- **GIVEN** the spec with one box's `fill` set to a colour literal
- **WHEN** it is validated
- **THEN** `validateCoverSpec` reports a problem at that box's `fill` path

#### Scenario: Diagram is inert
- **WHEN** `docs/images/how-it-works.svg` is parsed
- **THEN** it has no `script`, `style` or `foreignObject` element, no event, `style` or link attribute, and no reference other than an internal `url(#id)`

### Requirement: How it works diagram content
The spec SHALL draw the Mermaid block of `docs/how-it-works.md` and nothing else: one `diagramBox` per node whose `text` lines, backticks removed, are the node's lines; one `taggedContainer` per subgraph, tagged with its title; one `messageArrow` per edge, dashed only for the dotted edge; and one `edgeLabel` per edge label whose lines, joined and backticks removed, are the label.

#### Scenario: Mermaid content kept
- **GIVEN** the Mermaid block of `docs/how-it-works.md` and `scripts/how-it-works.json`
- **WHEN** they are compared as the requirement says
- **THEN** no problem is found

#### Scenario: Lost line or edge
- **GIVEN** the spec with one line removed from one box, or one arrow or edge label removed, or one box added
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison reports a problem naming that node, that edge label, that box, or the arrows

### Requirement: How it works generation
`scripts/site-art.mjs` SHALL write `docs/images/how-it-works.svg` from `scripts/how-it-works.json`, with the site art, after checking every spec it reads with `validateCoverSpec`. `scripts/how-it-works-diagram.py` is removed and `docs/how-it-works.md` names `node scripts/site-art.mjs`. The spec and the SVG SHALL stay out of the npm package.

#### Scenario: No hand-drawn generator
- **WHEN** `scripts/` is listed and `docs/how-it-works.md` read
- **THEN** there is no `how-it-works-diagram.py`, and the page names `node scripts/site-art.mjs` and no Python command

#### Scenario: Diagram sources not published
- **WHEN** `package.json` is read
- **THEN** its `files` list includes neither `scripts` nor `docs`, nor any path under them
