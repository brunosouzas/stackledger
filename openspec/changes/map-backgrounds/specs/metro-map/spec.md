## ADDED Requirements

### Requirement: Map backdrop
The software map SHALL take a backdrop, `neutral` or `london`, with or without its header and legend. With `neutral` the SVG SHALL be the same, byte for byte, as stackledger 0.5.1 draws it. A backdrop SHALL NOT move any station, line, label, badge, zone, header or legend. The skills map, the neighbourhood diagrams, the strips and the relation diagram SHALL NOT take a backdrop.

#### Scenario: Neutral is today's map
- **WHEN** the example catalogue is drawn with `neutral`, map date 2027-06-01, in the `full` view and both themes
- **THEN** each SVG equals, byte for byte, `docs/images/map-light.svg` and `docs/images/map-dark.svg` as committed in 0.5.1, and the `staff` view in both themes equals the SVG recorded from 0.5.1 with the same options

#### Scenario: Neutral site map is today's map
- **WHEN** the example catalogue's software map is drawn without header and legend, as the site draws it, with `neutral`, in both views and both themes
- **THEN** each SVG equals, byte for byte, the one recorded from 0.5.1 with the same options

#### Scenario: Backdrop moves nothing
- **WHEN** the example catalogue is drawn with `london` and with `neutral` in both views and both themes
- **THEN** both SVGs, with the backdrop group and the credit removed, are identical

#### Scenario: Skills map stays flat
- **WHEN** a skills map is drawn for a catalogue whose settings have `spec.map.backdrop: london`
- **THEN** its SVG has no backdrop group and no credit

### Requirement: Backdrop layer
With `london` the SVG SHALL hold one more group, right after the background layer and right before the grid layer, with exactly two paths: the water, filled with the surface's `backdropWater` and outlined with `backdropWaterEdge`, then the parks, filled with `backdropPark`, from the theme's surface tokens of `@brunosouzas/design-system` ("Design system tokens"). The writer's allow-list ("Allowed attributes") SHALL stay unchanged: no `fill-rule`, `transform`, `clip-path` or new attribute name.

#### Scenario: London layer order
- **WHEN** the example catalogue is drawn with `london` in either theme, with and without its header and legend
- **THEN** the group right after the background layer holds exactly two paths, the water path first, and the grid layer comes right after it

#### Scenario: London colours are the tokens
- **WHEN** the example catalogue is drawn with `london` in the `dark` theme
- **THEN** the water fill equals `surface.dark.backdropWater`, its stroke `surface.dark.backdropWaterEdge` and the park fill `surface.dark.backdropPark`

#### Scenario: Holes without fill-rule
- **WHEN** the London data is drawn in either theme
- **THEN** every hole of a polygon is wound opposite to its outer ring, so the default non-zero fill rule leaves it empty

### Requirement: Backdrop scale
The backdrop paths SHALL be the bundled data ("Backdrop data") scaled by `s = max(W / w, H / h)`, where `W` and `H` are the SVG's viewBox width and height and `w` and `h` the data's bounding box size, and centred on the viewBox centre, so the city covers the whole viewBox and the viewBox crops it. Coordinates are written with at most one decimal.

#### Scenario: Backdrop covers the map
- **WHEN** the example catalogue is drawn with `london`, with and without its header and legend
- **THEN** the bounding box of all backdrop path points contains the viewBox, and equals the data's bounding box scaled by `s` and centred on the viewBox centre, within 0.1 units

### Requirement: Backdrop data
The London data SHALL ship inside the package as a generated module in `dist/`, under 16 KB, whose header comment names OpenStreetMap, the extract date and the Open Database License. Drawing SHALL read nothing from disk or the network.

#### Scenario: Data size
- **WHEN** the package is built
- **THEN** the London data module in `dist/` is smaller than 16 KB

#### Scenario: Data provenance
- **WHEN** the London data module is read
- **THEN** its header names OpenStreetMap, the extract date and the Open Database License

### Requirement: Backdrop data generation
A maintainer script, not published, SHALL make the London module from a committed source extract of central London (water: `natural=water` rivers, canals, lakes, reservoirs, basins and docks, and `waterway=riverbank`; parks: `leisure=park`, `landuse=recreation_ground`), with the Overpass query and the extract date recorded beside it. It SHALL use pinned tool versions and only the committed extract, so running it twice gives the same module.

#### Scenario: Reproducible data
- **WHEN** the maintainer script runs on the committed extract
- **THEN** the generated module equals the committed one byte for byte

### Requirement: Backdrop credit
A software map drawn with a city backdrop SHALL end, before the closing tag, with the text `© OpenStreetMap contributors`, right-aligned near the bottom-right corner of the viewBox, in the surface's `backdropCredit` colour, inside the viewBox and, when the legend is drawn, clear of it. A map drawn with `neutral` SHALL NOT carry it.

#### Scenario: Credit on London
- **WHEN** the example catalogue is drawn with `london` in either theme, with and without its header and legend
- **THEN** the SVG contains the text `© OpenStreetMap contributors`, its box lies inside the viewBox and does not overlap the legend

#### Scenario: No credit on neutral
- **WHEN** the example catalogue is drawn with `neutral`
- **THEN** the SVG does not contain `OpenStreetMap`
