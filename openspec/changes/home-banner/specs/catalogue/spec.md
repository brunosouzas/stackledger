## MODIFIED Requirements

### Requirement: Home settings
`spec.site.home` MAY have `text`, a non-empty string of at most 200 characters, and `links`, a list of 1 to 20 mappings, each with `title` (non-empty, at most 60 characters), `url` (at most 2,048 characters; an `https:` or `http:` WHATWG URL with a host, no user name or password, and no space, control character, `<`, `>`, quote or backtick), optionally `description` (non-empty, at most 200 characters) and optionally `icon` (one of `github`, `website`, `linkedin` and `email`). Any other field under `spec.site.home` or in a link, and any other `icon` value, SHALL be an error on its path.

#### Scenario: Home text and links
- **WHEN** `spec.site.home` has `text: Northwind tools` and `links` with `{ title: Articles, url: "https://example.org/articles/", description: What we write }`
- **THEN** it has no problem

#### Scenario: Script URL
- **WHEN** a link's `url` is `javascript:alert(1)`, and in a second document `data:text/html,x`
- **THEN** each gets an error on `spec.site.home.links[0].url`

#### Scenario: Bad link
- **WHEN** `links[0]` has no `url`, `links[1]` has `url: "https://user:secret@example.org/"`, `links[2]` has `url: "https://"`, and `links[3]` has `target: _blank`
- **THEN** there are errors on `spec.site.home.links[0].url`, `spec.site.home.links[1].url`, `spec.site.home.links[2].url` and `spec.site.home.links[3].target`

#### Scenario: Too many links
- **WHEN** `spec.site.home.links` lists 21 links
- **THEN** it gets an error on `spec.site.home.links`

#### Scenario: Unknown home field
- **WHEN** `spec.site.home` has `image`
- **THEN** it gets an error on `spec.site.home.image`

#### Scenario: Link icon
- **WHEN** `links[0]` has `icon: github` and `links[1]` has `icon: website`
- **THEN** it has no problem

#### Scenario: Unknown link icon
- **WHEN** `links[0]` has `icon: twitter`, and in a second document `icon: GitHub`
- **THEN** each gets an error on `spec.site.home.links[0].icon`

#### Scenario: Icon names match the design system
- **WHEN** the allowed `icon` values are compared with the design system's link icon names
- **THEN** they are the same four names
