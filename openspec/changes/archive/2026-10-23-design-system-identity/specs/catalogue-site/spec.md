## ADDED Requirements

### Requirement: Site tokens from the design system
The colour, font-size and heading variables of "Look and theme" SHALL read the `site` variables of `@brunosouzas/design-system` (`--ds-site-*`), which the build ships in the site's own stylesheet. The accent, the focus colour and the colour on primary are stackledger's own and stay literal.

#### Scenario: Palette from the design system
- **WHEN** a site is built
- **THEN** its stylesheet defines `--ds-site-light-body` and `--ds-site-dark-body` with the package's values, `--color-body` is `var(--ds-site-light-body)` in light and `var(--ds-site-dark-body)` in dark, and a page's body background is `#FFFFFF` in light and `#1C1C1C` in dark

#### Scenario: Accent stays stackledger's
- **WHEN** a site is built without `spec.site.colors`
- **THEN** `--color-accent` is `#000f9f` in light and `#9da8ff` in dark

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
- **THEN** it shows the same focus outline as before this change, besides its frame

### Requirement: Brand mark
The favicon SHALL be the design system's `ledgerMark` at size 32 in a 32 × 32 SVG. The header SHALL show the same file before the site title, as a decorative image (`alt=""`) loaded from the site's own folder. It SHALL be the only `img` element the site's templates write.

#### Scenario: Favicon is the mark
- **WHEN** `site/public/favicon.svg` is read
- **THEN** it is a 32 × 32 SVG whose shapes equal those of `ledgerMark({ x: 0, y: 0, size: 32 })`

#### Scenario: Header mark with a custom title
- **WHEN** `spec.site.title` is `Northwind software` and any page is opened
- **THEN** the header link to the home holds an `img` with `alt=""` and a relative `src` ending in `favicon.svg`, followed by `Northwind software`

### Requirement: Strip interchange
On a journey strip, a stop that is also on another drawn line SHALL be a vertical capsule drawn by `stationMarker` with the interchange radius (`map.stopRadius` plus `map.interchangeExtra`), from 4 units above to 4 units below the line, so the terminal badge above it and the label below it stay clear of its outline, rim and shadow.

#### Scenario: Strip interchange is a capsule
- **WHEN** line `ship` stops at `slack`, which is also a stop of `design`
- **THEN** `slack`'s marker on the `ship` strip is a closed `path` taller than it is wide, centred on the line, and its label starts below the capsule's shadow

### Requirement: Diagram box titles
A diagram box whose title is empty after trimming SHALL show the item's reference instead (for example `component:forge`), so a title the catalogue allows never stops the build.

#### Scenario: Blank title
- **WHEN** component `forge` has `metadata.title` `" "` and the site is built
- **THEN** the build succeeds and `forge`'s box in every neighbourhood diagram shows `component:forge`

## MODIFIED Requirements

### Requirement: Diagram style
The neighbourhood and strip diagrams SHALL use the map's theme and the design system's pieces: boxes are `nodeBlock`, the centre item in its `focus` state; edges are `messageArrow` curves with a head at their right-hand end; the strip's line is a `pipe`, its stops `stationMarker` and its badges `lineBadge`. A box without a page, and an empty column's "Nothing", SHALL be a `placeholder`: dashed, muted, without a shadow.

#### Scenario: Neighbourhood boxes
- **WHEN** `forge`'s neighbourhood diagram is drawn in the `light` theme
- **THEN** each linked box has an outline stroked `#0A1033` and, before it, a shadow shape filled `#0A1033` moved right and down

#### Scenario: Edges point right
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`, and `forge`'s diagram is drawn
- **THEN** it has two edges, each ending in a filled head whose tip touches the left side of the box to its right: `forge`'s box for the edge from `vault`, `editor`'s box for the edge from `forge`

#### Scenario: Strip line and stops
- **WHEN** the strip of line `ship` in `#FF0000` is drawn in the `dark` theme
- **THEN** the line is a `#FF0000` path over a wider `#0A1033` casing path, and each stop marker has a shadow filled `#4C5CB8`

#### Scenario: Terminal badge over an end interchange
- **WHEN** line `ship` ends at `slack`, which is also a stop of `design`
- **THEN** in both themes the terminal badge above `slack`, with its outline and shadow, ends above the top of `slack`'s capsule with its outline and rim

#### Scenario: Resource without a shadow
- **WHEN** `forge` depends on resource `orders-db`, which is not a licence
- **THEN** the `orders-db` box has a dashed outline, no shadow shape, and its title centred in the box
