# Spike: map engine (2026-10-20)

Question: can an existing library draw a software catalogue as a readable metro map, or do we need our own engine?

## What was tried

| Option | Result |
|---|---|
| [nf-metro](https://github.com/seqeralabs/nf-metro) (MIT, Python) | Renders, but it merges unrelated stations into one false interchange. It is built for left-to-right pipelines, not for networks where lines cross |
| [LOOM](https://github.com/ad-freiburg/loom) `loom` + `octi` (GPL-3, C++) | The first layout is good and takes 0.4 s. Building it takes about 20 minutes. After a small change (one station removed, one line added), only 1 of 18 stations kept its relative position. Seeding `octi` with the previous layout made it worse |
| Our own engine (`engine.ts`, about 400 lines) | Station positions are data. Each hop is routed by A* on an octilinear grid that never passes through a station the line does not stop at and penalises bends, X-crossings and turns inside a station. Lines sharing a grid edge run in parallel in a fixed order. Labels pick the candidate position with the fewest collisions |

## Findings

- **Layout stability matters more than an optimal layout.** People learn where things are on a map. A map regenerated every week must not reshuffle, so station positions are stored in the catalogue and the engine only routes lines between them.
- **Lines must be journeys.** Lines made from categories (all security tools, all developer tools) have no meaningful order and broke every engine tried. Categories become zones and filters.
- **Speed is not a concern.** Our engine draws 80 stations and 12 lines in 0.3 s.
- **Open risks for the real engine:** suggesting a good position for a new station (with random positions, lines take long detours, as `stress-80.png` shows), ordering lines inside a bundle to reduce crossings, and labels at crowded interchanges.

## Files

- `engine.ts`: the prototype. Run with Node 23 or later: `node engine.ts demo.json light > map.svg` (`dark` for the dark theme).
- `demo.json`: a fictitious company's catalogue, already reduced to stations, lines and zones.
- `stress.py`: random stations and lines for a load test: `python3 stress.py 80 12 > stress.json`.
- `demo-light.png`, `demo-dark.png`, `stress-80.png`: outputs.

The prototype is throwaway code. The `metro-map-engine` change rebuilds it with tests.
