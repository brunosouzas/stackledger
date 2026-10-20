## MODIFIED Requirements

### Requirement: Allowed attributes
Attribute names SHALL be limited to `xmlns`, `role`, `viewBox`, `width`, `height`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `d`, `points`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, `opacity`, `fill-opacity`, `stroke-opacity`, `font-family`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline`, `data-ref`, `data-line` and `data-zone`. `data-line` holds `line:<name>` references and `data-zone` a zone name, both from validated names.

#### Scenario: Unknown attribute
- **WHEN** the hostile fixture is drawn
- **THEN** no attribute outside this list appears, `xml:base` included

#### Scenario: Data attributes for the site
- **WHEN** a map is drawn
- **THEN** every line stroke has `data-line` with its line reference and every station in a zone has `data-zone` with the zone name
