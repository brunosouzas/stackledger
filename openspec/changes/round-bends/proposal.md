## Why

The lines of the metro map turn with a mitred corner (`src/map/parallel.ts`, "Bundles through bends"). The banner of brunosouzas.com, drawn with the same pieces, turns its lines with a curve, and the owner wants the maps to look like it (AB#166). A spike drew the Northwind maps with arcs of radius 0, 16, 24 and 32 map units in both themes, on the skills map and at phone width (`~/.hermes/spikes/design-system/round-bends/contact-sheet.png`); the owner chose 32.

## What Changes

- **Round bends.** Where a line turns 45 or 90 degrees at a grid node that is not a station, its corner becomes a circular arc. The radius of a bundle's centre line is the design system token `map.bendRadius` (32); each line of the bundle turns around the same centre, so the lines stay parallel and in order through the curve.
- **Corners that stay mitred.** A bend at a station (the marker covers it, and the line must pass through the marker's centre), a bend where the bundle splits or merges, a bend whose arc would run past the straight part of an edge it shares with another bend, and the sharper turns at stations keep today's drawing. A bend that stays mitred for one line of a bundle stays mitred for every line of it.
- **Labels follow the drawn line.** The label obstacles of a line follow its arcs, so no label covers the inside of a curve.
- **Both maps.** The software map and the skills map share the engine, so both get round bends. Station positions, routes, line order, terminal badges and interchanges do not change.
- **Dependency.** The design system version that adds `map.bendRadius` (0.3.1 or 0.4.0, published by the owner), pinned exactly as today.

Out of scope:

- line width and station size (the spike showed the arc alone is enough);
- the slot-change connector on straight runs, the journey strip and the legend sample, which have no bends;
- the pieces of AB#167 and the home banner (their own changes).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metro-map`: "Round bends" added; "Bundles through bends" (arcs instead of mitres, and when a corner stays mitred), "Label placement" (obstacles follow arcs), "Design system tokens" and "Theme ink comes from the design system" (`map.bendRadius`), and "Software map unchanged" (line paths may differ at bends away from stations) modified.

## Impact

- `package.json`, `npm-shrinkwrap.json`: the design system version with `map.bendRadius`.
- `src/map/parallel.ts` (bend decisions and the drawn path of each stroke), `src/map/layout.ts` (obstacles from the drawn path), `src/map/svg.ts` (writes the path with `A` commands through the `pipe` piece), `src/map/themes.ts` (`bendRadius` in the theme, checked with the other ink).
- Tests: `test/unit/map-layout.test.ts` ("Bundle keeps its sides through a bend: bends are mitred"), `test/unit/map-svg.test.ts` ("Example map"), the hero SVGs `docs/images/map-*.svg` and the README map screenshots. Each change is explained in the pull request.
- Visible: rounded corners on both maps in both themes; nothing else moves.

## Implicit requirements

- **Errors and invalid input:** none new. The arc is computed from validated geometry; non-finite numbers are already refused by the SVG writer.
- **Limits:** the map has no coordinate limit (design system 0.1.1); arcs keep it.
- **Repetition and idempotency:** output stays byte-identical for the same input.
- **Concurrency:** n/a, pure functions.
- **Security:** the `A` command is already allowed by the `pipe` piece and by the map's path check; no new element or attribute.
- **Logs and observability:** n/a.

## Documentation

- `docs/map.md` ("Routes and themes"): round bends, the radius token and when a corner stays mitred.
- `docs/roadmap.md`: this change.
- `README.md`: the map screenshots.
- Vault, after the merge: the project's `roadmap.md` and `changelog.md`.
