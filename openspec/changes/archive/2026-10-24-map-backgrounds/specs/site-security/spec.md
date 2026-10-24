## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Map credit link
When the software map has a city backdrop (catalogue-site, Map backdrop), an `href` of an `a` element in the site's `map/index.html` whose decoded value equals `https://www.openstreetmap.org/copyright` SHALL be exempt from "No external requests" and "Relative URLs". Anywhere else, in any other attribute, or in a site whose map has no city backdrop, that URL SHALL fail the build like any other absolute URL.

#### Scenario: Map credit is the only other external URL
- **WHEN** both sites are built from the example with `spec.site.home.links` and `spec.map.backdrop: london`
- **THEN** the build succeeds, and apart from the home links the only attribute holding an absolute URL is the `href` of the credit anchor on each map page, `https://www.openstreetmap.org/copyright`

#### Scenario: Credit URL outside the map page
- **WHEN** the build's URL scan meets `https://www.openstreetmap.org/copyright` in an `href` of a page other than `map/index.html`, in a `src` of `map/index.html`, or in an `href` of `map/index.html` of a site whose map has no city backdrop
- **THEN** the scan reports it and the build fails before publication
