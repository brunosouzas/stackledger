## ADDED Requirements

### Requirement: How it works diagram
`docs/images/how-it-works.svg`, shown by `docs/how-it-works.md` and the README, SHALL be the design system's body diagram (`coverTree`, `"format": "diagram"`) of `scripts/how-it-works.json`, drawn by the pinned package, which `validateCoverSpec` accepts with no problem. The spec SHALL use the design system's pieces and token colours only, and the SVG SHALL be inert.

#### Scenario: Diagram file is the design system's drawing
- **GIVEN** the repository
- **WHEN** `scripts/how-it-works.json` is validated and drawn with `coverTree`
- **THEN** `validateCoverSpec` returns no problem, the spec's `format` is `diagram`, and the shapes of `docs/images/how-it-works.svg` (every element with its attributes and text) equal those of the drawing, with `width` 800 and a `viewBox` 560 units wide

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
The spec SHALL draw the Mermaid block of `docs/how-it-works.md`: one `diagramBox` per node whose first `text` line (backticks removed) is the node's first line and whose text and subtitle hold each of its other lines; one `taggedContainer` per subgraph, tagged with its title, holding exactly its nodes' boxes; and one `messageArrow` per edge, `from` and `to` within 8 units of only the source and the target box, dashed only for the dotted edge.

#### Scenario: Mermaid content kept
- **GIVEN** the Mermaid block of `docs/how-it-works.md` and `scripts/how-it-works.json`
- **WHEN** they are compared as the requirement says
- **THEN** every node, subgraph and edge has its piece, and the spec has no other box, container or arrow apart from the two mode pills

#### Scenario: Reversed edge
- **GIVEN** the spec with the `from` and `to` of one arrow swapped
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison fails naming that edge

#### Scenario: Missing edge or node line
- **GIVEN** the spec without one arrow, or with one node's detail line removed from its box
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison fails naming the edge or the node

#### Scenario: Box outside its subgraph
- **GIVEN** the spec with one node's box moved outside its subgraph's container
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison fails naming the node

### Requirement: How it works generation
`scripts/site-art.mjs` SHALL write `docs/images/how-it-works.svg` with the site art through one function that checks every spec with `validateCoverSpec` before writing any file; on a problem it SHALL throw naming the spec file and each problem's path, and write no file. Running it again SHALL write the same bytes. `scripts/how-it-works-diagram.py` is removed and `docs/how-it-works.md` names `node scripts/site-art.mjs`. The spec and the SVG SHALL stay out of the npm package.

#### Scenario: Art written to its places
- **GIVEN** an empty temporary folder
- **WHEN** the art is written into it from the repository's specs
- **THEN** it holds `docs/images/how-it-works.svg` equal to the committed file and the site art files under `site/public/`, and writing again gives the same bytes

#### Scenario: Invalid spec writes nothing
- **GIVEN** an empty temporary folder and a diagram spec the package refuses
- **WHEN** the art is written into it
- **THEN** it throws an error naming `scripts/how-it-works.json` and each problem's path, and the folder is still empty

#### Scenario: No hand-drawn generator
- **WHEN** `scripts/` is listed and `docs/how-it-works.md` read
- **THEN** there is no `how-it-works-diagram.py`, and the page names `node scripts/site-art.mjs` and no Python command

#### Scenario: Diagram sources not published
- **WHEN** `package.json` is read
- **THEN** its `files` list includes neither `scripts` nor `docs`, nor any path under them
