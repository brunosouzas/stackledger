## ADDED Requirements

### Requirement: Diagram style
The neighbourhood and strip diagrams SHALL use the map's theme: its background, the Lato font stack, ink outlines and hard offset shadows as offset geometry. Boxes, stop markers and badges have an ink outline and a shadow; the strip's line has an ink casing. A resource without a page keeps a dashed outline and has no shadow, so it does not look clickable.

#### Scenario: Neighbourhood boxes
- **WHEN** `forge`'s neighbourhood diagram is drawn in the `light` theme
- **THEN** each linked box has an outline stroked `#0A1033` and, before it, a shadow shape filled `#0A1033` moved right and down

#### Scenario: Strip line and stops
- **WHEN** the strip of line `ship` in `#FF0000` is drawn in the `dark` theme
- **THEN** the line is a `#FF0000` stroke over a wider `#0A1033` casing, and each stop marker has a shadow filled `#4C5CB8`

#### Scenario: Terminal badge over an end interchange
- **WHEN** line `ship` ends at `slack`, which is also a stop of `design`
- **THEN** in both themes the terminal badge above `slack`, with its outline and shadow, ends above the top of `slack`'s marker and rim

#### Scenario: Resource without a shadow
- **WHEN** `forge` depends on resource `orders-db`, which is not a licence
- **THEN** the `orders-db` box has a dashed outline and no shadow shape

## MODIFIED Requirements

### Requirement: Look and theme
The default look SHALL follow brunosouzas.com: its colour tokens for light and dark, the Heebo and Signika fonts for pages and Lato for the map and diagrams, all shipped with the package, and its type scale. `spec.site.colors` SHALL override the matching light-theme tokens only. When the `Settings` in use has an error, the site uses the default title and colours. All colours and fonts come from one stylesheet of variables.

#### Scenario: Accent override
- **WHEN** `spec.site.colors.accent` is `#E4002B`
- **THEN** the light theme's accent variable is `#E4002B` and the dark theme's is the default

#### Scenario: Broken settings
- **WHEN** the `Settings` in use has an error in `spec.site.colors`
- **THEN** the site uses the default title and colours

#### Scenario: Lato shipped locally
- **WHEN** a site is built
- **THEN** its stylesheet declares `@font-face` rules for `Lato` whose files are in the site's own folder, and no page requests a font from another origin
