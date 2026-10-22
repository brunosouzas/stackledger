## 1. Before the engine changes

- [ ] 1.1 Record the example catalogue's software map SVGs (`stackledger map` in `full` and `staff`, `light` and `dark`, fixed date) from the current `main` as fixtures (its code is 0.2.0's: the commits after the release changed only a development dependency), and add the "Example map" test comparing against them. Check: `npx vitest run test/unit/map-svg.test.ts` passes on unchanged code.

## 2. Reading the skills map file and the settings

- [ ] 2.1 `src/schema.ts`: `spec.skills.folders` in `Settings` (1 to 20 paths, no repeats, not starting with `/`, `\`, `~` or a drive letter and `:`, no other field under `spec.skills`). Check: `npx vitest run test/unit/settings.test.ts`.
- [ ] 2.2 `src/source.ts`: the catalogue reader skips files named `stackledger-skills.yaml`. Check: `npx vitest run test/unit/served.test.ts` ("Skills map file in the catalogue folder").
- [ ] 2.3 `src/skills/walk.ts` and `src/skills/source.ts`: find `stackledger-skills.yaml` at the top of each given folder that is not a skill folder (never tested by the ignore file, not counted as found, read once per device and inode), read it as a file (size, link, not-a-file and secret rules), record its real path as an input. Check: `npx vitest run test/unit/skills-lines.test.ts test/unit/skills-walk.test.ts`.
- [ ] 2.4 `src/skills/lines.ts`: parse with `parseSource`, check `Line` and `MapLayout` with the catalogue schemas and every catalogue rule for those kinds, skill references (`skill:`, `playbook:`, `agent:` in lower case, exact names, kind named on mismatch, stops in error not drawn), playbook zones (each zone names a playbook, else a reference error that keeps the layout; members are the playbook and its direct relations), other kinds and `apiVersion` errors, line names and codes unique and one `MapLayout` across folders, positions-and-lines warnings; serve lines and layout to the set. Check: `npx vitest run test/unit/skills-lines.test.ts`, and `test/integration/skills-validate.test.ts` for the output.

## 3. Engine

- [ ] 3.1 `src/map/model.ts`, `layout.ts`, `svg.ts`: map kind, title, empty text and legend symbols as model data; station references. Check: the "Example map" fixtures and `npx vitest run test/unit/map-*.test.ts`.
- [ ] 3.2 `src/skills/metro.ts` and `src/map/zones.ts`: `buildSkillsMapModel` from the set's served lines and layout (references with page file names, cleaned labels, stops not in the set skipped, short lines dropped, layout keys reserving cells, no licence, renewal or muting); stations with a list of zones, playbook zone members, `data-zone` lists, zone titles placed by their playbook's station (label candidates), or at the corner and moved apart when the playbook is not drawn. Check: `npx vitest run test/unit/skills-metro.test.ts`.
- [ ] 3.3 `src/map/relations.ts`: the relation diagram (columns, shapes, relation-kind text, self and both-sides neighbours, 64-code-point names with `title`, the 100-item budget, allow-lists, file-name references). Check: `npx vitest run test/unit/skills-relations-diagram.test.ts`.

## 4. Site

- [ ] 4.1 `src/site/skills-data.ts`: page data from the set, graph and skills map model (rows, item pages, rules rows, lines at each item, source paths below the given folder, text cleaning), added identically to every view's `SiteData`. Check: `npx vitest run test/unit/site-skills-data.test.ts`.
- [ ] 4.2 `site/`: the dynamic routes for the list, skills map, rules index and item pages; the header divisions (Software, Skills) and each division's sub-navigation; the list and rules search and filter; the map page with the zone filter when zones are drawn (list mode on the skills page only; the software page keeps whole-value matching, with a browser regression test for a zone named `Team tools`); `links.ts` for `skill:`, `playbook:` and `agent:` references. Check: `npx vitest run test/integration/site-skills.test.ts` and `npm run test:browser`.
- [ ] 4.3 `src/site/command.ts` and `build.ts`: `--skills` (repeatable, empty refused); the folders in use (option, else `spec.skills.folders` resolved from the catalogue folder, used when the Settings in use has no error; with a broken Settings, exit 1 when any parsed Settings document has a `spec.skills` key, otherwise no skill set, with a report line when a Settings file could not be parsed); the check order (exit 2 before exit 1); the output-folder refusals against the folders, every recorded input, skill folders and top-level `agents/` (output elsewhere inside a skills folder allowed); "nothing found" and page-name collisions before staging; the report lines (suggestions written as map-file keys, control characters removed). Check: `npx vitest run test/integration/build.test.ts test/integration/build-skills.test.ts`.
- [ ] 4.4 `src/cli.ts`: usage text with `[--skills <folder>]...`. Check: `npx vitest run test/integration/cli.test.ts`.

## 5. Tests, example and documentation

- [ ] 5.1 One test per scenario, named after it (map below). Fixtures are fictitious (Northwind) and built in temporary folders.
- [ ] 5.2 `examples/northwind-skills/`: a fictitious skill set (skills, two playbooks, agents, rules, a `stackledger-skills.yaml` with two lines and stored positions). The example catalogue's `stackledger.yaml` is not changed; the tests and the demo pass `--skills examples/northwind-skills`. Check: `node dist/cli.js skills validate examples/northwind-skills` exits 0 with no warning, and `npx vitest run test/integration/site-skills.test.ts` builds the example with it.
- [ ] 5.3 Add the new source files to the skills network test (`test/unit/skills-offline.test.ts`).
- [ ] 5.4 Docs: `README.md` "Skills on the site" (option or setting, the option replaces the list, paths relative to the catalogue folder, a laptop and a pipeline example); `docs/skills.md` "Skills on the site" (option and setting, which wins, the map file with an example, playbook zones, the pages, the CI recipe with a trusted checkout of the skills repository, pull requests built only without private skills and never published, rebuilding when skills change, the empty-catalogue tip); `docs/site.md` (option, refusals, exit codes, report); `docs/catalogue-format.md` (`spec.skills.folders` from this version on, `stackledger-skills.yaml` not a catalogue file); `docs/map.md`; README Usage row and "Agent skills"; `AGENTS.md` implemented list; `docs/roadmap.md` row 4. Check: `npx vitest run test/integration/docs.test.ts`.

## 6. Integration

- [ ] 6.1 Full suite and browser tests. Check: `npm test` and `npm run test:browser`.
- [ ] 6.2 Timing. Check: `npm run test:perf` ("Large catalogue and skill set" within 150 s).
- [ ] 6.3 Verification with real data (proposal): build the owner's catalogue with `--skills` at his skills repository and the OpenSpec clone into a scratch folder; put the counts, the build time and screenshots in the pull request. Check: exit 0 and the Skills pages open on `127.0.0.1`.

| Capability | Scenario | Test file (level) |
|---|---|---|
| skill-source | Map file at the top; Map file below the top; Map file in a single skill; Other extension; Ignore file cannot hide it; Map file alone; Linked map file | test/unit/skills-lines.test.ts (unit) |
| skill-source | Malformed map file; Map file that is a folder; Secret in the map file; Relation error keeps the item | test/unit/skills-lines.test.ts (unit) |
| skill-source | Component in the map file; Line with one stop; Stop without a position | test/unit/skills-lines.test.ts (unit) |
| skill-source | Playbook as a zone; Zone that is not a playbook; Only direct members; One skill in two zones | test/unit/skills-lines.test.ts (unit) |
| skill-source | Missing stop; Wrong kind; Kind in another case; Software reference; Agent station; Stop excluded by an error; Second layout; One line name in two files | test/unit/skills-lines.test.ts (unit) |
| catalogue | Nested and multi-document files; Skipped folders and other files (unchanged) | test/unit/served.test.ts (unit, existing) |
| catalogue | Skills map file in the catalogue folder | test/unit/served.test.ts (unit) |
| catalogue | Two skills folders; Absolute path; Home folder shortcut; Drive letter; Empty list; Too many folders; Repeated folder; Unknown skills field | test/unit/settings.test.ts (unit) |
| catalogue | Staff hide list; Unknown field name in the hide list; Repeated field name (unchanged) | test/unit/settings.test.ts (unit, existing) |
| metro-map | Component on no line; Stop with errors; Line left with one stop; No lines; Legend in staff; Allowed names only; No embedded font; Hostile titles (unchanged) | test/unit/map-svg.test.ts, test/unit/map-model.test.ts (unit, existing) |
| metro-map | Software lines in a skills map file name | test/unit/map-svg.test.ts (unit) |
| metro-map | Hostile skill names; Software station; Skills stations; Names that XML cannot hold; Stop not in the set; Relation error keeps the station; No skill lines; Legend of a skills map; Same skills map everywhere; Suggested skill station | test/unit/skills-metro.test.ts (unit) |
| metro-map | Overlapping zones; Multi-word software zone; Title by its playbook; Title clear of the lines; Two zones with one corner | test/unit/skills-metro.test.ts (unit) |
| metro-map | Example map | test/unit/map-svg.test.ts (unit) |
| catalogue-site | Theme remembered; Site title; View in the footer (unchanged) | test/integration/site.test.ts, test/browser/site.spec.ts (existing) |
| catalogue-site | Reports link (updated); Software sub-navigation | test/integration/site.test.ts (integration) |
| catalogue-site | Station link; Highlight a line (unchanged) | test/browser/site.spec.ts (existing) |
| catalogue-site | Zone with a space in its name | test/browser/site.spec.ts (e2e) |
| catalogue-site | Skills link | test/integration/site-skills.test.ts (integration) |
| build-command | Two sites; One error; Proxy reminder; Built twice (unchanged) | test/integration/build.test.ts (existing) |
| build-command | Sandboxed build | test/integration/build-skills.test.ts (integration; the software-only case stays in build.test.ts) |
| build-command | Two sites with skills; Skills folder elsewhere; Folders from the settings; The option replaces the settings; Several option folders; No skill set | test/integration/build-skills.test.ts (integration) |
| build-command | Error elsewhere in the settings; Error in the skills settings; Broken settings and the option; Unreadable settings file; Broken settings without skills | test/integration/build-skills.test.ts (integration) |
| build-command | Missing skills folder; Missing configured folder; Empty option; Nothing found does not empty the section; Skill set with errors; Colliding page names | test/integration/build-skills.test.ts (integration) |
| build-command | Output inside a skill folder; Output in the agents folder; Output contains the skills folder; Output holds a linked input; Building inside the skills repository; Output inside a linked skill folder | test/integration/build-skills.test.ts (integration) |
| build-command | Counts line; Skills problems; Suggested skill position; Suggested position of a name that is not a file name; Control character in a suggested name | test/integration/build-skills.test.ts (integration) |
| build-command | Large catalogue and skill set | test/perf/build-skills.perf.test.ts (perf) |
| skills-map-command | Output is the given folder; Output holds a linked source; Output inside a skill folder; Output in the agents folder; Output in a tool folder; Output holds a linked source file; Output inside the given folder (unchanged) | test/integration/skills-map.test.ts (integration, existing) |
| skills-validate-command | Broken map file fails a pipeline; Counts line unchanged | test/integration/skills-validate.test.ts (integration) |
| skills-map-command | Output holds the linked skills map file | test/integration/skills-map.test.ts (integration) |
| skills-site | Item pages; Name that is not a file name; Skill and agent with one name; No skill set; Rules page; Both sites; Personal build; Relative skills folder | test/integration/site-skills.test.ts (integration) |
| skills-site | Playbook page; Rules on a skill page; Reached through a playbook; Lines at an item; Item with no relation; Agent page; Same as the Markdown map; Missing relation target; Every item rejected; Relation error keeps the page | test/unit/site-skills-data.test.ts (unit) and test/integration/site-skills.test.ts |
| skills-site | Diagram of a skill; Two playbooks that load each other; Shapes; Hostile name; Long name; At the budget; Over the budget | test/unit/skills-relations-diagram.test.ts (unit) |
| skills-site | Description with HTML; Hostile script text; Bidirectional override; Tool folder in the home folder | test/integration/site-skills.test.ts (integration) |
| skills-site | Search; Kind filter; Nothing matches; Without JavaScript; Box link; Station link; Highlight a skill line; Filter by a playbook zone; No zone filter without zones; No skill lines; Map without JavaScript; Shared rule ID; Rule of a playbook; Search rules; No rules; Pages work under the policy | test/browser/site-skills.spec.ts (e2e); Shared rule ID, Rule of a playbook, No rules and No skill lines also in test/integration/site-skills.test.ts |
