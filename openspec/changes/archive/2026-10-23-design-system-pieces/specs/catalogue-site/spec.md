## ADDED Requirements

### Requirement: Interface icons
The zoom in, zoom out and reset buttons of `/map/` and `/skill-map/`, and the link to `renewals.ics` on `/reports/`, SHALL start with the design system's `uiIcon` `zoomIn`, `zoomOut`, `reset` and `download` in `currentColor`, so each follows its button's text colour, also on hover. The theme switch SHALL show `uiIcon` `sun` in `color.white` in the light theme and `moon` in `color.ink` in the dark theme.

#### Scenario: Zoom buttons with icons
- **WHEN** `/map/` and `/skill-map/` of the example are built
- **THEN** each page's zoom in, zoom out and reset buttons hold, in that order, an inline `svg` equal to the `zoomIn`, `zoomOut` and `reset` icon, the first two with `aria-label` `Zoom in` and `Zoom out`, the third followed by the text `Reset`

#### Scenario: Calendar button with an icon
- **WHEN** the `full` site of the example is built
- **THEN** the link to `renewals.ics` on `/reports/` starts with an inline `svg` equal to the `download` icon, followed by its text

#### Scenario: Icon follows the button colour
- **WHEN** the reader hovers the zoom in button, in the light theme and in the dark theme
- **THEN** before and during the hover, the computed `stroke` of the icon's magnifier `path` equals the button's computed text colour and its computed `fill` stays `none`

#### Scenario: Theme switch icons
- **WHEN** any page is shown in the light theme, then in the dark theme, with JavaScript
- **THEN** the switch shows only the `sun` icon in light and only the `moon` icon in dark, each equal to its site icon

### Requirement: Inline icon markup
Each interface icon SHALL be an `svg` element inline in the page's HTML, written at build time as `toSvg` of an `svg` root (`viewBox` `0 0 24 24`, `width` and `height` 16, `aria-hidden="true"`, `focusable="false"`) holding the piece's body at `(0, 0)`; never an `img` nor a CSS background. Each button keeps its accessible name: `Zoom in`, `Zoom out`, `Reset` and the calendar link's text.

#### Scenario: Icon is the design system's
- **WHEN** each of the six site icons is read
- **THEN** it equals `toSvg` of the `svg` root above holding `uiIcon({ name, x: 0, y: 0, colour }).body`, with `colour` `currentColor` for the four button icons, `color.white` for `sun` and `color.ink` for `moon`

#### Scenario: Interface icons are inert
- **WHEN** every inline `svg` of every built page that is not a map, a diagram or a line badge is read
- **THEN** none holds a `script`, `foreignObject` or `style` element, a `style` attribute, an attribute starting with `on`, or an `href` or `url(…)`

### Requirement: Neighbourhood placeholder box
A box without a page in the neighbourhood diagram SHALL be the design system's `nodeBlock` with `state` `placeholder` and the item's kind as `subtitle`: dashed, muted, without shadow, the title above the muted kind.

#### Scenario: Empty column keeps no subtitle
- **WHEN** `forge` has no dependants
- **THEN** the right column shows the dashed `Nothing` placeholder, centred, with no subtitle

## MODIFIED Requirements

### Requirement: Map page
The map page SHALL show the map of its view, in the light or dark theme following the page theme, with zoom in, zoom out and reset buttons, each with its icon ("Interface icons"), and drag to pan. Without JavaScript the map is still shown at full size.

#### Scenario: Zoom
- **WHEN** the reader presses zoom in twice and then reset
- **THEN** the map scales up twice and returns to its initial size

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
- **THEN** the `orders-db` box has a dashed outline and no shadow shape, and shows `orders-db` at the box's left inset with `resource` under it, both in the muted colour ("Neighbourhood placeholder box")
