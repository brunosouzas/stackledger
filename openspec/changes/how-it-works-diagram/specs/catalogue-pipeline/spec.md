## ADDED Requirements

### Requirement: How it works diagram
`docs/images/how-it-works.svg`, shown by `docs/how-it-works.md` and the README, SHALL be the design system's body diagram (`coverTree`, `"format": "diagram"`) of `scripts/how-it-works.json`, drawn by the pinned package, which `validateCoverSpec` accepts with no problem. The spec SHALL draw every subgraph, node and edge of the Mermaid block of `docs/how-it-works.md` with the design system's pieces and token colours only, and the SVG SHALL be inert.

#### Scenario: Diagram file is the design system's drawing
- **GIVEN** the repository
- **WHEN** `scripts/how-it-works.json` is validated and drawn with `coverTree`
- **THEN** `validateCoverSpec` returns no problem, the spec's `format` is `diagram`, and the shapes of `docs/images/how-it-works.svg` (every element with its attributes and text) equal those of the drawing, with `width` 800 and a `viewBox` 560 units wide

#### Scenario: Stale diagram file
- **GIVEN** a copy of the drawing in which one attribute of one shape differs
- **WHEN** it is compared with the drawing as in "Diagram file is the design system's drawing"
- **THEN** the comparison fails

#### Scenario: Mermaid content kept
- **GIVEN** the Mermaid block of `docs/how-it-works.md`
- **WHEN** it is compared with the spec
- **THEN** each subgraph title is the `tag` of one `taggedContainer`, the first line of each node (its text before `<br/>`) is the first `text` line of one `diagramBox` (backticks removed), the spec has one `messageArrow` per edge, and the first word of each edge label is in an `edgeLabel`

#### Scenario: Colour literal refused
- **GIVEN** the spec with one box's `fill` set to a colour literal
- **WHEN** it is validated
- **THEN** `validateCoverSpec` reports a problem at that box's `fill` path

#### Scenario: Diagram is inert
- **WHEN** `docs/images/how-it-works.svg` is parsed
- **THEN** it has no `script`, `style` or `foreignObject` element, no event, `style` or link attribute, and no reference other than an internal `url(#id)`

### Requirement: How it works generation
`scripts/site-art.mjs` SHALL write `docs/images/how-it-works.svg` from `scripts/how-it-works.json`, after checking the spec with `validateCoverSpec`; on a problem it SHALL throw with the problems and write nothing. Running it again SHALL write the same bytes. No other generator of the diagram SHALL remain: `scripts/how-it-works-diagram.py` is removed, and `docs/how-it-works.md` names `node scripts/site-art.mjs`. The spec and the SVG SHALL stay out of the npm package.

#### Scenario: Same bytes on every run
- **WHEN** the drawing of the spec is serialised twice with `toSvg`
- **THEN** both strings are equal

#### Scenario: No hand-drawn generator
- **WHEN** `scripts/` is listed and `docs/how-it-works.md` read
- **THEN** there is no `how-it-works-diagram.py`, and the page names `node scripts/site-art.mjs` and no Python command

#### Scenario: Invalid spec writes nothing
- **GIVEN** a spec the package refuses
- **WHEN** the script's check runs on it
- **THEN** it throws an error naming `scripts/how-it-works.json` and each problem's path

#### Scenario: Diagram sources not published
- **WHEN** `package.json` is read
- **THEN** its `files` list includes neither `scripts` nor `docs`, nor any path under them
