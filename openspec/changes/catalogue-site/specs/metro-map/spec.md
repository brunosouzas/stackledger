## MODIFIED Requirements

### Requirement: Allowed attributes
Attribute names SHALL be limited to `xmlns`, `role`, `viewBox`, `width`, `height`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `cx`, `cy`, `r`, `rx`, `ry`, `d`, `points`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray`, `opacity`, `fill-opacity`, `stroke-opacity`, `font-family`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline`, `data-ref`, `data-line` and `data-zone`.

#### Scenario: Unknown attribute
- **WHEN** the hostile fixture is drawn
- **THEN** no attribute outside this list appears, `xml:base` included

### Requirement: Safe SVG text
Every text taken from the catalogue SHALL be XML-escaped (`&`, `<`, `>`, `"`, `'`), with characters not allowed in XML 1.0 replaced by U+FFFD. No catalogue text SHALL appear in an attribute except `data-ref`, `data-line` and `data-zone`, and colours are written only after matching `#RRGGBB`.

#### Scenario: Hostile titles
- **WHEN** component, line and zone titles contain `<script>`, `&`, `"`, `'`, `]]>`, `javascript:`, U+0001 and U+FFFE
- **THEN** the SVG parses as XML, every element and attribute name is on the allow-lists, and the titles appear only as text

## ADDED Requirements

### Requirement: Data attributes
Every line stroke, station, terminal badge and legend entry SHALL carry `data-line` with the space-separated `line:<name>` references of the lines it belongs to, in line order. Every station whose component is in a drawn zone SHALL carry `data-zone` with the zone's declared name, lower-cased and XML-escaped.

#### Scenario: Interchange in a zone
- **WHEN** `xero` is a stop of `invoice` and `expenses` and is in zone `finance`
- **THEN** its station has `data-line` listing `line:invoice` and `line:expenses` in line order and `data-zone="finance"`
