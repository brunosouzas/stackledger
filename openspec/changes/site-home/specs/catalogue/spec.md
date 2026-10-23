## MODIFIED Requirements

### Requirement: Site settings
`spec.site` MAY have `title`, a non-empty string of at most 60 characters; `colors`, a mapping whose keys are among `primary`, `accent`, `body` and `text`, each `#` followed by six hexadecimal digits in either case; and `home` ("Home settings"). Any other field under `spec.site` SHALL be an error.

#### Scenario: Title and accent
- **WHEN** a `Settings` document has `spec.site.title: Northwind software` and `spec.site.colors.accent: "#e4002b"`
- **THEN** it has no problem

#### Scenario: Title too long
- **WHEN** `spec.site.title` has 61 characters
- **THEN** it gets an error on `spec.site.title`

#### Scenario: Colour name
- **WHEN** `spec.site.colors.primary` is `red`
- **THEN** it gets an error on `spec.site.colors.primary`

#### Scenario: Logo not supported
- **WHEN** `spec.site` has `logo`
- **THEN** it gets an error on `spec.site.logo`

## ADDED Requirements

### Requirement: Home settings
`spec.site.home` MAY have `text`, a non-empty string of at most 200 characters, and `links`, a list of 1 to 20 mappings, each with `title` (non-empty, at most 60 characters), `url` (at most 2,048 characters, starting with `https://` or `http://`, matched ignoring case, with no space or control character) and optionally `description` (non-empty, at most 200 characters). Any other field SHALL be an error on its path.

#### Scenario: Home text and links
- **WHEN** `spec.site.home` has `text: Northwind tools` and `links` with `{ title: Articles, url: "https://example.org/articles/", description: What we write }`
- **THEN** it has no problem

#### Scenario: Script URL
- **WHEN** a link's `url` is `javascript:alert(1)`, and in a second document `data:text/html,x`
- **THEN** each gets an error on `spec.site.home.links[0].url`

#### Scenario: Too many links
- **WHEN** `spec.site.home.links` lists 21 links
- **THEN** it gets an error on `spec.site.home.links`

#### Scenario: Unknown home field
- **WHEN** `spec.site.home` has `image`
- **THEN** it gets an error on `spec.site.home.image`
