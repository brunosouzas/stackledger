## Context

`parallelLines` (`src/map/parallel.ts`) turns each line's grid path into offset edges (`OffsetEdge`: `a`, `b`, `offset`, `normal`, `gridA`, `gridB`) and joins consecutive edges with `joint()`: nothing on a straight run, a 45-degree connector where the slot changes, the intersection of the two offset lines at a 45- or 90-degree bend (the mitre), and a diagonal plus the remaining axis for a sharper turn, which only happens at stations. The result is `Stroke.points`, a polyline. The layout uses it for label obstacles (`layout.ts`, one rectangle per segment as wide as the casing) and the map extent; `svg.ts` writes it as `M … L …` through the `pipe` piece.

`OffsetEdge.offset` and `normal` belong to the undirected grid edge (`normal` is the left normal of the edge's canonical direction), not to the line's direction of travel: two lines crossing the same bend in opposite directions see opposite signs.

The spike (`~/.hermes/spikes/design-system/round-bends/spike.diff`) drew arcs in `svg.ts` only, for every 45- and 90-degree bend. In the Northwind example, 18 bends turn at a grid node, and 12 of them at a station.

## Decisions

All coordinates are map units (grid node `[x, y]` is at `[64x, 64y]`); SVG `y` grows downwards.

### 1. One centre per bundle bend

At a bend node `N`, take the line's direction of travel: incoming unit vector `u`, outgoing `v`, deflection `φ` (45 or 90 degrees), `cross = u.x·v.y − u.y·v.x`. The centre is `C = N + w · R / cos(φ/2)`, with `w` the unit vector of `v − u` (towards the inside of the turn) and `R = map.bendRadius`. `C` does not depend on the direction of travel: reversing it swaps `u` and `−v`, and `v − u` keeps its direction. Every line of the bundle turns around `C`.

For one line:

- **Signed radius** `r = R − s`, where `s` is the line's offset towards the inside of the turn: `s = (offset · normal) · n`, with `offset · normal` the line's displacement from the bundle's centre line on the incoming edge (the same vector whichever way the edge is stored) and `n` the unit normal of the incoming edge that points to the inside of the turn (the side of `C`). Lines on the outside get a larger radius, lines on the inside a smaller one, and the gap between neighbours stays what it is today: `layoutMap` passes `lineWidth + casing / 2` to `parallelLines`, which adds 1.5, so 16.5 with the current tokens.
- **Tangent points** `T1 = M − u · t` and `T2 = M + v · t`, where `M` is the line's mitre point (the intersection of its two offset lines, the vertex of `points` today) and the setback is `t = r · tan(φ/2)`. They are also the projections of `C` on the two offset lines. Example: a clockwise 90-degree turn at `(0, 0)` from `u = (1, 0)` to `v = (0, 1)` has `C = (−32, 32)`; a line offset `s` towards the inside has `M = (−s, s)`, `r = 32 − s`, `T1 = (−32, s)` and `T2 = (−s, 32)`. For the centre line, `t` is 32 at 90 degrees and about 13.2548 at 45 degrees.
- **Arc** `A r,r 0 0 sweep T2`, with `sweep = 1` when `cross > 0` (clockwise on screen) and `0` otherwise; large-arc is always 0, since the arc spans the deflection, at most 90 degrees.

Rejected: a quadratic curve (`Q`) with the mitre as control point, as the banner draws. It is not concentric for offset lines, so a bundle's gap changes through the curve. Rejected: one radius per line, measured as a distance: a distance is never negative, so it hides a line that crossed the centre (see §2).

### 2. Which bends turn round

Three steps, each over all bends at once, so the result does not depend on the order of lines or bends:

1. **Candidates.** A bend at `N` between grid edges `E1` and `E2` is a candidate when `N` is not a station position; `E1` and `E2` hold the same lines and each of them runs from one to the other at `N` (so a middle line going straight on, or a line joining or leaving, makes it no candidate); and every line's signed radius is at least half its outer width, `(lineWidth + casing) / 2` = 9. With `R` 32 and a gap of 16.5, bundles of up to three lines pass (inner offset 16.5, radius 15.5); a four-line bundle has an inner offset of 24.75 and a radius of 7.25, so it stays mitred, and so does any wider one.
2. **Room.** For each line at each candidate, its setback, measured from its mitre point `M`, must fit on the two straight segments of its mitred polyline (`points`) that meet at `M`. A segment's budget for one end is half its length when its other end is also a candidate, and its whole length otherwise (a mitre, a slot-change connector or the line's end take no length from it).
3. **Eligible.** A candidate is eligible when every line of its bundle has room. Eligible bends turn round; the others keep the mitre for every line of the bundle. A candidate that loses at step 3 does not give its half back to its neighbours: budgets come from step 1 only.

Rejected: removing conflicts one at a time until nothing changes. With a chain A–B–C, the result depends on which conflict goes first.

### 3. Where the arc lives

`Stroke` gains `path: PathPart[]`, the drawn line: straight parts (`{ to }`) and arcs (`{ to, radius, sweep }`), starting at `points[0]`. `points` stays the polyline with mitres, unchanged, for the code that reads ends and directions (`badges.ts`, the map extent) and for the routing and slot tests. `svg.ts` writes `path` as `M … L … A r,r 0 0 sweep x,y …` through `number()` of `src/map/xml.ts`, which throws on a non-finite value, so a bad arc never reaches a page. The `pipe` piece checks only the characters of `d` (its pattern allows `A`); the map's writer escapes `d` as text and has no path grammar of its own.

### 4. Labels avoid the arcs

The layout builds line obstacles from `path`: straight parts as today, and each arc as chords of at most 15 degrees. A chord cuts inside the arc by its sagitta, `r · (1 − cos(7.5°))` at most, so each chord rectangle is as wide as the casing plus twice that sagitta, and is lengthened by half the casing width at each end, so that consecutive chords, and a chord and the straight part next to it, overlap at their joint. The painted curve, outer edge and joints included, stays inside the rectangles. These obstacles feed label placement and terminal badge placement (`placeBadges`), as the segments do today. Whether any label of the example moves is not known yet: the spike kept the mitre obstacles. "Example map" answers it; "Label clears a round bend" and "Label clears the outside of a curve" cover the two sides of a curve.

### 5. Radius from the design system

`R` is the token `map.bendRadius`, read in `themes.ts` as `theme.bendRadius` and checked with the other ink fields ("Theme ink comes from the design system"): the layout and the renderer must use the same radius. A theme with another radius is refused, naming `bendRadius`. stackledger does not copy the value: until the design system publishes the token, the code waits (gate 1 is passed with the spec only).

### 6. Example map

"Software map unchanged" keeps station marker centres equal to the 0.2.0 fixtures, and line paths equal to them once each arc is read back to its corner: the arc's two tangent points lie on the fixture's two segments, and nothing else differs. Labels and terminal badges are expected at their 0.2.0 positions in the example. In other catalogues the requirement lets them move because of round bends: directly, when an arc's obstacle covers a candidate, or in turn, when a label or badge an arc moved now covers another's candidate. The pull request names any that moves in the example.

## Risks

- **Many arcs.** Drawing cost is one `A` command per line per bend. The 200-station performance test ("Large catalogue") must stay under its limit; it runs in the task list.
- **Labels may move in other catalogues** because arcs change the obstacles near curves. That is the purpose of decision 4; stations never move.
- **Far coordinates.** Arcs are computed from the same finite offsets as today; "Far-away typo" and "Far station drawn by the piece" run unchanged.

## Test changes

| Test | File | Change |
| --- | --- | --- |
| Bundle keeps its sides through a bend: bends are mitred | `test/unit/map-layout.test.ts` | renamed "Bundle keeps its sides through a bend"; the bend in it is not a station, so it now expects concentric arcs in `path`; `points` still has three points |
| Angles | `test/unit/map-layout.test.ts` | also reads `path`: straight parts octilinear, the rest arcs |
| Example map | `test/unit/map-svg.test.ts` | line paths compared as in decision 6 |
| SVG heroes are generated by stackledger map at the documented date | `test/integration/map-example.test.ts` | not edited; `docs/images/map-*.svg` regenerated |
