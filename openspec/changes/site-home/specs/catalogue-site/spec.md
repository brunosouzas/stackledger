## MODIFIED Requirements

### Requirement: Pages
Each site SHALL have a home page at `/`, a map page at `/map/`, a software list at `/software/`, one page per served component at `/software/<name>/`, one page per served licence at `/licences/<name>/`, a journeys list at `/journeys/` and one page per drawn line at `/journeys/<name>/`, with `<name>` the item's `metadata.name` in lower case. The `full` site SHALL also have `/reports/` and `/renewals.ics`, as `licence-reports` defines.

#### Scenario: Item pages
- **WHEN** the catalogue has components `editor` and `forge` and licence `licence-editor`
- **THEN** the site has `/software/editor/`, `/software/forge/` and `/licences/licence-editor/`

#### Scenario: No journeys
- **WHEN** the catalogue has no drawn line
- **THEN** the map page shows `No journeys yet` and the journeys list says there are none

#### Scenario: Reports in full only
- **WHEN** both sites are built
- **THEN** the `full` site has `/reports/` and `/renewals.ics` and the `staff` site has neither

#### Scenario: Map at /map/
- **WHEN** a site is built
- **THEN** `/map/` holds the map of its view and `/` holds the home page, with no map on it

### Requirement: Layout
Every page SHALL share one layout: a header with the site title (from `spec.site.title`, default `stackledger`) linking the home page `/`, and the divisions Software (`/map/`) and, with a skill set, Skills (`/skills/`); under it the division's sub-navigation, for Software: Map (`/map/`), List (`/software/`), Journeys, and Reports in `full`; a footer with the view name and stackledger version; and a theme switch following `prefers-color-scheme` until the reader picks one, then remembering it.

#### Scenario: Theme remembered
- **WHEN** the reader chooses dark on one page and opens another page
- **THEN** the other page opens in dark

#### Scenario: Site title
- **WHEN** `spec.site.title` is `Northwind software`
- **THEN** every page's header and `title` element show `Northwind software`

#### Scenario: Default title
- **WHEN** the catalogue has no `spec.site.title`, or its `Settings` has an error
- **THEN** every page's header and `title` element show `stackledger`, also on the Skills pages

#### Scenario: Title opens the home
- **WHEN** the reader clicks the site title on `/skills/` or on `/software/editor/`
- **THEN** the home page `/` of the same site opens

#### Scenario: View in the footer
- **WHEN** a page of the `staff` site is opened
- **THEN** its footer says `staff view`

#### Scenario: Reports link
- **WHEN** any Software page is opened
- **THEN** its sub-navigation links Reports in the `full` site and not in the `staff` site

#### Scenario: Software sub-navigation
- **WHEN** the reader opens `/journeys/`, then the page of the journey `ship`
- **THEN** the header marks Software, the sub-navigation links Map (`/map/`), List and Journeys, and only on `/journeys/` is Journeys marked with `aria-current="page"`

#### Scenario: Skills link
- **WHEN** both sites are built with a skill set, and again without one
- **THEN** every page's header links Skills (`/skills/`) in both sites of the first build and in neither site of the second

## ADDED Requirements

### Requirement: Home page
The home page SHALL show a banner with the site title as its `h1` and `spec.site.home.text`, or `Your software and skills, mapped.` when unset; then a Software card with the view's counts of components, licences and drawn journeys, linking Map, List, Journeys and, in `full`, Reports; and, with a skill set, a Skills card with the counts of skills, playbooks, agents and rules, linking List, Map and Rules. No division's sub-navigation is marked.

#### Scenario: Home in full and staff
- **WHEN** both sites are built from a catalogue with 3 components, 2 licences and 1 drawn journey, and a skill set of 2 skills, 1 playbook, 1 agent and 4 rules
- **THEN** each home shows those counts, both link `/map/`, only the `full` home links `/reports/`, and both show the default text

#### Scenario: Home without skills
- **WHEN** a site is built without a skill set
- **THEN** its home has no Skills card and no link to `/skills/`

#### Scenario: Empty catalogue
- **WHEN** the catalogue has no component, licence or journey
- **THEN** the home shows the Software card with three zero counts

### Requirement: Home links
When `spec.site.home.links` is set, the home page SHALL show a `Links` list after the cards, in the order given, each item an anchor to its `url` with its `title` as text and its `description`, when set, after it; every anchor SHALL carry `rel="noopener noreferrer"` and no `target`. Without links there is no `Links` heading. Texts are escaped as all catalogue text.

#### Scenario: Two links
- **WHEN** `spec.site.home.links` lists `Articles` (`https://example.org/articles/`, description `What I write`) then `Team wiki` (`http://wiki.example.org/`)
- **THEN** the home shows `Links` with `Articles` then `Team wiki`, each an anchor to its URL with `rel="noopener noreferrer"`, and `What I write` after `Articles`

#### Scenario: Hostile link text
- **WHEN** a link's title is `<script>alert(1)</script>`
- **THEN** the home shows that text literally and holds no `script` element from it
