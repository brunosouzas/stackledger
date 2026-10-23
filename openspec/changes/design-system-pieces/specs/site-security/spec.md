## MODIFIED Requirements

### Requirement: Escaped catalogue text
Every catalogue text in a page SHALL be HTML-escaped by the template engine. Only stackledger's own SVG (from the map and diagram renderers, which escape catalogue text, and the fixed interface icons, which hold none) and the generated stylesheet of validated colours are inserted raw. No catalogue value goes into a script, a `style`, or a URL other than the site's own paths built from validated names and the validated `http(s)` URLs of the home's `Links`.

#### Scenario: Hostile title
- **WHEN** a component's title is `<img src=x onerror=alert(1)>` and a line's title is `</script><script>alert(1)</script>`
- **THEN** every page that shows either title shows it only as text, and no page has an `img` element with `onerror` or a script element other than the site's script files

#### Scenario: No icon from catalogue text
- **WHEN** the catalogue's site title, line titles and item titles hold `<svg onload=alert(1)>`
- **THEN** the built pages show that text literally, and the only inline icons are the six of the site
