## MODIFIED Requirements

### Requirement: How it works diagram
`docs/images/how-it-works.svg`, shown by `docs/how-it-works.md` and the README, SHALL be the design system's body diagram (`coverTree`, `"format": "diagram"`) of `scripts/how-it-works.json`, drawn by the pinned package, which `validateCoverSpec` accepts with no problem, with its Source faces embedded by the package's `embedFonts`. The spec SHALL use the design system's pieces and token colours only (`color.state.*` for states), and the SVG SHALL be inert apart from those fonts.

#### Scenario: Diagram file is the design system's drawing
- **GIVEN** the repository
- **WHEN** `scripts/how-it-works.json` is validated, drawn with `coverTree` and passed to `embedFonts`
- **THEN** `validateCoverSpec` returns no problem, the spec's `format` is `diagram`, and the shapes of `docs/images/how-it-works.svg` (every element with its attributes and text, the embedded fonts included) equal those of the result

#### Scenario: Stale diagram file
- **GIVEN** a copy of the drawing in which one attribute of one shape differs
- **WHEN** it is compared with the drawing as in "Diagram file is the design system's drawing"
- **THEN** the comparison fails

#### Scenario: Colour literal refused
- **GIVEN** the spec with one box's `fill` set to a colour literal
- **WHEN** it is validated
- **THEN** `validateCoverSpec` reports a problem at that box's `fill` path

#### Scenario: Removed colour path refused
- **GIVEN** the spec with one box's `fill` set to `color.healthy`, a path the pinned package no longer has
- **WHEN** it is validated
- **THEN** `validateCoverSpec` reports a problem at that box's `fill` path

#### Scenario: Diagram is inert
- **WHEN** `docs/images/how-it-works.svg` is parsed
- **THEN** it has no `script` or `foreignObject` element, no event, `style` or link attribute, exactly one `style` element holding only `@font-face` rules whose `src` is a `data:font/ttf;base64,` URL, and no other reference than an internal `url(#id)`

#### Scenario: Font file unreadable
- **GIVEN** `embedFonts` cannot read one of the package's font files
- **WHEN** `node scripts/site-art.mjs` runs
- **THEN** it exits with an error naming that file and leaves `docs/images/how-it-works.svg` as it was
