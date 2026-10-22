## Context

`readSkillSet` (src/skills/source.ts) returns skills, playbooks, agents, rules, problems and ignored entries; `buildGraph`, `incoming`, `outgoing` and `reachedThrough` (src/skills/graph.ts) give the declared relations that `skills map` draws, and `pageFileName` (src/skills/mermaid.ts) gives safe file names. The site is built from one plain `SiteData` per view (src/site/data.ts), rendered by the Astro project in `site/`, with conditional pages done through dynamic routes whose `getStaticPaths` returns nothing (`[reports].astro`). The map engine (src/map/) is fed a `MapModel` built from a catalogue view; its legend symbols, its title (`Software map`), its empty text and its station data come from software-only code (`model.ts`, `layout.ts`, `svg.ts`).

## Decisions

### 1. The skills map file is read with the catalogue's parser and schemas

`stackledger-skills.yaml` is parsed with `parseSource` (src/source.ts), so YAML errors, duplicate keys, positions, size and the secret rules (keys and values) behave exactly as in a catalogue file. Its documents are checked with the existing `lineSchema` and `layoutSchema` (src/schema.ts) and a small checker in a new `src/skills/lines.ts` that applies the catalogue's line and layout rules with skill references instead of component references. Reusing the catalogue validator directly was rejected: it resolves references against components, and bending it would touch the software path. The file is found by the walk (src/skills/walk.ts) at the top of each given folder, like `.stackledgerignore`, and its real path joins the inputs `skills map` refuses to overwrite. Problems join the set's problems, so `skills validate`, `skills map` and `build` report them alike, and no count is added.

References are `<kind>:<name>`, the name taken after the first `:` and compared by code point, because skill identity is the exact name (skill-source, "Name and description"); software references stay case-insensitive.

### 2. The engine draws a second kind of map from a generic model

`MapModel` gets a `kind` (`software` or `skills`) and carries the title, the empty text and the legend symbols as data; `layout.ts` and `svg.ts` read them instead of deciding from the view. `MapStation` keeps its shape: on a skills map `licence` is `none`, `renewal` and `deprecated` are false and `zone` is undefined, so routing, labels and rendering are untouched. A new `buildSkillsMapModel(set)` (src/skills/metro.ts) produces it from the set's lines and layout. The software model keeps every byte: before touching the engine, the example's SVGs in both views and themes are recorded as test fixtures (metro-map, "Software map unchanged"), and the site's map SVGs are covered by the existing site tests.

### 3. One skills data object, copied into both views

`buildSkillsData(set)` (src/site/skills-data.ts) turns the set, its graph and its map model into plain page data once per build: list rows, item pages (relations, reached-through, lines, rules, source paths below the given folder), rule rows, the map SVGs in both themes, the line chips and the symbols. The same object goes into `SiteData.skills` of every view, which is why the Skills pages' `main` is identical in `full` and `staff`. Nothing in it comes from the catalogue view, so the staff guarantees (catalogue-views) are untouched. `src/site/` imports `src/skills/`; catalogue code (`src/validate.ts`, `src/views.ts`, `src/graph.ts`) still does not.

Paths: a source file is shown as its path below its given folder; the given folder's own path is never in the data, so the output does not depend on where the folders are (build-command, "Deterministic build") and no page shows `/home/...`. The build's existing leak scan (src/site/relative.ts `scan`) is given the absolute catalogue and skills folder paths too, so a regression fails the build before publication.

### 4. Pages and routes

New Astro routes: one dynamic route each for the list, the skills map and the rules index (as `[reports].astro`), and `skills/[file].astro`, `playbooks/[file].astro`, `agents/[file].astro`. Each returns no path when `site.skills` is absent, so a build without skills has no such page (as `[reports].astro` does for staff). Section pages live at top level and item pages under kind folders, so no item name can collide with a section page, and `pageFileName` keeps every URL lowercase ASCII. The list and rules pages reuse the software list's search and filter script on their own tables; the map page reuses `site/src/scripts/map.ts`, its zone filter simply absent. Station and box links: `links.ts` today derives URLs from `component:`/`resource:`/`line:` refs; skill names need `pageFileName`, which the browser should not reimplement, so each page renders its text-alternative links with a `data-ref` and the script resolves a diagram or station `data-ref` to the matching link's `href`.

### 5. The relation diagram

A new renderer `src/map/relations.ts` follows `neighbourhood.ts`: three columns in a 1,200-unit drawing, ink stickers from `ink.ts`, `tag` and `escapeXml` from `xml.ts`. Box shapes: skill a `rect` with a small radius, playbook a pill (`rx` half the height), agent a six-point `polygon`, matching the Mermaid map's shapes. Each side box carries a second text line with the relation kind. Over 100 boxes on a side, no diagram (the lists hold everything); 100 keeps the tallest drawing readable when scaled to the page width.

### 6. Where the folders come from and how a wrong one fails

`--skills` (repeatable, `parseArgs` `multiple: true`) replaces `spec.skills.folders`; configured paths are resolved from the catalogue folder because the build argument is the one stable root a pipeline and a laptop share, and absolute paths and `~` are refused by `validate` so a catalogue repository stays portable. A `Settings` with an error is not used for folders, as for the title and colours (`settingsInError`); the report says so. The folders are checked as usage errors before the output folder is touched, in the existing order (options, catalogue, skills folders, output folder). "Nothing found" is detected from the set's problems before staging is created, so the earlier build stays. The output folder refusal reuses `within` from src/site/paths.ts.

### 7. Report and build time

The report lines are added between the catalogue map's notes and the site lines (build-command, "Build report"). The skills map's suggestion and unrouted lines reuse `mapNotes`' format with the skills map named. Build time: the skills pages roughly double the page count of a large build, so the budget is 150 seconds for the generated catalogue plus the generated skill set, measured in the existing timing test file.

## Risks / Trade-offs

- [The engine refactor changes software output] → recorded SVG fixtures from 0.2.0 fail the test on any byte change.
- [A large rules index page] → the owner's kit has 341 rules: one table with a client-side filter, no pagination; 2,000 rules are in the timing test.
- [Two files describe the skills: `SKILL.md` and the map file] → the map file holds only what a skill folder cannot say (lines and positions), as ADR 10 decided; `skills validate` checks its references, so a renamed skill fails CI.
