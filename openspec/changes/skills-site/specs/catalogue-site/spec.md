## MODIFIED Requirements

### Requirement: Layout
Every page SHALL share one layout: a header with the site title (from `spec.site.title`, default `Software map`) and links to Map, Software and Journeys, plus Skills when the site has a skill set and Reports in the `full` site; a footer with the view name and the stackledger version; and a theme switch that follows `prefers-color-scheme` until the reader chooses light or dark, then remembers the choice in the browser.

#### Scenario: Theme remembered
- **WHEN** the reader chooses dark on one page and opens another page
- **THEN** the other page opens in dark

#### Scenario: Site title
- **WHEN** `spec.site.title` is `Northwind software`
- **THEN** every page's header and `title` element show `Northwind software`

#### Scenario: View in the footer
- **WHEN** a page of the `staff` site is opened
- **THEN** its footer says `staff view`

#### Scenario: Reports link
- **WHEN** any page is opened
- **THEN** its header links Reports in the `full` site and not in the `staff` site

#### Scenario: Skills link
- **WHEN** both sites are built with a skill set, and again without one
- **THEN** every page's header links Skills (`/skills/`) in both sites of the first build and in neither site of the second
