# Roadmap

The first version (v1) is split into OpenSpec changes, delivered in this order. Each change is one pull request. Later changes are refined when they start, so their wording here is a plan, not a spec.

## v1

| # | Change | Delivers |
|---|---|---|
| 1 | `catalogue-model` | The catalogue format and `stackledger validate`: components and licence resources in the Backstage subset, lines (journeys), the map layout, loading from a local folder, and errors that name the file and field |
| 2 | `metro-map-engine` | The map as SVG: stored station positions, octilinear routing that never runs through a station a line does not stop at, parallel bundles, labels that avoid collisions, zones, light and dark themes, and a position suggestion for a new station |
| 3 | `catalogue-site` | `stackledger build`: a static Astro site with the map (zoom, zone filter, line highlight), the software list, one page per item (licence, owner, journeys, a Mermaid diagram of dependencies and dependants, removal impact), and `--public`, which strips versions, costs and vault references |
| 4 | `licence-reports` | Renewals, cost per month and year by zone and owner, items with no owner, journey or relation, and an ICS feed of renewal dates |
| 5 | `mac-discovery` | `stackledger discover` (Homebrew, App Store, `/Applications`, launchd, mise; read-only, one snapshot file per machine) and `stackledger drift` (installed but undeclared, declared but missing). Discovery proposes relations it can infer; a person confirms them |
| 6 | `catalogue-git-source` | Building from a Git URL as well as a local folder, and a sample pipeline for a separate catalogue repository |
| 7 | `mcp-server` | A read-only MCP server over stdio: query items, drift, renewals, and what breaks if an item is removed |

Deployment recipe for v1: any static host. The documented default is Cloudflare Pages behind Cloudflare Access.

## Later

- Merge catalogues from several repositories (for example, one per team), like Backstage catalogue locations.
- Edit from the website by opening a pull request on the catalogue repository.
- Live status of local services on the map.
- A timeline of the catalogue from its Git history.
- Fleet discovery for companies (osquery, Fleet), and Windows and Linux collectors.
- CycloneDX import and export.
- A Backstage plugin that shows the metro map inside Backstage.

## Out of scope

A server with a database, a multi-tenant hosted service, hardware asset management (Snipe-IT covers it), measuring how much a licence is used, and payments.

## Background

- [Map engine spike, 2026-10-20](spikes/2026-10-20-map-engine/README.md): why the engine is our own and why station positions are stored data.
