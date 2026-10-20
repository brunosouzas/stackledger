# Design: metro-map-engine

## Context

The [spike](../../../docs/spikes/2026-10-20-map-engine/README.md) built a 400-line prototype (`engine.ts`) that reads a hand-made JSON, routes hops with A* on an octilinear grid, bundles shared hops, places labels and writes SVG. This change rebuilds it on top of the delivered catalogue and views (`src/views.ts`, `src/graph.ts`), with tests. It follows [ADR 3](../../../docs/adr/0003-lines-are-journeys.md), [ADR 4](../../../docs/adr/0004-own-map-engine-with-stored-positions.md), [ADR 7](../../../docs/adr/0007-two-views-built-as-separate-sites.md) and [ADR 9](../../../docs/adr/0009-typescript-end-to-end.md).

## Goals / Non-goals

Goals: a stable, readable map of a real catalogue; a library the website reuses; output safe to embed in a page.

Non-goals: interactivity, raster formats, automatic global layout, writing to the catalogue.

## Decisions

### D1. Two steps: layout, then render

```mermaid
flowchart LR
    view["View (full or staff)"] --> model["buildMapModel()"]
    model --> layout["layoutMap()"]
    layout --> geometry["MapGeometry"]
    geometry --> svg["renderSvg(theme)"]
```

- `src/map/model.ts`: `buildMapModel(view, date)` picks stations, lines (stops reduced to served components), zones, positions and markers. It reads only the view, so hidden fields cannot reach the map.
- `src/map/layout.ts`: suggestions, routing, bundles, labels, zone hulls, legend. Output is plain data (`MapGeometry`): station points, hop polylines per line with offsets, label boxes, hull polygons, unrouted hops and suggestions.
- `src/map/svg.ts`: `renderSvg(geometry, theme)` writes the SVG text.

Tests assert on geometry (angles, collisions, positions) instead of parsing SVG; a smaller set checks the SVG itself (safety, determinism, theme). The website will use the geometry to add interactivity.

### D2. Grid and coordinates

One grid cell is 64 units; station `[c, r]` is drawn at `(PAD + 64c, TOP + 64r)`. Routing runs on the grid points of the bounding box of all stations plus two cells, which bounds A* and guarantees termination.

### D3. Routing

A* per hop over grid points, eight directions, cost = length + bend penalty (by turn angle) + penalty for reusing a grid edge used by another hop that does not connect the same stations + penalty for crossing another hop diagonally. Cells holding other stations are blocked. Hops are routed in a fixed order (lines by code then name, hops in stop order), and a hop shared by several lines is routed once (D4). The spike's direction-preference at stations, which keeps a line straight through a station, is kept.

### D4. Bundles

The key of a hop is the unordered pair of station references. Lines with the same key share the route and get parallel offsets around the centre line, ordered by code then name, with a canonical side so the order does not flip with direction. Bundle-crossing minimisation is not attempted (spike risk noted; fixed order is predictable).

### D5. Labels

Eight candidates around the station (right, left, above, below, then the diagonals), a box size from a fixed per-character width table, so layout does not depend on installed fonts. Station discs, label boxes and line segments are obstacles; each station is placed in reference order, picking the first candidate with zero overlap, else the least overlap. Text is wrapped at word boundaries to at most two lines of 18 characters, the rest cut with an ellipsis.

### D6. Suggested positions

As in the spec: mean of placed neighbours, nearest free cell by octile distance, ties by row then column, assigned in reference order. The suggestion lives only in the output; stackledger never writes it back.

### D7. Markers and the date

`buildMapModel` receives the map date (the command's `--date`, default local date). A renewal ring needs `renewsOn` and `status` in the view; in `staff` with defaults `renewsOn` is absent, so the code path cannot add a ring. A test compares staff SVGs across catalogues that differ only in hidden fields.

### D8. SVG safety

All catalogue text goes through one `escapeXml` function; attributes built only from validated values (colours match `#RRGGBB`, references match the name pattern). No `href` of any kind; interactivity comes later from the website's own script, which can use `data-ref`. Tests check the SVG with a small XML well-formedness check (no new dependency) plus a scan for forbidden tokens.

### D9. Command

`stackledger map` reuses the `mcp` command's folder checks and views. SVG to stdout, everything else to stderr, exit 0 even when the catalogue has errors (the map is a view, `validate` is the gate).

## Risks / Trade-offs

- **Label quality at crowded interchanges.** The fixed-candidate approach can still overlap when every candidate is taken; the fallback is least overlap. The owner can move stations.
- **Bundle order crossings.** A fixed order can make bundles cross at interchanges; accepted for predictability.
- **Text width estimate.** Without measuring fonts, boxes are approximate; a generous width table keeps overlaps rare.
