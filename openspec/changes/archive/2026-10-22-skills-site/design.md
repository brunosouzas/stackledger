## Context

`readSkillSet` (src/skills/source.ts) returns skills, playbooks, agents, rules, problems and ignored entries; `buildGraph`, `incoming`, `outgoing` and `reachedThrough` (src/skills/graph.ts) give the declared relations that `skills map` draws, and `pageFileName` (src/skills/mermaid.ts) gives safe file names. The site is built from one plain `SiteData` per view (src/site/data.ts), rendered by the Astro project in `site/`, with conditional pages done through dynamic routes whose `getStaticPaths` returns nothing (`[reports].astro`). The map engine (src/map/) is fed a `MapModel` built from a catalogue view; its legend symbols, its title (`Software map`), its empty text and its station data come from software-only code (`model.ts`, `layout.ts`, `svg.ts`).

## Decisions

### 1. The skills map file is read with the catalogue's parser and schemas

`stackledger-skills.yaml` is parsed with `parseSource` (src/source.ts), so YAML errors, duplicate keys, positions, size and the secret rules (keys and values) behave exactly as in a catalogue file. Its documents are checked with the existing `lineSchema` and `layoutSchema` (src/schema.ts) and a small checker in a new `src/skills/lines.ts` that applies the catalogue's line and layout rules with skill references instead of component references. Reusing the catalogue validator directly was rejected: it resolves references against components, and bending it would touch the software path. The file is found by the walk (src/skills/walk.ts) at the top of each given folder, like `.stackledgerignore`, and its real path joins the inputs `skills map` refuses to overwrite. Problems join the set's problems, so `skills validate`, `skills map` and `build` report them alike, and no count is added.

References are `<kind>:<name>`, the name taken after the first `:` and compared by code point, because skill identity is the exact name (skill-source, "Name and description"); software references stay case-insensitive.

The catalogue reader (`loadFolder`, src/source.ts) skips files named exactly `stackledger-skills.yaml`. Without it, a skills folder that is or holds the catalogue folder (one repository for both, or `--skills .`) would make the catalogue read skill lines as software lines and, if the file sorts first, take the skills `MapLayout` as the software one. Refusing overlapping folders instead was rejected: one repository with `catalog/` and skills at its top is a reasonable team layout.

The map file is found once per device and inode, like skill folders, so a link to it from a second given folder does not give duplicate-line errors.

### 2. The engine draws a second kind of map from a generic model

`MapModel` gets a `kind` (`software` or `skills`) and carries the title, the empty text and the legend symbols as data; `layout.ts` and `svg.ts` read them instead of deciding from the view. `MapStation` keeps its shape apart from zones (§2b): on a skills map `licence` is `none` and `renewal` and `deprecated` are false, so routing, labels and rendering are untouched. Its `ref` is `skill:<file>`, `playbook:<file>` or `agent:<file>` with the `skills map` page file name: raw names could hold characters XML replaces with U+FFFD, so two names could share one `data-ref`; file names are ASCII and unique per kind (the build refuses a collision), and the browser maps them to URLs without reimplementing the encoding. The station's `title` and label carry the name, cleaned of control and format characters. A new `buildSkillsMapModel(set)` (src/skills/metro.ts) produces it from the set's lines and layout. The software model keeps every byte: before touching the engine, the example's SVGs in both views and themes are recorded as test fixtures (metro-map, "Software map unchanged"), and the site's map SVGs are covered by the existing site tests.

### 2b. Playbook zones

`MapStation.zone` (one name) becomes `zones` (a list); a software station has at most one, so software output keeps its bytes. `zoneGeometry` selects members with `station.zones.includes(...)`. For skills, `buildSkillsMapModel` computes the members from the graph's direct `loads` and `uses` edges of each declared zone's playbook, plus the playbook itself; transitive members were rejected, because a playbook that loads another would swallow its whole zone. `data-zone` holds the playbooks' page file names (ASCII, no spaces), space-separated in declaration order; on the skills map page the zone filter splits `data-zone` on spaces and tests membership. The software map page keeps comparing the whole value, because a software zone name may hold spaces (`Team tools`); the page tells the script which rule applies (an attribute on the map frame), so software `data-zone` bytes and behaviour do not change. Zone titles on skills maps: placed after the station labels by the same candidate search (`labels.ts`), next to the zone's playbook station, so overlapping zones never show a title over the wrong area (seen in the spike of 2026-10-22: a corner title of `review` sat on `release`'s area, and a title placed without the search was cut by a line). A zone whose playbook is not drawn keeps the corner title, moved up while it overlaps an earlier one. The software map keeps its corner titles and bytes.

### 3. One skills data object, copied into both views

`buildSkillsData(set)` (src/site/skills-data.ts) turns the set, its graph and its map model into plain page data once per build: list rows, item pages (relations, reached-through, lines, rules, source paths below the given folder), rule rows, the map SVGs in both themes, the line chips and the symbols. The same object goes into `SiteData.skills` of every view, which is why the Skills pages' `main` is identical in `full` and `staff`. Nothing in it comes from the catalogue view, so the staff guarantees (catalogue-views) are untouched. `src/site/` imports `src/skills/`; catalogue code (`src/validate.ts`, `src/views.ts`, `src/graph.ts`) still does not.

Paths: a source file is shown as its path below its given folder; the given folder's own path is never in the data, so the output does not depend on where the folders are (build-command, "Deterministic build") and no page shows `/home/...`. Text from a file (a description mentioning `/usr/local/bin`) is shown as written, so the build's leak scan is not extended to the catalogue or skills paths: it would fail honest builds; the unit tests of the page data check the computed paths instead.

### 4. Pages and routes

New Astro routes: one dynamic route each for the list, the skills map and the rules index (as `[reports].astro`), and `skills/[file].astro`, `playbooks/[file].astro`, `agents/[file].astro`. Each returns no path when `site.skills` is absent, so a build without skills has no such page (as `[reports].astro` does for staff). Section pages live at top level and item pages under kind folders, so no item name can collide with a section page, and `pageFileName` keeps every URL lowercase ASCII. The list and rules pages reuse the software list's search and filter script on their own tables; the map page reuses `site/src/scripts/map.ts`, with the zone filter when zones are drawn, in list mode (§2b). Station and box links: `links.ts` today derives URLs from `component:`/`resource:`/`line:` refs; it gains `skill:`, `playbook:` and `agent:`, whose value is already the page file name, so the URL is the kind folder plus that name.

### 5. The relation diagram

A new renderer `src/map/relations.ts` follows `neighbourhood.ts`: three columns in a 1,200-unit drawing, ink stickers from `ink.ts`, `tag` and `escapeXml` from `xml.ts`. Box shapes: skill a `rect` with a small radius, playbook a pill (`rx` half the height), agent a six-point `polygon`, matching the Mermaid map's shapes. Each side box carries a second text line with the relation kind. Over 100 boxes on a side, no diagram (the lists hold everything); 100 keeps the tallest drawing readable when scaled to the page width.

### 6. Where the folders come from and how a wrong one fails

`--skills` (repeatable, `parseArgs` `multiple: true`) replaces `spec.skills.folders`; configured paths are resolved from the catalogue folder because the build argument is the one stable root a pipeline and a laptop share, and absolute paths, `~` and drive letters are refused by `validate` so a catalogue repository stays portable. Unlike the title and colours, the folders are not dropped silently when the Settings has an error: that would publish a site without its Skills section with exit 0. A broken Settings whose parsed documents have a `spec.skills` key anywhere is exit 1; without that key the build is as today; a Settings-like file that cannot be parsed (`settingsUnread`) gives no skill set and a report line. Using the valid half of a broken Settings was tried in the spec review and rejected: a Settings with a field error is never served, so "its" `spec.skills` had no defined source.

Order: options; catalogue folder; folders in use (usage errors, exit 2); read the set; output folder checks, now also against every real path the set recorded, skill folders and top-level `agents/` (the same list `skills map` uses; elsewhere inside a skills folder is allowed), so publication can never rename or remove a source reached through a link; then a broken Settings with `spec.skills`, "nothing found" and page-name collisions (exit 1), all before staging is created, so the earlier build stays. The output refusal reuses `within` from src/site/paths.ts.

Compatibility: `spec.skills` is a new `Settings` field; stackledger 0.2.0 reads it as an error (strict schema). Documented in `docs/catalogue-format.md`; pipelines and laptops should pin one version.

### 7. Report and build time

The report lines are added between the catalogue map's notes and the site lines (build-command, "Build report"). The skills map's suggestion and unrouted lines reuse `mapNotes`' format with the skills map named, but print the map-file key `<kind>:<name>` (what the person pastes), with control characters removed, not the station's file-name reference. Build time: the skills pages roughly double the page count of a large build, so the budget is 150 seconds for the generated catalogue plus the generated skill set, measured in a new timing test (`test/perf/build-skills.perf.test.ts`, run alone by `npm run test:perf`); today's 90-second catalogue test stays in `test/integration/build.test.ts`.

## Risks / Trade-offs

- [The engine refactor changes software output] → recorded SVG fixtures from 0.2.0 fail the test on any byte change.
- [A large rules index page] → the owner's kit has 341 rules: one table with a client-side filter, no pagination; 2,000 rules are in the timing test.
- [Two files describe the skills: `SKILL.md` and the map file] → the map file holds only what a skill folder cannot say (lines and positions), as ADR 10 decided; `skills validate` checks its references, so a renamed skill fails CI.
