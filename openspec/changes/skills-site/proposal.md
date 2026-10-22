## Why

`stackledger skills validate` and `stackledger skills map` give a person or a team the checks and an offline Markdown map of their agent skills, but nobody without the repository can see them, and the metro map, the picture that makes the software side readable, does not exist for skills. ADR 10 decided one site with a Software section and a Skills section. This change builds the Skills section, so the people who read the software site (behind the same login) also see which skills, playbooks and agents exist, how they bring each other in, and every rule reviewers cite.

## What Changes

- `stackledger build` reads an optional skill set, exactly as `skills validate` reads it (`.stackledgerignore` included), from the folders of a new `--skills <folder>` option (repeatable) or, without it, from a new `spec.skills.folders` list in the catalogue's `Settings` (`stackledger.yaml`), relative to the catalogue folder. The option replaces the list, so a laptop and a pipeline can check the repositories out in different places.
- With a skill set, every site built (`full`, and `staff` in the corporate mode) gets the same Skills section: `/skills/` (list with search and kind filter), `/skill-map/` (the skills metro map), `/rules/` (rules index), and one page per item at `/skills/<file>/`, `/playbooks/<file>/` and `/agents/<file>/`, with an SVG diagram of its declared relations drawn by stackledger in the map's style. The header gets a `Skills` link. Without a skill set the sites are as today.
- The skills metro map is written by hand in the skills repository, in a file `stackledger-skills.yaml` at the top of a given folder, with the catalogue's own kinds `Line` and `MapLayout`; only the references change: stops and stations are `skill:<name>`, `playbook:<name>` or `agent:<name>`. `stackledger skills validate` reads and checks this file, so a pipeline catches a broken map before any build. The catalogue reader skips files of that name, so one repository can hold both.
- The map engine draws a skills map from those documents: same grid, stored positions, suggestions, routing, labels, themes and safe SVG, without licence markers, renewal rings or zones, with its own title and legend symbols. The software map's output does not change.
- The build report adds the skill set's counts, a hint to run `stackledger skills validate` when it has problems, and the skills map's suggested positions.
- A wrong skills configuration never publishes an empty Skills section: a missing folder is a usage error (exit 2); a folder with nothing found, an invalid `spec.skills` and two items with one page name are exit 1, all with nothing published changed. A skill set with other errors is still built, like a catalogue with errors.
- The build refuses an output folder that is or holds any input of the skill set (links followed), or sits inside a skill folder or `agents/`, as `skills map` does, so publication never deletes a source file; `--skills . --out public` at the top of a repository works.

## Capabilities

### New Capabilities

- `skills-site`: the Skills pages of the built sites (list, skills map page, item pages and their relation diagrams, rules index, text and path rules).

### Modified Capabilities

- `skill-source`: the skills map file (`stackledger-skills.yaml`): where it is read, its documents, skill references, problems.
- `skills-validate-command`: map file problems in its output, with the counts unchanged. (`skills map` reads the same set, so its index counts include them too, and a new map warning makes `--check` report the index out of date: intended.)
- `metro-map`: a skills map next to the software map; station references; legend and title per map.
- `build-command`: `--skills`, the skill folders and their errors, the output folder rule, reads, report, determinism and build time.
- `catalogue`: `spec.skills.folders` in `Settings`; catalogue files skip `stackledger-skills.yaml`.
- `catalogue-site`: the header's `Skills` link.
- `skills-map-command`: the skills map file is an input the Markdown map folder must not hold.

## Out of scope

- A site with skills and no software catalogue: the catalogue folder stays required. An empty folder works as a catalogue (checked: `validate` passes with 0 files); `docs/skills.md` will say so. A proper skills-only home page can come with `local-preview`.
- Zones on the skills map (decision 3).
- A page per skill line (the software site has journey pages); the skills map highlights a line, and item pages name the lines that stop at them.
- The body of `SKILL.md` on the site (decision 7).
- Links between skills and software (`skills-software-links`), drift between tools (`skills-drift`), MCP tools for skills.
- A link from a source file to the Git host.
- Changes to the catalogue pipeline template, and triggering a catalogue rebuild when the skills repository changes: `docs/skills.md` gives a recipe (check out the skills repository at a trusted ref next to the catalogue; rebuild on a schedule or a dispatch); `pipeline-recipes` comes later.

## Decisions to confirm at gate 1

1. **The skills map file keeps the catalogue's kinds.** You wrote: "the skills metro map uses the same file model as the software catalogue (`Line` and `MapLayout`), only changing the name to skill". Two readings: (a) the kinds stay `Line` and `MapLayout` and the references change to `skill:<name>`, `playbook:<name>` and `agent:<name>`; (b) new kinds `SkillLine` and `SkillMapLayout`. Recommended: (a), one schema to learn, and the kind in the reference says what the station is. Both reviews showed that (a) needs the catalogue reader to skip `stackledger-skills.yaml`, or a repository holding both would read the skills map as software documents; the spec now says so. (b) would avoid that rule at the cost of two new kinds.
2. **Where the file lives**: `stackledger-skills.yaml` at the top of each given skills folder, read only there (like `.stackledgerignore`), never a sub-folder. Several folders form one set of documents: one `MapLayout` (the earliest), line names and codes unique across them. Recommended: the map lives next to the skills it draws (ADR 10).
3. **No zones on the skills map** in this change: `spec.zones` in a skills `MapLayout` is an error, and, like any layout with a field error, its positions are then not used. Recommended: software zones come from a component label and skills have no labels; a membership key needs its own design. Alternative: zone members listed in the `MapLayout`.
4. **URLs**: `/skills/`, `/skill-map/`, `/rules/`, `/skills/<file>/`, `/playbooks/<file>/`, `/agents/<file>/`, with the file names of `skills map` (`Writer` becomes `_577269746572`); station and diagram references use the same file names (`skill:writer`), so any name, even one XML cannot hold, gets a safe, unique link. Recommended: no item name can collide with a section page, and a skill and an agent may share a name. One header link (`Skills`); the list, map and rules pages share a sub-navigation.
5. **Where the folders come from**: any `--skills` replaces `spec.skills.folders` entirely, and then the settings' folders are not even checked; the list is resolved from the catalogue folder, refuses absolute paths, `~` and drive letters, and allows `..`. Recommended: a pipeline and a laptop differ only in an option, and a catalogue repository stays portable.
6. **A broken setting fails loudly.** The first draft dropped the skills when the `Settings` had any error; the review pointed out that a typo in a colour would then publish a site without the Skills section, exit 0. Now, without `--skills`: a `Settings` with an error that has a `spec.skills` key anywhere is exit 1, with nothing published changed (fix it, or pass `--skills`); a broken `Settings` without that key builds as today, without skills; a settings file that cannot be parsed at all builds without skills, with a line in the report, so today's software builds keep working. Recommended: simple, loud, and nothing guesses which half of a broken file to trust.
7. **No `SKILL.md` body on the site**: pages show the description, relations, lines, rules and source paths. Recommended: the site is a governance view; showing Markdown well needs a sanitiser and a design of its own. Alternative: the body as escaped plain text in a collapsed block (cheap and safe, but unformatted).
8. **Errors**: a missing folder is exit 2; nothing found, an invalid `spec.skills` and two items with one page file name are exit 1; nothing published changes in any of them; a set with other errors is built, exit 0, with the counts and the hint. Recommended: same as `skills map` and as a catalogue with errors.
9. **Both views show the same skills** (your answer 4): identical Skills pages in `full` and `staff`, and only `full` in the personal mode. `skills validate` checks the map file with no new count in its output, so pipelines comparing the counts line or `.summary` keep working.
10. **Compatibility**: a catalogue with `spec.skills` is invalid for stackledger 0.2.0 (its `Settings` then has an error, which forces the corporate mode and hides every licence field in `staff`). Recommended: accept, and pin the same version in every pipeline and laptop; `docs/catalogue-format.md` says from which version the key exists. The one behaviour change for software-only users: a catalogue file named exactly `stackledger-skills.yaml` is no longer read as a catalogue file (rename it); `docs/catalogue-format.md` says so. The example catalogue does not get the key (copies of it would fail without the skills folder); the demo and tests pass `--skills`.

## Implicit requirements

- **Errors and invalid input:** requirement. Missing or unlistable folders in use and an empty `--skills` exit 2 before anything is created; nothing found, an invalid `spec.skills` and colliding page names exit 1 with the previous build intact; problems in the map file are `skills validate` problems with file, line and field; `Settings` paths are checked by `stackledger validate`.
- **Limits:** requirement. Map file 1 MiB like every file read; at most 20 configured folders; relation diagrams drawn only up to 100 items per side, names cut at 64 code points, descriptions at 1,024; the routing budget of the map engine applies unchanged; build time with a large skill set.
- **Repetition and idempotency:** requirement. The build stays deterministic: same files, date and version give the same bytes, whatever the folders' location on disk and listing order. A map file reached twice is read once.
- **Concurrency:** n/a: one build at a time per output folder, as today (`docs/site.md`).
- **Security:** requirement. Skill text is escaped by the template engine or the SVG renderer; shown text loses control and format characters; links and references use safe file names; no path stackledger computes is absolute or names a skills folder; the output folder may not be, hold or sit inside any input of the set; the skills folders are only read; the site's CSP, no-inline-code and no-external-request rules hold for the new pages; the map file is checked with the catalogue's secret rules. Configured paths may use `..`, so a pull request to a catalogue repository can point a build at any folder the runner can read and show its skills in that build: the CI recipe in `docs/skills.md` says to build pull requests only where no private skills repository is checked out, never to publish them (the template already does not), and to check out a skills repository at a trusted ref.
- **Logs and observability:** requirement. The build report gives the skill set's counts, the problem counts with a hint, the skills map's suggested positions and unrouted hops, and why configured folders were not used.

## Dependencies

`skills-source`, `skills-ignore` and `skills-mermaid` (delivered, 0.2.0). No new runtime package: the skills map uses the existing engine, the relation diagram the existing SVG helpers, the map file the catalogue's YAML parser, schemas and secret rules.

## Verification with real data

After the tests, the owner's catalogue is built with `--skills` pointing at his skills repository and the OpenSpec clone, into a scratch folder, to report the counts, the build time and screenshots in the pull request. The private catalogue repository is not changed by this change.

## Documentation

- `docs/skills.md`: "Skills on the site" (the option and the setting, which wins, the map file format with an example, the pages, the CI recipe and its trust rules, rebuilding when skills change, the empty-catalogue tip for a person with skills only).
- `docs/site.md`: `--skills`, the new refusals and exit codes, the report lines, the Skills pages.
- `docs/catalogue-format.md`: `spec.skills.folders`, from which version, and that files named `stackledger-skills.yaml` are not catalogue files. `docs/map.md`: the skills map.
- `README.md`: Usage row and the "Agent skills" paragraph; ADR 10's short explanation unchanged.
- `examples/northwind-skills/`: a fictitious Northwind skill set with a `stackledger-skills.yaml`, used by the tests and the demo.
- `AGENTS.md` implemented list; `docs/roadmap.md` row 4.
- Brain vault: stackledger `architecture.md`, `roadmap.md` and `changelog.md`.
