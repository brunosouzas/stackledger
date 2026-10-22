# Roadmap

The first version (v1) is split into OpenSpec changes, delivered in this order. Each change is one pull request. Later changes are refined when they start, so their wording here is a plan, not a spec. The decisions behind the plan are in the [ADRs](adr/README.md).

## v1

| # | Change | Delivers | Status |
|---|---|---|---|
| 1 | `catalogue-model` | The catalogue format and `stackledger validate`: components and licence resources in the Backstage subset, lines (journeys), the map layout, loading from a local folder, and errors that name the file, line and field ([ADR 2](adr/0002-catalogue-in-backstage-format-in-its-own-repository.md)) | Delivered ([#1](https://github.com/brunosouzas/stackledger/pull/1) spec, [#3](https://github.com/brunosouzas/stackledger/pull/3) code); spec in `openspec/specs/catalogue/` and `openspec/specs/validate-command/` |
| 2 | `mcp-server` | A read-only MCP server over stdio: find an item, what depends on it, what breaks if it is removed, renewals in the next N days, gaps (no relation, no journey, unused licences), and `validate`; the `full` and `staff` views with a `Settings` document; an agent skill for maintaining a catalogue ([ADR 8](adr/0008-read-only-mcp-early-no-ai-in-the-core.md)) | Delivered ([#4](https://github.com/brunosouzas/stackledger/pull/4)) |
| 3 | `metro-map-engine` | The map as SVG: stored station positions, octilinear routing that never runs through a station a line does not stop at, parallel bundles, labels that avoid collisions, zones, light and dark themes, and a position suggestion for a new station ([ADR 3](adr/0003-lines-are-journeys.md), [ADR 4](adr/0004-own-map-engine-with-stored-positions.md)) | Delivered ([#5](https://github.com/brunosouzas/stackledger/pull/5)) |
| 4 | `catalogue-site` | `stackledger build`: a static Astro site with the map (zoom, zone filter, line highlight), the software list, one page per item (licence, owner, journeys, a diagram of dependencies and dependants, removal impact) and one page per journey; the dependency and journey diagrams are SVG drawn by stackledger's own code in the map's style, not Mermaid; the `full` and `staff` views as separate sites, with the hidden fields set in `stackledger.yaml`; a strict Content Security Policy, no third-party requests, no analytics, `noindex` ([ADR 5](adr/0005-static-site-no-server.md), [ADR 7](adr/0007-two-views-built-as-separate-sites.md)) | Delivered ([#6](https://github.com/brunosouzas/stackledger/pull/6)) |
| 5 | `licence-reports` | Renewals, recurring cost per month and per year for each currency (no conversion) by owner, payer and zone, one-off costs, planned purchases and incomplete licences; a Reports page and a `renewals.ics` calendar file to download in the `full` site only; and `stackledger report` (text, JSON, CSV, iCalendar) | Delivered ([#7](https://github.com/brunosouzas/stackledger/pull/7)) |
| 6 | `mac-discovery` | `stackledger discover` (Homebrew formulae and casks, App Store through `mas`, `/Applications` and `~/Applications`, launchd, mise, global npm packages and pipx; every program in the macOS sandbox with network and writes denied; one snapshot file per machine in `~/.stackledger/<machine>/`) and `stackledger drift` (installed but not declared, declared but missing, not checked), matched only through `stackledger/<source>` annotations; it proposes annotations and `dependsOn` relations a person confirms, and `--scaffold` writes draft component files outside the catalogue | Delivered ([#8](https://github.com/brunosouzas/stackledger/pull/8)); spec in `openspec/specs/mac-discovery/`, `discover-command/` and `drift-command/` |
| 7 | `catalogue-deployment` | Publishable npm package, owner-approved release workflow with provenance and SBOM, a catalogue repository pipeline template, and protected hosting recipes ([ADR 6](adr/0006-authentication-at-an-identity-aware-proxy.md)) | Delivered, released as 0.1.0 ([#9](https://github.com/brunosouzas/stackledger/pull/9)) |
| 8 | `map-theme-ink` | The map and the page diagrams in the illustrated style of brunosouzas.com: ink outline `#0A1033`, pipe lines with an ink casing, hard offset shadows (indigo with a light rim on dark), the tinted panel and navy backgrounds, and the Lato font shipped with the site; it replaces the look of the `light` and `dark` themes | Delivered ([#10](https://github.com/brunosouzas/stackledger/pull/10)) |

## v2: agent skills

The skills, agents, playbooks and rules that AI coding agents use, as a second ledger next to the software ([ADR 10](adr/0010-agent-skills-are-a-second-ledger-read-from-their-folders.md)). Every change works for a person with no skills repository (local only), a person with one, and a team on any Git host and CI.

| # | Change | Delivers | Status |
|---|---|---|---|
| 1 | `skills-source` | Reading skill folders (the [Agent Skills](https://agentskills.io/specification) format), agent files, playbooks and rules files from one or more folders, with relations declared in each skill; `stackledger skills validate` for a person or a pipeline | Delivered ([#13](https://github.com/brunosouzas/stackledger/pull/13)); spec in `openspec/specs/skill-source/` and `openspec/specs/skills-validate-command/` |
| 2 | `skills-ignore` | A `.stackledgerignore` file in the skills folder, with `.gitignore` patterns, so templates, examples and test fixtures that look like skills are not read as skills | Delivered ([#14](https://github.com/brunosouzas/stackledger/pull/14)) |
| 3 | `skills-mermaid` | `stackledger skills map`: one Markdown page per skill, playbook and agent with a Mermaid diagram of who brings it in and what it brings in, written into the skills repository for offline reading and pull-request diffs | Delivered ([#15](https://github.com/brunosouzas/stackledger/pull/15)) |
| 4 | `skills-site` | The Skills section of `stackledger build`: the skills map (`Line` and `MapLayout` with skill stops), one page per skill with its diagram, the rules index, agents and playbooks; the map engine's title, legend and station symbols become data; playbooks as overlapping zones; the header split into Software and Skills divisions | Implemented ([#19](https://github.com/brunosouzas/stackledger/pull/19)), not released |
| 5 | `skills-drift` | `stackledger skills drift`, on the person's machine only: what each tool (Claude Code, Codex, Copilot, Cursor, Hermes…) has installed compared with the source, or with each other when there is no source | Planned |
| 6 | `skills-software-links` | Skills that declare the software they need: links both ways between skill and software pages, and what breaks when software is removed | Planned |
| 7 | `local-preview` | `stackledger preview`, serving a build on `127.0.0.1` only, and a "use it locally" guide | Planned |
| 8 | `pipeline-recipes` | The three steps any CI runs (fetch the repositories, `validate`, `build`) and examples for GitLab CI, Jenkins and Azure Pipelines next to the GitHub Actions template | Planned |

## Later

- `map-backgrounds`: a city backdrop behind the map (`neutral`, `london`, `sao-paulo` to start), chosen in `Settings` or with `--background`. Drawn from OpenStreetMap data (rivers, coastline, parks), simplified and attributed, never from official metro maps, which are copyrighted. The map engine already draws an empty background layer for it.

- Icons and line badges drawn with the designer style of brunosouzas.com.

- Build from a Git URL as well as a local folder.
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
- [Mac discovery spike, 2026-10-21](spikes/2026-10-21-mac-discovery/README.md): what each source returns, what it costs, and why every program runs in the sandbox.
