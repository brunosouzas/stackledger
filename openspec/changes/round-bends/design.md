## Context

`parallelLines` (`src/map/parallel.ts`) turns each line's grid path into offset edges (`OffsetEdge`: `a`, `b`, `offset`, `normal`, `gridA`, `gridB`) and joins consecutive edges with `joint()`: nothing on a straight run, a 45-degree connector where the slot changes, the intersection of the two offset lines at a 45- or 90-degree bend (the mitre), and a diagonal plus the remaining axis for a sharper turn, which only happens at stations. The result is `Stroke.points`, a polyline. The layout uses it for label obstacles (`layout.ts`, one rectangle per segment as wide as the casing) and the map extent; `svg.ts` writes it as `M … L …` through the `pipe` piece.

The spike (`~/.hermes/spikes/design-system/round-bends/spike.diff`) drew arcs in `svg.ts` only, for every 45- and 90-degree bend. In the Northwind example, 18 bends turn at a grid node, and 12 of them at a station.

## Decisions

### 1. One centre per bundle bend

At a bend node `N` with incoming direction `u` and outgoing `v` (unit vectors, deflection `φ` of 45 or 90 degrees), the centre is `C = N + w · R / cos(φ/2)`, where `w` is the unit vector of `v − u` (towards the inside of the turn) and `R` is `map.bendRadius`. Each line of the bundle turns around `C`: its tangent points are the feet of the perpendiculars from `C` on its two offset lines, and its radius is the distance from `C` to them. Lines on the outside of the turn get a larger radius, lines on the inside a smaller one, and the gap between neighbours stays `lineWidth + 1.5`. This is why a fixed radius per line would not do: the bundle would pinch in the curve.

Rejected: a quadratic curve (`Q`) with the mitre as control point, as the banner draws. It is not concentric for offset lines, so a bundle's gap changes through the curve.

### 2. Corners that stay mitred

A bend keeps today's joint when:

1. `N` is the position of a station. The line must pass through the centre of the stop it serves, and the marker covers the corner. With an arc of radius 32, a 90-degree turn would pass about 13 units from the centre.
2. The line's incoming and outgoing offsets differ (the bundle splits or merges at `N`): the two tangent distances from `C` differ, so no circle joins them.
3. The arc does not fit: a tangent point falls before the start of the incoming offset edge's straight part or after the end of the outgoing one. The straight part of an edge is what is left after the arcs at its two ends; when the arcs at both ends of one edge would overlap, both bends on that edge stay mitred.
4. The turn is sharper than 90 degrees (only at stations; already case 1).

The decision is per bend of a bundle: the lines that share both the incoming and the outgoing edge at `N` either all get arcs or all keep the mitre, so the bundle never mixes the two. Rule 3 is applied until nothing changes, so the result does not depend on line order.

### 3. Where the arc lives

`Stroke` gains `path: PathPart[]`, the drawn line: straight parts (`{ to }`) and arcs (`{ to, radius, sweep }`), starting at `points[0]`. `points` stays the polyline with mitres, unchanged, for the code that reads ends and directions (`badges.ts`, the map extent) and for the tests of routing and slots. `svg.ts` writes `path` as `M … L … A r,r 0 0 sweep x,y …`; the `pipe` piece and the map's path check already accept `A`.

### 4. Labels avoid the arcs

The layout builds line obstacles from `path`: straight parts as today, and each arc as chords of at most 15 degrees, each a rectangle as wide as the casing. With a radius up to about 60, a 15-degree chord strays at most 0.5 units from the arc, under the 9-unit half-width of the obstacle. Whether any label of the example moves is not known yet: the spike kept the mitre obstacles. "Example map" answers it, and the scenario "Label clears a round bend" covers a label that would touch the inside of a curve.

### 5. Radius from the design system

`R` is the token `map.bendRadius`, read in `themes.ts` as `theme.bendRadius` and checked with the other ink fields ("Theme ink comes from the design system"): the layout and the renderer must use the same radius. A theme with another radius is refused, naming `bendRadius`. stackledger does not copy the value: until the design system publishes the token, the code waits (gate 1 is passed with the spec only).

### 6. Example map

"Software map unchanged" keeps station marker centres and label positions equal to the 0.2.0 fixtures. Line paths equal the fixtures except at bends away from stations; the test checks that each line path, read as points, equals the fixture's polyline with each arc replaced by its mitre corner: the arc's two tangent points lie on the fixture's two segments, and nothing else differs.

## Risks

- **A catalogue with stations in long straight runs and many bends between them** gets many arcs; drawing cost is one `A` command each. The 200-station performance test ("Large catalogue") must stay under its limit; it runs in the task list.
- **Labels may move in other catalogues** because arcs change the obstacles near curves. That is the purpose of decision 4; positions of stations never move.

## Test changes

| Test | File | Change |
| --- | --- | --- |
| Bundle keeps its sides through a bend: bends are mitred | `test/unit/map-layout.test.ts` | renamed "Bundle keeps its sides through a bend"; the bend in it is not a station, so it now expects concentric arcs; `points` still has three points |
| Example map | `test/unit/map-svg.test.ts` | line paths compared as in decision 6 |
| SVG heroes are generated by stackledger map at the documented date | `test/integration/map-example.test.ts` | not edited; `docs/images/map-*.svg` regenerated |
