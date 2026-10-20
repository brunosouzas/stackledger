# Roadmap

The first version (v1) is split into OpenSpec changes, delivered in this order. Each change is one pull request. Later changes are refined when they start, so their wording here is a plan, not a spec. The decisions behind the plan are in the [ADRs](adr/README.md).

## v1

| # | Change | Delivers | Status |
|---|---|---|---|
| 1 | `catalogue-model` | The catalogue format and `stackledger validate`: components and licence resources in the Backstage subset, lines (journeys), the map layout, loading from a local folder, and errors that name the file, line and field ([ADR 2](adr/0002-catalogue-in-backstage-format-in-its-own-repository.md)) | Delivered ([#1](https://github.com/brunosouzas/stackledger/pull/1) spec, [#3](https://github.com/brunosouzas/stackledger/pull/3) code); spec in `openspec/specs/catalogue/` and `openspec/specs/validate-command/` |
| 2 | `mcp-server` | A read-only MCP server over stdio: find an item, what depends on it, what breaks if it is removed, renewals in the next N days, gaps (no relation, no journey, unused licences), and `validate`; the `full` and `staff` views with a `Settings` document; an agent skill for maintaining a catalogue ([ADR 8](adr/0008-read-only-mcp-early-no-ai-in-the-core.md)) | Planned |
| 3 | `metro-map-engine` | The map as SVG: stored station positions, octilinear routing that never runs through a station a line does not stop at, parallel bundles, labels that avoid collisions, zones, light and dark themes, and a position suggestion for a new station ([ADR 3](adr/0003-lines-are-journeys.md), [ADR 4](adr/0004-own-map-engine-with-stored-positions.md)) | Planned |
| 4 | `catalogue-site` | `stackledger build`: a static Astro site with the map (zoom, zone filter, line highlight), the software list, one page per item (licence, owner, journeys, a Mermaid diagram of dependencies and dependants, removal impact); the `full` and `staff` views as separate sites, with the hidden fields set in `stackledger.yaml`; a strict Content Security Policy, no third-party requests, no analytics, `noindex` ([ADR 5](adr/0005-static-site-no-server.md), [ADR 7](adr/0007-two-views-built-as-separate-sites.md)) | Planned |
| 5 | `licence-reports` | Renewals, cost per month and year by zone and owner, and an ICS feed of renewal dates (in the `full` view only) | Planned |
| 6 | `mac-discovery` | `stackledger discover` (Homebrew, App Store, `/Applications`, launchd, mise; read-only, one snapshot file per machine) and `stackledger drift` (installed but undeclared, declared but missing). Discovery proposes relations it can infer; a person confirms them | Planned |
| 7 | `catalogue-git-source` | Building from a Git URL as well as a local folder, a sample pipeline for a separate catalogue repository, and the access recipes: Cloudflare Pages with Cloudflare Access per path, and a generic proxy ([ADR 6](adr/0006-authentication-at-an-identity-aware-proxy.md)) | Planned |

## Later

- Merge catalogues from several repositories (for example, one per team), like Backstage catalogue locations.
- A remote MCP server over HTTP, behind the identity-aware proxy, and an MCP tool that proposes edits.
- Edit from the website by opening a pull request on the catalogue repository.
- Live status of local services on the map.
- A timeline of the catalogue from its Git history.
- Fleet discovery for companies (osquery, Fleet), and Windows and Linux collectors.
- CycloneDX import and export.
- A Backstage plugin that shows the metro map inside Backstage.

## Out of scope

A server with a database, a multi-tenant hosted service, sign-in code inside stackledger, roles beyond `full` and `staff`, AI model calls inside the tool, hardware asset management (Snipe-IT covers it), measuring how much a licence is used, and payments.

## Background

- [Map engine spike, 2026-10-20](spikes/2026-10-20-map-engine/README.md): why the engine is our own and why station positions are stored data.
