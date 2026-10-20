# 4. Our own map engine, with station positions stored in the catalogue

- Status: Accepted
- Date: 2026-10-20

## Context

People learn a map: where a station is becomes part of how they think about the system. A catalogue changes every week, so the map is redrawn every week. We tested existing engines in the [map-engine spike](../spikes/2026-10-20-map-engine/README.md).

## Options considered

1. [nf-metro](https://github.com/seqeralabs/nf-metro) (MIT, Python): built for left-to-right pipelines; it drew unrelated stations as one false interchange.
2. [LOOM](https://github.com/ad-freiburg/loom) (GPL-3, C++): a good first layout, but after one small change 17 of 18 stations moved, and seeding it with the previous layout made it worse. It also takes about 20 minutes to build.
3. Our own engine in TypeScript: station positions are data in the catalogue (`MapLayout`), and the engine only routes lines between them.

## Decision

Option 3. Positions are stored; the engine routes each hop on an octilinear grid (A*), never through a station the line does not stop at, bundles lines that share a track, places labels away from collisions, and suggests a position for a new station.

## Consequences

- The map is stable by construction: adding a line never moves existing stations.
- Someone places new stations, helped by the suggestion. Placing them well is the main open risk of the engine.
- No GPL code and no native build in the tool.
- The prototype draws 80 stations and 12 lines in 0.3 s, so speed is not a concern.
