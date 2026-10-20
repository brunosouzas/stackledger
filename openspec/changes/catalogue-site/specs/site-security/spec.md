## ADDED Requirements

### Requirement: One view per site
Each site SHALL be built only from its view: the `staff` site from the `staff` view, with no hidden value in any file it contains (HTML, JSON, SVG, CSS, JavaScript, headers). The `staff` site SHALL NOT depend on `--date` nor on any hidden field.

#### Scenario: No trace of the cost
- **WHEN** a licence has `cost: 98765` and `note: ZETA-NOTE` and the default hidden fields apply
- **THEN** neither `98765` nor `ZETA-NOTE` appears in any file of the `staff` site

#### Scenario: Staff ignores hidden fields and the date
- **WHEN** two catalogues differ only in default-hidden licence fields and are built with different `--date` values
- **THEN** their `staff` sites are byte-identical

### Requirement: No external requests
No file of either site SHALL make the browser request anything outside the site: no external script, style, font, image, frame, form action or preconnect, and no analytics. Links to other sites SHALL NOT be generated in this change.

#### Scenario: Only local URLs
- **WHEN** both sites are built from the example
- **THEN** no attribute or CSS value in any file contains `http:`, `https:` or `//` at the start of a URL

### Requirement: Content Security Policy
Every HTML page SHALL carry a Content Security Policy in a `meta` element that allows scripts and styles only from the site itself or by hash, images only from the site or `data:`, fonts only from the site, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`. No page SHALL need `'unsafe-inline'` or `'unsafe-eval'`.

#### Scenario: Policy present
- **WHEN** any page is opened
- **THEN** its CSP has `object-src 'none'` and `base-uri 'none'` and contains neither `unsafe-inline` nor `unsafe-eval`

#### Scenario: Pages work under the policy
- **WHEN** the map, list, item and journey pages are opened in a headless browser
- **THEN** no CSP violation is reported and zoom, filter and search work

### Requirement: Headers file
Each site SHALL contain a `_headers` file applying to every path: the same Content Security Policy plus `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` and `Permissions-Policy` denying camera, microphone and geolocation.

#### Scenario: Headers for the host
- **WHEN** a site is built
- **THEN** its `_headers` file holds those headers for `/*`

### Requirement: Not indexed
Every page SHALL have `<meta name="robots" content="noindex, nofollow">`, and each site SHALL have a `robots.txt` that disallows everything.

#### Scenario: robots.txt
- **WHEN** a site is built
- **THEN** `robots.txt` contains `User-agent: *` and `Disallow: /`

### Requirement: Escaped catalogue text
Every catalogue text in a page SHALL be HTML-escaped by the template engine; no catalogue value SHALL be inserted as raw HTML, into a script, into a `style`, or into a URL other than the site's own item paths built from validated names.

#### Scenario: Hostile title
- **WHEN** a component's title is `<img src=x onerror=alert(1)>`
- **THEN** every page showing it contains the text escaped and no `img` element with `onerror`
