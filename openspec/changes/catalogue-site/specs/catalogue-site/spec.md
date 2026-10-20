## Purpose

Defines the pages of the static catalogue site, what each shows from its view, how readers move between them, the little interactivity they have, and the site's look.

## ADDED Requirements

### Requirement: Pages
Each site SHALL have a map page at `/`, a software list at `/software/`, one page per served component at `/software/<name>/`, one page per served licence at `/licences/<name>/`, a journeys list at `/journeys/` and one page per drawn line at `/journeys/<name>/`, with `<name>` the item's `metadata.name` in lower case.

#### Scenario: Item pages
- **WHEN** the catalogue has components `editor` and `forge` and licence `licence-editor`
- **THEN** the site has `/software/editor/`, `/software/forge/` and `/licences/licence-editor/`

#### Scenario: No journeys
- **WHEN** the catalogue has no drawn line
- **THEN** the map page shows `No journeys yet` and the journeys list says there are none

### Requirement: Layout
Every page SHALL share one layout: a header with the site title (from `spec.site.title`, default `Software map`) and links to Map, Software and Journeys; a footer with the view name and the stackledger version; and a theme switch that follows `prefers-color-scheme` until the reader chooses light or dark, then remembers the choice in the browser.

#### Scenario: Site title
- **WHEN** `spec.site.title` is `Northwind software`
- **THEN** every page's header and `title` element show `Northwind software`

#### Scenario: View in the footer
- **WHEN** a page of the `staff` site is opened
- **THEN** its footer says `staff view`

### Requirement: Look and theme
The default look SHALL follow brunosouzas.com: its colour tokens for light and dark, the Heebo and Signika fonts shipped with the package, and its type scale. `spec.site.colors` SHALL override the matching light-theme tokens only. When the `Settings` in use has an error, the site uses the default title and colours. All colours and fonts come from one stylesheet of variables.

#### Scenario: Accent override
- **WHEN** `spec.site.colors.accent` is `#E4002B`
- **THEN** the light theme's accent variable is `#E4002B` and the dark theme's is the default

#### Scenario: Broken settings
- **WHEN** the `Settings` in use has an error in `spec.site.colors`
- **THEN** the site uses the default title and colours

### Requirement: Map page
The map page SHALL show the map of its view, in the light or dark theme following the page theme, with zoom in, zoom out and reset buttons and drag to pan. Without JavaScript the map is still shown at full size.

#### Scenario: Zoom
- **WHEN** the reader presses zoom in twice and then reset
- **THEN** the map scales up twice and returns to its initial size

### Requirement: Map interaction
Choosing a line in the legend SHALL dim every other line's strokes and badges and every station that line does not stop at; choosing it again restores them. Choosing a zone in the zone filter SHALL dim every station not in that zone and every line with no stop in it. The page script makes each station focusable as a link: click or Enter opens its item page.

#### Scenario: Station link
- **WHEN** the reader clicks station `component:editor`, or focuses it and presses Enter
- **THEN** the browser opens the `editor` component page

#### Scenario: Highlight a line
- **WHEN** the reader chooses line `ship` in the legend
- **THEN** every other line is dimmed, and choosing `ship` again restores them

### Requirement: Software list
The software list SHALL be a table of every served component and licence with its title or name, kind, type, lifecycle or status, owner and zone, sorted by reference, each row linking to its page. A search box SHALL hide rows that do not contain the typed text, ignoring case, in their shown cells; filters SHALL restrict by kind, zone, lifecycle and owner. Filtering works on the table rows themselves.

#### Scenario: Search
- **WHEN** the reader types `north` in the search box
- **THEN** only rows with `north` in a shown cell, in any case, remain

#### Scenario: Nothing matches
- **WHEN** the search matches no row
- **THEN** the page says no item matches

#### Scenario: Without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the full table is shown, unfiltered

### Requirement: Component page
A component page SHALL show its title, name, description, type, lifecycle, owner, zone and tags; its licences with the licence fields of the view, each linking to its page; the journeys that stop at it; a neighbourhood diagram; the impact of removing it; and its unresolved references. A drawn line links to its journey page; a line that is not drawn is named as text.

#### Scenario: Journeys
- **WHEN** `editor` is a stop of `ship` and `design`
- **THEN** its page links to the `design` and `ship` journey pages

#### Scenario: Line with one served stop
- **WHEN** `editor` is a stop of `old`, a line left with one served stop
- **THEN** its page names `old` without a link

### Requirement: Licence page
A licence page SHALL show its title, name, owner and the `spec.licence` fields of the view, the components that use it (each linking to its page), and the impact of removing it.

#### Scenario: Staff licence page
- **WHEN** the `staff` site shows licence `licence-editor` with default hidden fields
- **THEN** the page shows vendor and status and no cost, currency, cycle, renewal date, payer, seats, vault item or note

### Requirement: Neighbourhood diagram
The neighbourhood diagram SHALL be an SVG drawn by stackledger, following the map's safe-SVG rules: the item in the centre, the items it depends on to the left and the items that depend on it to the right, in the map's colours and the page theme. Next to it, a text list SHALL hold the same items as links; the page script also opens an item's page when its box is clicked or focused and Enter is pressed.

#### Scenario: Dependencies and dependants
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** the diagram on `forge`'s page shows `vault` on the left and `editor` on the right, and the text list links both

### Requirement: Impact of removal
Item pages SHALL list every item that depends on the item directly or indirectly, with its depth, and the journeys affected, as the MCP `impact` tool computes them, and SHALL say when the list stops at 500.

#### Scenario: Indirect dependant
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** `vault`'s page lists `forge` at depth 1 and `editor` at depth 2

### Requirement: Journey pages
The journeys list SHALL show every drawn line in line order with its badge, colour, title and number of stops. A journey page SHALL show a strip diagram (stops in order on a straight line in the line's colour, other lines at each stop as badges) and a text list with the same stops and lines as links.

#### Scenario: Interchange on a strip
- **WHEN** line `ship` stops at `slack` and `slack` is also a stop of `design`
- **THEN** the `ship` page shows `slack` with a `design` badge, and its list links `slack` and the `design` journey page

### Requirement: Accessibility
Pages SHALL have one `h1`, landmarks for header, main and footer, visible focus and a text alternative for every diagram. The default colour tokens SHALL give text a contrast of at least 4.5:1 in both themes.

#### Scenario: Diagram alternative
- **WHEN** a component page shows its neighbourhood diagram
- **THEN** the page also lists the same dependencies and dependants as text links
