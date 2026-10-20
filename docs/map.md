# Software map

Draw a local catalogue with Node.js 22 or later, from this checkout:

```sh
npm ci
npm run build
node dist/cli.js map examples/northwind --date 2027-06-01 > map.svg
node dist/cli.js map examples/northwind --view staff --theme dark --date 2027-06-01 > map-staff.svg
```

`stackledger map <folder> [--view full|staff] [--theme light|dark] [--date YYYY-MM-DD]` prints one self-contained SVG followed by a newline. Defaults are `full`, `light` and the machine's local calendar date. `--help` anywhere prints usage and exits 0, even alongside invalid arguments. An invalid option, impossible date, missing folder, extra folder or unreadable/non-directory folder exits 2 with the reason and usage on stderr and no stdout. A catalogue with errors still draws its served documents and exits 0. An unexpected failure while laying out or drawing the map is a bug in stackledger: it exits 1 with one `internal error` line on stderr, no usage text and no stdout. Run `stackledger validate` to gate a catalogue on validity.

The command reads local files only. It does not write the catalogue, open network connections or send telemetry. Shell redirection in these examples writes the SVG you requested. Recoverable problem counts, suggested positions and unrouted hops go to stderr. Counts appear only in `full`, and only when there are errors or warnings. When an invalid layout is excluded, both views explain that its stored positions are not used.

## Reading the map

A line is an ordered journey; a station is a component on a drawn journey. Components on no journey remain in the catalogue. Missing or invalid components are skipped, a stop repeated back to back counts once, and journeys with fewer than two served stops disappear. Codes sort before uncoded lines, by uppercase Unicode code point, with names breaking ties. The legend follows that order.

A single-line station is a tick; a shared station is an interchange spanning its lines. Each terminal has a badge with its line's code, or the first character of its name in uppercase. The badge sits beyond the station along the line's last segment. Lines ending at one station in the same direction share a row, stacked when they end horizontally and side by side otherwise. The row moves outwards until it clears station and licence markers, strokes and other badges. A deprecated component has a muted station and label. Its journeys keep their colours.

A solid gold disc means a served dependency licence is `active` or `to-confirm`. A hollow disc means `to-buy` when there is no solid licence. Cost, currency and billing cycle never change that glyph. An amber ring in `full` means an active or to-confirm licence renews between the map date and 30 days later, inclusive; overdue licences get no ring. `staff` never draws renewal rings and ignores the map date completely, even with custom Settings that expose renewal dates. It reads only the served view; if `status` is hidden, no licence marker can be inferred.

Labels use the component title or name, wrapped at spaces into at most two rows of 18 Unicode code points. Cuts end in an ellipsis. The full text remains in each station's SVG `title`. Fixed character widths keep placement independent of installed fonts. Interchanges are labelled first, then references. Eight positions are tried: right, left, above, below, upper right, lower right, upper left, lower left. The first without overlap wins; crowded stations use the least intersected area. Labels avoid other labels, station markers, terminal badges, zone titles and the stroke-width rectangle of every segment.

## Placing stations and zones

See [the catalogue format](catalogue-format.md) for `Line`, `MapLayout` and `Settings`. A stored `[column, row]` becomes `(64 × column, 64 × row)` in map units. The viewBox includes padding, header and legend; it does not shift the station's coordinates. Changing a journey never moves placed stations. Routes can change.

Unplaced stations receive suggested positions, in reference order. The target is the mean of distinct placed or earlier-suggested neighbours. The nearest free nonnegative cell wins by octile distance, ties by row then column. With no neighbour, the station starts in row 0 after every stored/suggested column, or at `[0, 0]` when none exists. Every stored cell is reserved, including undrawn items. For conflicting keys, the first component key and the first occupant of a cell win; other drawn stations receive suggestions. A layout with a field error supplies no positions.

A suggested station keeps its tick or interchange and gains a dashed hollow disc. stderr prints a header and entries such as `    component:editor: [3, 2]`, ready to copy into `spec.stations`. Suggestions are never saved automatically.

Zones follow declaration order. Components join through `metadata.labels["stackledger/zone"]`, matched ignoring case. A zone with drawn members is their convex hull, expanded by 32 units with round corners, with its declared title and colour. It can cover unrelated stations. Move stored positions when a crowded map needs more room.

## Routes and themes

Routes use horizontal, vertical and 45-degree grid steps. Every station except a hop's endpoints is blocked. A hop stays inside its endpoint box expanded by three cells and never turns more than 90 degrees. Searches use A* with a binary heap and a 50,000-state limit. A hop takes the shortest route; among routes of equal length it prefers, in order, fewer cells beside other stations, fewer and gentler bends, fewer diagonal crossings of used corridors, running straight through its end stations, and reusing edges other hops already use. A failed hop is drawn straight and reported with its line and endpoints on stderr. Shared hops use one route. Lines sharing any grid edge occupy separate slots in line order, independent of travel direction. When every line on an edge continues together onto the next edge, the bundle keeps each line on the same side through the bend instead of re-sorting it by the new edge's direction, so a bundle never crosses itself at a corner. Bends are mitred: the two offset segments meet where their lines intersect. A slot change on a straight run uses one short 45-degree connector. Fixed slot order can still introduce crossings where bundles split or merge at interchanges.

The `light` and `dark` themes preserve the catalogue's line and zone colours. All other colours, the font stack, line width, casing and hard offset shadow hooks live in [src/map/themes.ts](../src/map/themes.ts). Casing and shadows are off in both themes. Zone titles use the zone colour in `light` and a lighter tint of it in `dark` (`zoneTitleTint`), so they stay readable on the dark background. The renderer consumes Theme data without branching on a theme name. No font or other resource is fetched.

The output has a fixed element/attribute vocabulary, escaped XML text, validated hex colours and finite numbers rounded to two decimals. It contains no links, scripts, CSS, external references, document types or processing instructions. Identical served documents, theme and date yield byte-identical SVG, regardless of file names or document order.

## Library and reproducible example

`buildMapModel(view, date)` reduces a served view to drawing inputs. `layoutMap(model, theme.lineWidth)` produces plain geometry; `renderSvg(geometry, theme)` serializes it. All three, their types and `themes` are exported from `src/index.ts`. Geometry carries suggestions and unrouted hops for consumers to report.

[examples/northwind](../examples/northwind/) is a fictitious company using the spike's product titles, journeys, positions and finance zone, with synthetic licences and Settings. It validates with zero errors and warnings and has no label collisions with other labels, stations or terminal badges, and no terminal badge covers another badge, a station or a licence marker. The hero SVGs are generated by the real command:

```sh
node dist/cli.js map examples/northwind --theme light --date 2027-06-01 > docs/images/map-light.svg
node dist/cli.js map examples/northwind --theme dark --date 2027-06-01 > docs/images/map-dark.svg
```

Tests cover scenario-named numeric geometry, independently parsed hostile SVG, staff/full differential output, read-only execution under Node's permission model, example collisions and a seeded 200-station, 20-line fixture required to render within 5 seconds.
