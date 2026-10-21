## ADDED Requirements

### Requirement: Ink outline and offset shadow
In both themes every drawn line SHALL have a casing in the ink `#0A1033` wider than the line, with the catalogue colour inside. Interchanges, terminal badges, licence markers and the legend panel SHALL have an outline in the ink, and they and the station ticks SHALL have a hard offset shadow: a copy of the shape in the theme's shadow colour, moved right and down by the theme's offset, drawn before the shape in the same group, without `transform` or `filter`.

#### Scenario: Pipe line
- **WHEN** line `ship` in `#FF0000` is drawn in either theme
- **THEN** its group holds a path stroked `#0A1033` wider than the line, followed by the same path stroked `#FF0000`

#### Scenario: Shadow under an interchange
- **WHEN** `slack` is an interchange drawn in the `light` theme
- **THEN** its group holds, before the outlined marker, a shape filled `#0A1033` at the marker's position plus the theme's offset, and the SVG has no `transform` or `filter`

#### Scenario: Dark shadow and rim
- **WHEN** the map is drawn with the `dark` theme
- **THEN** shadows are filled `#4C5CB8`, outlined stickers carry a `#EEF1FF` rim, and no shadow is filled `#0A1033`

## MODIFIED Requirements

### Requirement: Themes
The map SHALL support a `light` and a `dark` theme. Line and zone colours come from the catalogue in both themes; background, text, station, outline and shadow colours come from the theme. The `light` background SHALL be the tinted panel `#EEF2FF` and the `dark` background the navy `#14215A`. Text SHALL use the font stack `Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif`, and station labels are bold.

#### Scenario: Dark theme
- **WHEN** the map is drawn with the `dark` theme
- **THEN** the background is `#14215A` and line colours are the catalogue's colours

#### Scenario: Light theme
- **WHEN** the map is drawn with the `light` theme
- **THEN** the background is `#EEF2FF`, the `font-family` starts with `Lato` and ends with `sans-serif`, and every station label has a `font-weight` of at least 700

### Requirement: Label placement
Labels SHALL be placed interchanges first (more lines first), then by reference, at the first of eight candidates (right, left, above, below, then the four diagonals) with no overlap. Obstacles are other labels, station markers, licence markers and terminal badges grown by their outline and shadow, zone titles, and each line segment as a rectangle as wide as its casing. When every candidate overlaps, the one with the least intersected area wins, ties to the earlier candidate.

#### Scenario: Labels do not collide in the example
- **WHEN** the fictitious example catalogue is laid out
- **THEN** no two label boxes overlap and no label box covers a station, its shadow, a terminal badge or a badge's shadow

#### Scenario: Larger ink pushes a label out
- **WHEN** a label would fit next to a station marker without its ink but would touch the marker's shadow
- **THEN** the label is placed at a candidate clear of the marker grown by its outline and shadow

### Requirement: Safe SVG structure
The SVG SHALL be one XML document with `role="img"`, a `title`, one element per station with `data-ref="component:<name>"` and one per line with `data-ref="line:<name>"`, names as in `metadata.name`. Element names SHALL be limited to `svg`, `title`, `desc`, `g`, `path`, `line`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `text` and `tspan`. No attribute named `href`, `style`, `id` or starting with `on` SHALL appear; fonts are named, never embedded.

#### Scenario: Allowed names only
- **WHEN** any map is drawn
- **THEN** every element and attribute name in the SVG is on the allow-lists

#### Scenario: No embedded font
- **WHEN** any map is drawn in either theme
- **THEN** the SVG names its font stack in `font-family` and contains no `@font-face`, `url(` or font data
