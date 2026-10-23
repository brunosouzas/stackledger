## ADDED Requirements

### Requirement: Ink frame
Cards, buttons, line chips and tag chips SHALL have the identity's ink frame: an outline of `--ds-outline-small` in `--ds-color-ink` and a hard shadow offset right and down by `--ds-shadow-small` with no blur. In the dark theme the shadow SHALL be `surface.dark.shadow` and a ring of `surface.dark.rimWidth` in `surface.dark.rim` SHALL surround the outline.

#### Scenario: Card frame in light
- **WHEN** a home page card is shown in the light theme
- **THEN** its border is 3px solid `#0A1033` and its box shadow is `#0A1033` offset 4px right and 4px down with a blur of 0

#### Scenario: Card frame in dark
- **WHEN** the same card is shown in the dark theme
- **THEN** its border is 3px solid `#0A1033`, and its box shadows are a 1px `#EEF2FF` ring with no offset and a `#4C5CB8` shadow offset 4px right and down with a blur of 0

#### Scenario: Focus still visible
- **WHEN** a line chip button is focused with the keyboard in either theme
- **THEN** it shows the focus outline it showed before this change, besides its frame

### Requirement: Brand mark
The favicon SHALL be the design system's `ledgerMark` at size 32 in a 32 × 32 SVG. The header SHALL show the same file before the site title, as a decorative image (`alt=""`) loaded from the site's own folder.

#### Scenario: Favicon is the mark
- **WHEN** `site/public/favicon.svg` is read
- **THEN** it is a 32 × 32 SVG whose content equals `ledgerMark({ x: 0, y: 0, size: 32 })`

#### Scenario: Header mark with a custom title
- **WHEN** `spec.site.title` is `Northwind software` and any page is opened
- **THEN** the header link to the home holds an `img` with `alt=""` and a relative `src` ending in `favicon.svg`, followed by `Northwind software`

## MODIFIED Requirements

### Requirement: Look and theme
The default look SHALL follow brunosouzas.com through the `site` tokens of `@brunosouzas/design-system`: its colour tokens for light and dark, the Heebo and Signika fonts for pages and Lato for the map and diagrams, all shipped with the package, and its type scale. The accent and focus colours are stackledger's own. `spec.site.colors` SHALL override the matching light-theme tokens only. When the `Settings` in use has an error, the site uses the default title and colours. All colours and fonts come from one stylesheet of variables, which reads the package's variables.

#### Scenario: Accent override
- **WHEN** `spec.site.colors.accent` is `#E4002B`
- **THEN** the light theme's accent variable is `#E4002B` and the dark theme's is the default

#### Scenario: Broken settings
- **WHEN** the `Settings` in use has an error in `spec.site.colors`
- **THEN** the site uses the default title and colours

#### Scenario: Lato shipped locally
- **WHEN** a site is built
- **THEN** its stylesheet declares `@font-face` rules for `Lato` whose files are in the site's own folder, and no page requests a font from another origin

#### Scenario: Palette from the design system
- **WHEN** a site is built
- **THEN** its stylesheet defines `--ds-site-light-body` and `--ds-site-dark-body` with the package's values, `--color-body` is `var(--ds-site-light-body)` in light and `var(--ds-site-dark-body)` in dark, and a page's body background is `#FFFFFF` in light and `#1C1C1C` in dark

### Requirement: Diagram style
The neighbourhood and strip diagrams SHALL use the map's theme and the design system's pieces: boxes are `nodeBlock`, the centre item in its `focus` state; edges are `messageArrow` curves with a head at their right-hand end; the strip's line is a `pipe`, its stops `stationMarker` and its badges `lineBadge`. A strip stop that is an interchange SHALL be a vertical capsule. A box without a page, and an empty column's "Nothing", SHALL be a `placeholder`: dashed, muted, without a shadow, so it does not look clickable.

#### Scenario: Neighbourhood boxes
- **WHEN** `forge`'s neighbourhood diagram is drawn in the `light` theme
- **THEN** each linked box has an outline stroked `#0A1033` and, before it, a shadow shape filled `#0A1033` moved right and down

#### Scenario: Edges point right
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`, and `forge`'s diagram is drawn
- **THEN** it has two edges, each ending in a filled head whose tip touches the left side of the box to its right: `forge`'s box for the edge from `vault`, `editor`'s box for the edge from `forge`

#### Scenario: Strip line and stops
- **WHEN** the strip of line `ship` in `#FF0000` is drawn in the `dark` theme
- **THEN** the line is a `#FF0000` stroke over a wider `#0A1033` casing, and each stop marker has a shadow filled `#4C5CB8`

#### Scenario: Strip interchange is a capsule
- **WHEN** line `ship` stops at `slack`, which is also a stop of `design`
- **THEN** `slack`'s marker on the `ship` strip is a closed `path` taller than it is wide, centred on the line

#### Scenario: Terminal badge over an end interchange
- **WHEN** line `ship` ends at `slack`, which is also a stop of `design`
- **THEN** in both themes the terminal badge above `slack`, with its outline and shadow, ends above the top of `slack`'s marker and rim

#### Scenario: Resource without a shadow
- **WHEN** `forge` depends on resource `orders-db`, which is not a licence
- **THEN** the `orders-db` box has a dashed outline, no shadow shape, and its title centred in the box
