## MODIFIED Requirements

### Requirement: No external requests
No `href`, `src`, `srcset`, `action`, `formaction`, `poster` or `data` attribute and no CSS `url()` or `@import` SHALL hold an absolute or protocol-relative URL. Exempt: the SVG namespace in `xmlns`, and an `href` of an `a` element in the site's root `index.html` whose decoded value equals a URL of `spec.site.home.links`. Any other absolute URL, on any page or attribute, fails the build. There are no analytics.

#### Scenario: Only local URLs
- **WHEN** both sites are built from the example
- **THEN** no such attribute or CSS value starts with a scheme or `//`

#### Scenario: Home links are the only external URLs
- **WHEN** both sites are built from the example with `spec.site.home.links` listing `https://example.org/articles/`
- **THEN** the build succeeds, and the only attributes holding an absolute URL are the `href` of that `Links` anchor on each home page

#### Scenario: Link URL outside the home
- **WHEN** the build's URL scan meets `https://example.org/articles/`, one of the home links, in an `href` of a page other than the root `index.html`, or in a `src` of the root `index.html`
- **THEN** the scan reports it and the build fails before publication

### Requirement: Relative URLs
Every URL SHALL be relative to the file that holds it and resolve inside its site's folder: HTML URL attributes, CSS `url()` and `@import`, JavaScript static and dynamic imports, and asset references through `import.meta.url`. The anchors exempt by "No external requests" are exempt here too. A generated URL form the build does not handle SHALL fail the build before publication.

#### Scenario: Two sites on one host
- **WHEN** the `full` and `staff` sites are served at `/full/` and `/staff/` of one host and every page is opened
- **THEN** no request leaves the site's prefix and none fails

### Requirement: Escaped catalogue text
Every catalogue text in a page SHALL be HTML-escaped by the template engine. Only two things are inserted raw: SVG produced by stackledger's map and diagram renderers, which escape catalogue text themselves, and the generated stylesheet of validated colours. No catalogue value goes into a script, a `style`, or a URL other than the site's own paths built from validated names and the validated `http(s)` URLs of the home's `Links`.

#### Scenario: Hostile title
- **WHEN** a component's title is `<img src=x onerror=alert(1)>` and a line's title is `</script><script>alert(1)</script>`
- **THEN** every page that shows either title shows it only as text, and no page has an `img` element with `onerror` or a script element other than the site's script files
