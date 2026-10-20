# 3. Map lines are journeys; categories are zones

- Status: Accepted
- Date: 2026-10-20

## Context

The main view of stackledger is a metro map. A metro line has an order: stations follow each other. We had to decide what a line means for software.

## Options considered

1. A line per category (security tools, developer tools, communication).
2. A line per journey: an ordered path of software someone uses to get a job done, such as "ship a feature" or "send an invoice".

## Decision

Option 2. A line is a journey. Categories, scopes and teams become zones, drawn as shaded areas like fare zones, and filters.

## Consequences

- Interchanges mean something real: a tool on many journeys is critical.
- The [map-engine spike](../spikes/2026-10-20-map-engine/README.md) showed category lines have no meaningful order and broke every layout engine we tried.
- Software on no journey is listed in the catalogue and its pages, but not drawn on the map.
- Someone has to write the journeys. That is deliberate: a journey records knowledge a machine cannot discover.
