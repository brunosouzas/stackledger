## ADDED Requirements

### Requirement: Home banner art
The home page's banner SHALL show, after its `h1` and text, the image `home-banner.svg` from the site's own folder as a decorative `img` (`alt=""`, `width` 1200, `height` 420), as wide as the container and at its own ratio. The file SHALL be the design system's banner (`coverTree`) of the spec `site/art/home-banner.json`: the navy background, three lines with stations and an interchange, and line badges with no letter. It is the same in both themes and on every site.

#### Scenario: Banner on the home
- **WHEN** the home page of either site is opened
- **THEN** the banner section holds the `h1`, then the text, then an `img` with `alt=""` and a relative `src` ending in `home-banner.svg`

#### Scenario: Banner file is the design system's banner
- **WHEN** `site/public/home-banner.svg` is read
- **THEN** its shapes equal those of `coverTree` for `site/art/home-banner.json`, which `validateCoverSpec` accepts with no problem, and no `lineBadge` in the spec has a `text`

#### Scenario: Banner keeps its ratio
- **WHEN** the home is shown 375 and 1440 CSS pixels wide
- **THEN** the banner image is as wide as the container's content box and its height is 420/1200 of its width

## MODIFIED Requirements

### Requirement: Home page
The home page SHALL show a banner with the site title as its `h1`, `spec.site.home.text` or `Your software and skills, mapped.` when unset, and the banner art ("Home banner art"); then a Software card with the view's counts of components, licences and drawn journeys, linking Map, List, Journeys and, in `full`, Reports; and, with a skill set, a Skills card with the counts of skills, playbooks, agents and rules, linking List, Map and Rules.

#### Scenario: Home in full and staff
- **WHEN** both sites are built from a catalogue with 3 components, 2 licences and 1 drawn journey, and a skill set of 2 skills, 1 playbook, 1 agent and 4 rules
- **THEN** each home shows those counts, both link `/map/`, `/skills/`, `/skill-map/` and `/rules/`, only the `full` home links `/reports/`, and both show the default text

#### Scenario: Home text
- **WHEN** `spec.site.home.text` is `Northwind tools`
- **THEN** the home banner shows `Northwind tools` and not the default sentence

#### Scenario: Home without skills
- **WHEN** a site is built without a skill set
- **THEN** its home has no Skills card and no link to `/skills/`

#### Scenario: Empty catalogue
- **WHEN** the catalogue has no component, licence or journey
- **THEN** the home shows the Software card with three zero counts

### Requirement: Home links
When `spec.site.home.links` is set, the home page SHALL show a `Links` list after the cards, in the order given, each item an anchor to its `url` with its `title` as text and its `description`, when set, after it; every anchor SHALL carry `rel="noopener noreferrer"` and no `target`. A link with `icon` SHALL start its anchor with that icon: two decorative `img` elements (`alt=""`) from the site's own `link-icons/` folder, `<icon>-light.svg` shown in the light theme and `<icon>-dark.svg` in the dark one. Without links there is no `Links` heading. When the `Settings` in use has an error, there is no `Links` heading and the banner shows the default text.

#### Scenario: Two links
- **WHEN** `spec.site.home.links` lists `Articles` (`https://example.org/articles/`, description `What I write`) then `Team wiki` (`http://wiki.example.org/`)
- **THEN** the home shows `Links` with `Articles` then `Team wiki`, each an anchor to its URL with `rel="noopener noreferrer"`, and `What I write` after `Articles`

#### Scenario: Broken settings, no links
- **WHEN** the `Settings` has `spec.site.home.links` with one valid link and an error in `spec.site.colors`
- **THEN** the home has no `Links` heading and shows the default text

#### Scenario: Hostile link text
- **WHEN** a link's title is `<script>alert(1)</script>`
- **THEN** the home shows that text literally and holds no `script` element from it

#### Scenario: Link with an icon
- **WHEN** `spec.site.home.links` lists `Source` (`https://github.example.com/northwind/`, `icon: github`) then `Blog` (`https://blog.example.com/`, no icon)
- **THEN** the anchor of `Source` holds `img` elements with `alt=""` and relative `src` ending in `link-icons/github-light.svg` and `link-icons/github-dark.svg`, before the text `Source`, and the anchor of `Blog` holds no `img`

#### Scenario: Link icon follows the theme
- **WHEN** the home with the `Source` link is shown in the light theme, then in the dark theme
- **THEN** only `github-light.svg` is visible in light and only `github-dark.svg` in dark, each inline before the title

#### Scenario: Link icon files are the design system's
- **WHEN** each file in `site/public/link-icons/` is read
- **THEN** there are eight, one per icon and surface, each a 46 × 46 SVG whose shapes equal those of `linkIcon({ icon, x: 0, y: 0, surface })`

#### Scenario: Site art is inert
- **WHEN** `home-banner.svg`, `brand-mark-dark.svg` and each link icon are read
- **THEN** none holds a `script`, `foreignObject` or `style` element, a `style` attribute, an attribute starting with `on`, or an `href` or `url(…)` other than an internal `url(#id)`

#### Scenario: Icon with broken settings
- **WHEN** the `Settings` has a link with `icon: github` and an error elsewhere
- **THEN** the home has no `Links` heading and no link icon

### Requirement: Brand mark
The favicon SHALL be the design system's `ledgerMark` at size 32 in a 32 × 32 SVG. The header SHALL show the mark before the site title as decorative images (`alt=""`) loaded from the site's own folder: `favicon.svg` in the light theme, and `brand-mark-dark.svg`, the `ledgerMark` drawn for the dark surface, in the dark theme. The site's templates SHALL write `img` elements only for the header marks, the home banner and the home link icons.

#### Scenario: Favicon is the mark
- **WHEN** `site/public/favicon.svg` is read
- **THEN** it is a 32 × 32 SVG whose shapes equal those of `ledgerMark({ x: 0, y: 0, size: 32 })`

#### Scenario: Dark mark is the dark ledgerMark
- **WHEN** `site/public/brand-mark-dark.svg` is read
- **THEN** it is a 32 × 32 SVG whose shapes equal those of `ledgerMark({ x: 0, y: 0, size: 32, surface: "dark" })`

#### Scenario: Header mark with a custom title
- **WHEN** `spec.site.title` is `Northwind software` and any page is opened
- **THEN** the header link to the home holds an `img` with `alt=""` and a relative `src` ending in `favicon.svg`, then one ending in `brand-mark-dark.svg`, followed by `Northwind software`

#### Scenario: Mark follows the theme
- **WHEN** any page is shown in the light theme, then in the dark theme
- **THEN** only `favicon.svg` is visible in the header in light and only `brand-mark-dark.svg` in dark, inline before the title
