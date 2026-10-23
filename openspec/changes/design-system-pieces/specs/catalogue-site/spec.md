## ADDED Requirements

### Requirement: Interface icons
The zoom in, zoom out and reset buttons of `/map/` and `/skill-map/`, and the link to `renewals.ics` on `/reports/`, SHALL start with the design system's `uiIcon` `zoomIn`, `zoomOut`, `reset` and `download` in `currentColor`, so each follows its button's text colour, also on hover and when pressed. The theme switch SHALL show `uiIcon` `sun` in `color.white` in the light theme and `moon` in `color.ink` in the dark theme.

#### Scenario: Zoom buttons with icons
- **WHEN** `/map/` and `/skill-map/` of the example are built
- **THEN** each page's zoom in, zoom out and reset buttons hold, in that order, an inline `svg` equal to the `zoomIn`, `zoomOut` and `reset` icon, the first two with `aria-label` `Zoom in` and `Zoom out`, the third followed by the text `Reset`

#### Scenario: Calendar button with an icon
- **WHEN** the `full` site of the example is built
- **THEN** the link to `renewals.ics` on `/reports/` starts with an inline `svg` equal to the `download` icon, followed by its text

#### Scenario: Icon follows the button colour
- **WHEN** the reader hovers the zoom in button, in the light theme and in the dark theme
- **THEN** the icon's computed `fill` and `stroke` equal the button's computed text colour, before and during the hover

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

#### Scenario: No icon from catalogue text
- **WHEN** the catalogue's site title, line titles and item titles hold `<svg onload=alert(1)>`
- **THEN** the built pages show that text literally, and the only inline icons are the six of the site

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

### Requirement: Neighbourhood diagram
The neighbourhood diagram SHALL be a safe SVG drawn by stackledger: the item in the centre, its resolved direct dependencies on the left and direct dependants on the right. Next to it, a text list SHALL hold the same items: components and licences link to their pages, other resources are plain text. The page script opens a linked item's page when its box is clicked, or focused and Enter is pressed.

#### Scenario: Dependencies and dependants
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** the diagram on `forge`'s page shows `vault` on the left and `editor` on the right, and the text list links both

#### Scenario: Resource without a page
- **WHEN** `forge` depends on resource `orders-db`, which is not a licence
- **THEN** `orders-db` is in the diagram and in the text list as plain text, without a link, and its box is dashed, has no shadow and shows `orders-db` with `resource` under it, both in the muted colour

