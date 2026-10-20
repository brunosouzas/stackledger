## ADDED Requirements

### Requirement: Pages
Each site SHALL have a map page at `/`, a software list at `/software/`, one page per served component at `/software/<name>/`, one page per served licence at `/licences/<name>/`, a journeys list at `/journeys/` and one page per drawn line at `/journeys/<name>/`, with `<name>` the item's `metadata.name` in lower case. Every page SHALL use relative links so a site works under any path prefix, such as `/full/` and `/staff/` on one host.

#### Scenario: Item pages
- **WHEN** the catalogue has components `editor` and `forge` and licence `licence-editor`
- **THEN** the site has `/software/editor/`, `/software/forge/` and `/licences/licence-editor/`

#### Scenario: Served under a prefix
- **WHEN** the `staff` site is served at `https://example.test/staff/`
- **THEN** every internal link on every page resolves to a page of the `staff` site

### Requirement: Layout
Every page SHALL share one layout: a header with the site title (from `spec.site.title`, default `Software map`) and links to Map, Software and Journeys; a footer with the view name and the stackledger version (no date, so the `staff` site does not depend on the build date); and a light and dark theme switch remembered in the browser.

#### Scenario: Site title
- **WHEN** `spec.site.title` is `Northwind software`
- **THEN** every page's header and `title` element show `Northwind software`

#### Scenario: View in the footer
- **WHEN** a page of the `staff` site is opened
- **THEN** its footer says `staff view`

### Requirement: Look and theme
The default look SHALL follow brunosouzas.com: its colour tokens, the Heebo and Signika fonts shipped with the package, and its spacing and typography scale. `spec.site.colors` SHALL override the matching tokens. The theme's colours and fonts SHALL come from one stylesheet of variables, so a later theme is data only.

#### Scenario: Accent override
- **WHEN** `spec.site.colors.accent` is `#E4002B`
- **THEN** the stylesheet sets the accent variable to `#E4002B`

### Requirement: Map page
The map page SHALL show the map of its view drawn by the map engine, in the light and dark theme following the page theme, with zoom in, zoom out and reset buttons, drag to pan, and keyboard access to the same actions. Without JavaScript the map is still shown at full size.

#### Scenario: Zoom
- **WHEN** the reader presses zoom in twice and then reset
- **THEN** the map scales up twice and returns to its initial size

### Requirement: Map interaction
On the map page, choosing a zone in the zone filter SHALL dim every station and line segment outside that zone; choosing a line in the legend SHALL dim every other line. Clicking or pressing Enter on a station SHALL open its item page.

#### Scenario: Station link
- **WHEN** the reader clicks station `component:editor`
- **THEN** the browser opens `/software/editor/`

#### Scenario: Highlight a line
- **WHEN** the reader chooses line `ship` in the legend
- **THEN** every other line is dimmed and choosing it again restores them

### Requirement: Software list
The software list SHALL show every served component and licence with its title or name, kind, type, lifecycle (components), status (licences), owner and zone, sorted by reference. A search box SHALL filter rows by any shown text, and filters SHALL restrict by kind, zone, lifecycle and owner, all in the browser from an index built from the view.

#### Scenario: Search
- **WHEN** the reader types `north` in the search box
- **THEN** only rows with `north` in a shown field remain

#### Scenario: Without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the full table is shown, unfiltered

### Requirement: Component page
A component page SHALL show its title, name, description, type, lifecycle, owner, zone and tags; its licences with the licence fields of the view; the journeys that stop at it, each linking to its journey page; a neighbourhood diagram; the impact of removing it; and its unresolved references.

#### Scenario: Journeys
- **WHEN** `editor` is a stop of `ship` and `design`
- **THEN** its page links to `/journeys/design/` and `/journeys/ship/`

### Requirement: Licence page
A licence page SHALL show its title, name, owner and the `spec.licence` fields of the view, the components that use it (each linking to its page), and the impact of removing it.

#### Scenario: Staff licence page
- **WHEN** the `staff` site shows licence `licence-editor` with default hidden fields
- **THEN** the page shows vendor and status and no cost, currency, cycle, renewal date, payer, seats, vault item or note

### Requirement: Neighbourhood diagram
The neighbourhood diagram SHALL be an SVG drawn by stackledger, with the item in the centre, the items it depends on to the left and the items that depend on it to the right, each a link to its page when it has one, in the map's colours and the page theme. It SHALL follow the map's safe-SVG rules.

#### Scenario: Dependencies and dependants
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** the diagram on `forge`'s page shows `vault` on the left and `editor` on the right

### Requirement: Impact of removal
Item pages SHALL list every item that depends on the item directly or indirectly, with its depth, and the journeys affected, as the MCP `impact` tool computes them, with the same limit of 500.

#### Scenario: Indirect dependant
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** `vault`'s page lists `forge` at depth 1 and `editor` at depth 2

### Requirement: Journey pages
The journeys list SHALL show every drawn line in line order with its badge, colour, title and number of stops. A journey page SHALL show a strip diagram: the stops in order on a straight line in the line's colour, each stop linking to its item page and showing the other lines that stop there as badges linking to their journey pages.

#### Scenario: Interchange on a strip
- **WHEN** line `ship` stops at `slack` and `slack` is also a stop of `design`
- **THEN** the `ship` strip shows `slack` with the `design` badge linking to `/journeys/design/`

### Requirement: Accessibility
Pages SHALL have one `h1`, landmarks for header, main and footer, visible focus, text alternatives for every diagram (a `title` and a list of the same content next to it), and colour contrast of at least 4.5:1 for text in both themes.

#### Scenario: Diagram alternative
- **WHEN** a component page shows its neighbourhood diagram
- **THEN** the page also lists the same dependencies and dependants as text links
