# site-security Specification

## Purpose
Defines what the built sites may and may not contain or request: one view per site, no external requests, a fixed Content Security Policy, headers and robots files for the host, and escaping of catalogue text.

## Requirements

### Requirement: One view per site
Each site SHALL be built only from its view, in its own Astro build with its own data file and cache. The `staff` site SHALL be built first and contain no hidden value in any file. Its files SHALL NOT depend on `--date` nor on valid values of hidden fields; as `catalogue-views` says, an invalid hidden value MAY unserve its licence, and that is the only allowed effect.

#### Scenario: No trace of the cost
- **WHEN** a licence has `cost: 98765` and `note: ZETA-NOTE` and the default hidden fields apply
- **THEN** neither `98765` nor `ZETA-NOTE` appears in any file of the `staff` site

#### Scenario: Staff ignores hidden fields and the date
- **WHEN** two catalogues differ only in valid values of default-hidden licence fields and are built with different `--date` values
- **THEN** their `staff` sites are byte-identical

#### Scenario: Custom-hidden vendor and status
- **WHEN** `Settings` hides `vendor` and `status`, and two catalogues differ only in valid values of those fields
- **THEN** their `staff` sites are byte-identical and contain no vendor or status text, filter option or marker derived from them

#### Scenario: Broken settings hide the defaults
- **WHEN** the `Settings` in use has an error
- **THEN** the `staff` site hides the default fields, as the `staff` view does

### Requirement: No inline code
Pages SHALL contain no inline `script` or `style` element, no `style` attribute and no event-handler attribute; scripts and styles are files of the site. Every page of both sites SHALL carry the same Content Security Policy.

#### Scenario: Same policy everywhere
- **WHEN** both sites are built from the example
- **THEN** every HTML page has the same CSP and none has an inline script, inline style or `style` attribute

### Requirement: Content Security Policy
Every HTML page SHALL carry, in a `meta` element, exactly `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`.

#### Scenario: Pages work under the policy
- **WHEN** the map, list, component, licence and journey pages are opened in a headless browser
- **THEN** no CSP violation is reported and zoom, filters, highlight and search work

### Requirement: No external requests
No `href`, `src`, `srcset`, `action`, `formaction`, `poster` or `data` attribute and no CSS `url()` or `@import` SHALL hold an absolute or protocol-relative URL. Exempt: the SVG namespace in `xmlns`, an `href` of an `a` element in the site's root `index.html` whose decoded value equals a URL of `spec.site.home.links`, and the anchor of "Map credit link". Any other absolute URL, on any page or attribute, fails the build. There are no analytics.

#### Scenario: Only local URLs
- **WHEN** both sites are built from the example
- **THEN** no such attribute or CSS value starts with a scheme or `//`

#### Scenario: Home links are the only external URLs
- **WHEN** both sites are built from the example with `spec.site.home.links` listing `https://example.org/articles/`
- **THEN** the build succeeds, and the only attributes holding an absolute URL are the `href` of that `Links` anchor on each home page

#### Scenario: Link URL outside the home
- **WHEN** the build's URL scan meets `https://example.org/articles/`, one of the home links, in an `href` of a page other than the root `index.html`, or in a `src` of the root `index.html`
- **THEN** the scan reports it and the build fails before publication

### Requirement: Map credit link
When the software map has a city backdrop (catalogue-site, Map backdrop), an `href` of an `a` element in the site's `map/index.html` whose decoded value equals `https://www.openstreetmap.org/copyright` SHALL be exempt from "No external requests" and "Relative URLs". Anywhere else, in any other attribute, or in a site whose map has no city backdrop, that URL SHALL fail the build like any other absolute URL.

#### Scenario: Map credit is the only other external URL
- **WHEN** both sites are built from the example with `spec.site.home.links` and `spec.map.backdrop: london`
- **THEN** the build succeeds, and apart from the home links the only attribute holding an absolute URL is the `href` of the credit anchor on each map page, `https://www.openstreetmap.org/copyright`

#### Scenario: Credit URL outside the map page
- **WHEN** the build's URL scan meets `https://www.openstreetmap.org/copyright` in an `href` of a page other than `map/index.html`, in a `src` of `map/index.html`, or in an `href` of `map/index.html` of a site whose map has no city backdrop
- **THEN** the scan reports it and the build fails before publication

### Requirement: Relative URLs
Every URL SHALL be relative to the file that holds it and resolve inside its site's folder: HTML URL attributes, CSS `url()` and `@import`, JavaScript static and dynamic imports, and asset references through `import.meta.url`. The anchors exempt by "No external requests" are exempt here too. A generated URL form the build does not handle SHALL fail the build before publication.

#### Scenario: Two sites on one host
- **WHEN** the `full` and `staff` sites are served at `/full/` and `/staff/` of one host and every page is opened
- **THEN** no request leaves the site's prefix and none fails

### Requirement: Headers file
The build SHALL write `_headers` at the root of the output folder and in each site, applying to `/*` the Content Security Policy above plus `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

#### Scenario: Root headers
- **WHEN** a build succeeds
- **THEN** `<out>/_headers` holds those headers for `/*`

### Requirement: Not indexed
Every page SHALL have `<meta name="robots" content="noindex, nofollow">`. The build SHALL write `robots.txt` with `User-agent: *` and `Disallow: /` at the root of the output folder and in each site.

#### Scenario: Root robots
- **WHEN** a build succeeds
- **THEN** `<out>/robots.txt` disallows everything

### Requirement: Escaped catalogue text
Every catalogue text in a page SHALL be HTML-escaped by the template engine. Only stackledger's own SVG (from the map and diagram renderers, which escape catalogue text, and the fixed interface icons, which hold none) and the generated stylesheet of validated colours are inserted raw. No catalogue value goes into a script, a `style`, or a URL other than the site's own paths built from validated names and the validated `http(s)` URLs of the home's `Links`.

#### Scenario: Hostile title
- **WHEN** a component's title is `<img src=x onerror=alert(1)>` and a line's title is `</script><script>alert(1)</script>`
- **THEN** every page that shows either title shows it only as text, and no page has an `img` element with `onerror` or a script element other than the site's script files

#### Scenario: No icon from catalogue text
- **WHEN** the catalogue's site title, line titles and item titles hold `<svg onload=alert(1)>`
- **THEN** the built pages show that text literally, and the only inline icons are the six of the site
