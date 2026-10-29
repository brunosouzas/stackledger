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
| 9 | `design-system-identity` | The map, the page diagrams and the site drawn with [`@brunosouzas/design-system`](https://www.npmjs.com/package/@brunosouzas/design-system), the identity of brunosouzas.com: its tokens for both themes, its pieces for stations, interchanges (capsules on the map, the line strip and the legend), lines, badges, rule counts and diagram boxes and arrows, its `ledgerMark` as the favicon and header mark, and the ink frame on cards and buttons; a theme with its own ink is refused | Delivered ([#29](https://github.com/brunosouzas/stackledger/pull/29), AB#164); released in 0.5.0 |
| 10 | `home-banner` | The home's banner from the design system's banner format (a short metro on navy, badges without letters), an optional `icon` on each home link (`github`, `website`, `linkedin`, `email`) and the dark-surface mark in the dark header | Delivered ([#31](https://github.com/brunosouzas/stackledger/pull/31), AB#168); released in 0.5.0 |
| 10a | `design-system-pieces` | Renewal ring, suggested halo, licence marker (now green), zones and the placeholder subtitle drawn by the design system's pieces; interface icons on the zoom, calendar and theme buttons | Delivered ([#32](https://github.com/brunosouzas/stackledger/pull/32), AB#169); released in 0.5.0 |
| 11 | `round-bends` | Round corners on the metro maps: concentric arcs per bundle (radius `map.bendRadius`), mitred at stations, splits and wide bundles | Delivered ([#30](https://github.com/brunosouzas/stackledger/pull/30), AB#166); released in 0.5.0 |
| 12 | `map-scale` | A map page never shows a map larger than drawn (one map unit per pixel, smaller only on a narrower page), in a frame as wide as the map, so the software and skills maps show the same line thickness; `@brunosouzas/design-system` 0.4.0 (no visible change) | Delivered ([#37](https://github.com/brunosouzas/stackledger/pull/37), AB#178; [#36](https://github.com/brunosouzas/stackledger/pull/36), AB#177); released in 0.5.1 |
| 13 | `release-on-merge` | A version reaches npm when the pull request that changes `version` in `package.json` is merged and the owner approves the publishing job; the workflow creates the tag and the GitHub release ([release guide](release.md)) | Delivered ([#33](https://github.com/brunosouzas/stackledger/pull/33), AB#172); first used for 0.5.0 |
| 14 | `how-it-works-diagram` | The diagram of [How it works](how-it-works.md) drawn by the design system from `scripts/how-it-works.json`, which follows the page's Mermaid block, instead of a hand-written Python script | Delivered ([#41](https://github.com/brunosouzas/stackledger/pull/41), AB#181); documentation only, not in the package |

## v2: agent skills

The skills, agents, playbooks and rules that AI coding agents use, as a second ledger next to the software ([ADR 10](adr/0010-agent-skills-are-a-second-ledger-read-from-their-folders.md)). Every change works for a person with no skills repository (local only), a person with one, and a team on any Git host and CI.

| # | Change | Delivers | Status |
|---|---|---|---|
| 1 | `skills-source` | Reading skill folders (the [Agent Skills](https://agentskills.io/specification) format), agent files, playbooks and rules files from one or more folders, with relations declared in each skill; `stackledger skills validate` for a person or a pipeline | Delivered ([#13](https://github.com/brunosouzas/stackledger/pull/13)); spec in `openspec/specs/skill-source/` and `openspec/specs/skills-validate-command/` |
| 2 | `skills-ignore` | A `.stackledgerignore` file in the skills folder, with `.gitignore` patterns, so templates, examples and test fixtures that look like skills are not read as skills | Delivered ([#14](https://github.com/brunosouzas/stackledger/pull/14)) |
| 3 | `skills-mermaid` | `stackledger skills map`: one Markdown page per skill, playbook and agent with a Mermaid diagram of who brings it in and what it brings in, written into the skills repository for offline reading and pull-request diffs | Delivered ([#15](https://github.com/brunosouzas/stackledger/pull/15)) |
| 4 | `skills-site` | The Skills section of `stackledger build`: the skills map (`Line` and `MapLayout` with skill stops), one page per skill with its diagram, the rules index, agents and playbooks; the map engine's title, legend and station symbols become data; playbooks as overlapping zones; the header split into Software and Skills divisions | Delivered ([#19](https://github.com/brunosouzas/stackledger/pull/19)), released as 0.3.0 |
| 4a | `station-labels-and-rules` | Whole station names on both maps: long names wrap into more rows instead of being cut; the number of rules of a skill or playbook on its station, explained in the legend (AB#135, AB#136) | Delivered ([#23](https://github.com/brunosouzas/stackledger/pull/23)), released as 0.4.0 |
| 5 | `skills-drift` | `stackledger skills drift`, on the person's machine only: what each tool (Claude Code, Codex, Copilot, Cursor, Hermes…) has installed compared with the source, or with each other when there is no source | Planned |
| 6 | `skills-software-links` | Skills that declare the software they need: links both ways between skill and software pages, and what breaks when software is removed | Planned |
| 7 | `local-preview` | `stackledger preview`, serving a build on `127.0.0.1` only, and a "use it locally" guide | Planned |
| 8 | `pipeline-recipes` | The three steps any CI runs (fetch the repositories, `validate`, `build`) and examples for GitLab CI, Jenkins and Azure Pipelines next to the GitHub Actions template | Planned |

## Later

- `site-home` (AB#137, delivered in [#25](https://github.com/brunosouzas/stackledger/pull/25), released as 0.4.0): the site title `stackledger` opens a home page at `/` with a banner, the division cards and links set in `Settings`; the software map moves to `/map/`.
- `map-backgrounds` (AB#134, delivered in [#39](https://github.com/brunosouzas/stackledger/pull/39), released as 0.6.0): a city backdrop behind the software map, `neutral` (the default, byte for byte the 0.5.1 map) or `london` (the Thames, docks, lakes and large parks of central London from OpenStreetMap data, simplified and attributed, in the `backdrop` colours of `@brunosouzas/design-system` 0.5.3), chosen with `spec.map.backdrop` or `stackledger map --backdrop`; the skills map stays flat. `sao-paulo` later. Never drawn from official metro maps, which are copyrighted.
- `launchd-script` (AB#223, delivered in [#42](https://github.com/brunosouzas/stackledger/pull/42), released as 0.7.0): `discover` keeps the script an interpreter launchd job runs (an existing file only, checked by sandboxed `test -f`), and `drift` shows `runs <program> [<script>]`.
- `app-helpers` (AB#222, delivered in [#44](https://github.com/brunosouzas/stackledger/pull/44), released as 0.7.0): `discover` reads the login items, agents and daemons apps declare inside their bundles (scopes `app-agent`, `app-daemon`, `app-login-item`; what an app can run, not whether it is enabled), and `drift` suggests the app's component.

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
