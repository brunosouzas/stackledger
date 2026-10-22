## Why

`stackledger skills validate` and `stackledger skills map` give a person or a team the checks and an offline Markdown map of their agent skills, but nobody without the repository can see them, and the metro map, the picture that makes the software side readable, does not exist for skills. ADR 10 decided one site with a Software section and a Skills section. This change builds the Skills section, so the people who read the software site (behind the same login) also see which skills, playbooks and agents exist, how they bring each other in, and every rule reviewers cite.

## What Changes

- `stackledger build` reads an optional skill set, exactly as `skills validate` reads it (`.stackledgerignore` included), from the folders of a new `--skills <folder>` option (repeatable) or, without it, from a new `spec.skills.folders` list in the catalogue's `Settings` (`stackledger.yaml`), relative to the catalogue folder. The option replaces the list, so a laptop and a pipeline can check the repositories out in different places.
- With a skill set, every site built (`full`, and `staff` in the corporate mode) gets the same Skills section: `/skills/` (list with search and kind filter), `/skill-map/` (the skills metro map), `/rules/` (rules index), and one page per item at `/skills/<file>/`, `/playbooks/<file>/` and `/agents/<file>/`, with an SVG diagram of its declared relations drawn by stackledger in the map's style. The header gets a `Skills` link. Without a skill set the sites are as today.
- The skills metro map is written by hand in the skills repository, in a file `stackledger-skills.yaml` at the top of a given folder, with the catalogue's own kinds `Line` and `MapLayout`; only the references change: stops and stations are `skill:<name>`, `playbook:<name>` or `agent:<name>`. `stackledger skills validate` reads and checks this file, so a pipeline catches a broken map before any build.
- The map engine draws a skills map from those documents: same grid, stored positions, suggestions, routing, labels, themes and safe SVG, without licence markers, renewal rings or zones, with its own title and legend symbols. The software map's output does not change.
- The build report adds the skill set's counts, a hint to run `stackledger skills validate` when it has problems, and the skills map's suggested positions.
- A wrong skills path never publishes an empty Skills section: a missing folder is a usage error (exit 2) and a folder with nothing found is exit 1, both with nothing published changed. A skill set with other errors is still built, like a catalogue with errors.

## Capabilities

### New Capabilities

- `skills-site`: the Skills pages of the built sites (list, skills map page, item pages and their relation diagrams, rules index, text and path rules).

### Modified Capabilities

- `skill-source`: the skills map file (`stackledger-skills.yaml`): where it is read, its documents, skill references, problems.
- `metro-map`: a skills map next to the software map; station references; legend and title per map.
- `build-command`: `--skills`, the skill folders and their errors, the output folder rule, reads, report, determinism and build time.
- `catalogue`: `spec.skills.folders` in `Settings`.
- `catalogue-site`: the header's `Skills` link.
- `skills-map-command`: a scenario stating that the skills map file is an input the Markdown map folder must not hold.

## Out of scope

- A site with skills and no software catalogue: the catalogue folder stays required. An empty folder works today as a catalogue (checked: `validate` passes with 0 files), and `docs/skills.md` says so; a proper skills-only home page can come with `local-preview`.
- Zones on the skills map (decision 2).
- A page per skill line (the software site has journey pages); the skills map highlights a line, and item pages name the lines that stop at them.
- The body of `SKILL.md` on the site (decision 6).
- Links between skills and software (`skills-software-links`), drift between tools (`skills-drift`), MCP tools for skills.
- A link from a source file to the Git host.
- Changes to the catalogue pipeline template: checking out a skills repository in it is a recipe in `docs/skills.md` now and part of `pipeline-recipes` later.

## Decisions to confirm at gate 1

1. **Skills map file**: `stackledger-skills.yaml` at the top of each given skills folder (read like `.stackledgerignore`: only there, never from a sub-folder), with the unchanged kinds `Line` and `MapLayout` and references `skill:<name>`, `playbook:<name>`, `agent:<name>`. Several given folders are one set of documents: one `MapLayout` (the earliest), line names and codes unique across them. Recommended: one schema and one set of rules to learn, the map lives next to the skills it draws (ADR 10), and the kind in the reference says what the station is. Alternative: new kinds `SkillLine` and `SkillMapLayout`.
2. **No zones on the skills map** in this change: `spec.zones` in a skills `MapLayout` is an error. Recommended: software zones come from a component label and skills have no labels; adding a membership key needs its own design. Alternative: zone members listed in the `MapLayout`.
3. **URLs**: `/skills/`, `/skill-map/`, `/rules/`, `/skills/<file>/`, `/playbooks/<file>/`, `/agents/<file>/`, with the file names of `skills map` (`Writer` becomes `_577269746572`). Recommended: a skill named `map` or `rules` can never collide with a section page, a skill and an agent may share a name, and the folders match the Markdown map. One header link (`Skills`); the list, map and rules pages share a sub-navigation.
4. **Where the folders come from**: any `--skills` replaces `spec.skills.folders` entirely; the list is resolved from the catalogue folder and refuses absolute paths and `~`; a `Settings` with an error is not trusted for it (no skill set, and the report says why), as it is not trusted for the title and colours. Recommended: a pipeline and a laptop differ only in an option, a catalogue repository stays portable, and a broken `Settings` cannot point the build somewhere unexpected.
5. **A wrong path fails, other errors do not**: missing folder exit 2, nothing found exit 1, nothing published changes; a set with other errors is built, exit 0, with the counts and the hint. Recommended: same as `skills map` and as a catalogue with errors.
6. **No `SKILL.md` body on the site**: pages show the description, relations, lines, rules and source paths. Recommended: the site is a governance view; showing Markdown well needs a sanitiser and a design of its own. Alternative: the body as escaped plain text in a collapsed block (cheap and safe, but unformatted).
7. **Both views show the same skills**: identical Skills pages in `full` and `staff` (your answer 4), and only `full` in the personal mode.
8. **`skills validate` checks the map file** (decision 1), with no new count in its output, so existing pipelines that compare the counts line or `.summary` keep working.

## Implicit requirements

- **Errors and invalid input:** requirement. Missing or unlistable skill folders and an empty `--skills` exit 2 before anything is created; nothing found exits 1 with the previous build intact; problems in the map file are `skills validate` problems with file, line and field; `Settings` paths are checked by `stackledger validate`.
- **Limits:** requirement. Map file 1 MiB like every file read; at most 20 configured folders; relation diagrams drawn only up to 100 items per column, names cut at 64 code points, descriptions at 1,024; the routing budget of the map engine applies unchanged; build time with a large skill set.
- **Repetition and idempotency:** requirement. The build stays deterministic: same files, date and version give the same bytes, whatever the folders' location on disk and listing order.
- **Concurrency:** n/a: one build at a time per output folder, as today (`docs/site.md`).
- **Security:** requirement. Skill text is escaped by the template engine or the SVG renderer; descriptions lose control and format characters; no page holds an absolute path or a given folder's path; the output folder may not be, hold or sit inside a skills folder; the skills folders are only read; the site's CSP, no-inline-code and no-external-request rules hold for the new pages; the map file is checked with the catalogue's secret rules.
- **Logs and observability:** requirement. The build report gives the skill set's counts, the problem counts with a hint, the skills map's suggested positions and unrouted hops, and why configured folders were not used.

## Dependencies

`skills-source`, `skills-ignore` and `skills-mermaid` (delivered, 0.2.0). No new runtime package: the skills map uses the existing engine, the relation diagram the existing SVG helpers, the map file the catalogue's YAML parser, schemas and secret rules.

## Documentation

- `docs/skills.md`: "Skills on the site" (the option and the setting, which wins, the map file format with an example, the pages, the CI recipe that checks out the skills repository next to the catalogue, the empty-catalogue tip for a person with skills only).
- `docs/site.md`: `--skills`, the new refusals, the report lines, the Skills pages.
- `docs/catalogue-format.md`: `spec.skills.folders`. `docs/map.md`: the skills map.
- `README.md`: Usage row and the "Agent skills" paragraph; ADR 10's short explanation unchanged.
- `examples/`: a fictitious Northwind skill set with a `stackledger-skills.yaml`, used by the tests and the demo.
- `AGENTS.md` implemented list; `docs/roadmap.md` row 4.
- Brain vault: stackledger `architecture.md`, `roadmap.md` and `changelog.md`.
