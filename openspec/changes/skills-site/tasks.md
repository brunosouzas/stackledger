## 1. Before the engine changes

- [ ] 1.1 Record the example catalogue's software map SVGs (`stackledger map` in `full` and `staff`, `light` and `dark`, fixed date) from the current `main` as fixtures, and add the "Example map" test comparing against them. Check: `npx vitest run test/unit/map-svg.test.ts` passes on unchanged code.

## 2. Reading the skills map file

- [ ] 2.1 `src/schema.ts`: `spec.skills.folders` in `Settings` (1 to 20 relative paths, no repeats, no `/`, `\`, `~` or drive letter, no other field). Check: `npx vitest run test/unit/settings.test.ts`.
- [ ] 2.2 `src/skills/walk.ts` and `src/skills/source.ts`: find `stackledger-skills.yaml` at the top of each given folder that is not a skill folder (never tested by the ignore file, not counted as found), read it as a file (size, link, not-a-file and secret rules), record its real path as an input. Check: `npx vitest run test/unit/skills-lines.test.ts test/unit/skills-walk.test.ts`.
- [ ] 2.3 `src/skills/lines.ts`: parse with `parseSource`, check `Line` and `MapLayout` with the catalogue schemas and rules, skill references (`skill:`, `playbook:`, `agent:`, exact names, kind named on mismatch), `spec.zones` error, other kinds error, line names and codes unique and one `MapLayout` across folders, positions-and-lines warnings; serve lines and layout to the set. Check: `npx vitest run test/unit/skills-lines.test.ts`, and `test/integration/skills-validate.test.ts` for the output.

## 3. Engine

- [ ] 3.1 `src/map/model.ts`, `layout.ts`, `svg.ts`: map kind, title, empty text and legend symbols as model data; station references. Check: the "Example map" fixtures and `npx vitest run test/unit/map-*.test.ts`.
- [ ] 3.2 `src/skills/metro.ts`: `buildSkillsMapModel` from the set's served lines and layout (stops not in the set skipped, short lines dropped, layout keys reserving cells, no licence, renewal, zone or muting). Check: `npx vitest run test/unit/skills-metro.test.ts`.
- [ ] 3.3 `src/map/relations.ts`: the relation diagram (columns, shapes, relation-kind text, self and both-sides neighbours, 64-code-point names with `title`, the 100-item budget, allow-lists). Check: `npx vitest run test/unit/skills-relations-diagram.test.ts`.

## 4. Site

- [ ] 4.1 `src/site/skills-data.ts`: page data from the set, graph and skills map model (rows, item pages, rules rows, lines at each item, source paths below the given folder, text cleaning as `skills map`), added identically to every view's `SiteData`. Check: `npx vitest run test/unit/site-skills-data.test.ts`.
- [ ] 4.2 `site/`: the dynamic routes for the list, skills map, rules index and item pages; the `Skills` header link and the sub-navigation; the list and rules search and filter; the map page without zone filter; `links.ts` resolving skill `data-ref` through the page's text-alternative links. Check: `npx vitest run test/integration/site-skills.test.ts` and `npm run test:browser`.
- [ ] 4.3 `src/site/command.ts` and `build.ts`: `--skills` (repeatable, empty refused), `spec.skills.folders` resolved from the catalogue folder and ignored when the Settings has an error, folder usage errors before the output check, the output-folder refusal, "nothing found" before staging, the report lines, the leak scan given the catalogue and skills folder paths. Check: `npx vitest run test/integration/build.test.ts test/integration/build-skills.test.ts`.
- [ ] 4.4 `src/cli.ts`: usage text with `[--skills <folder>]...`. Check: `npx vitest run test/integration/cli.test.ts`.

## 5. Tests, example and documentation

- [ ] 5.1 One test per scenario, named after it (map below). Fixtures are fictitious (Northwind) and built in temporary folders.
- [ ] 5.2 `examples/northwind-skills/`: a fictitious skill set (skills, two playbooks, agents, rules, a `stackledger-skills.yaml` with two lines and stored positions) and `spec.skills.folders: [../northwind-skills]` in `examples/northwind/stackledger.yaml`, so the demo shows the Skills section. Check: `node dist/cli.js skills validate examples/northwind-skills` exits 0 with no warning; `npx vitest run test/integration/map-example.test.ts`.
- [ ] 5.3 Add the new source files to the skills network test (`test/unit/skills-offline.test.ts`).
- [ ] 5.4 Docs: `docs/skills.md` "Skills on the site" (option and setting, which wins, the map file with an example, the pages, the CI recipe checking out a skills repository next to the catalogue, the empty-catalogue tip); `docs/site.md`; `docs/catalogue-format.md`; `docs/map.md`; README Usage row and "Agent skills"; `AGENTS.md` implemented list; `docs/roadmap.md` row 4. Check: `npx vitest run test/integration/docs.test.ts`.

## 6. Integration

- [ ] 6.1 Full suite and browser tests. Check: `npm test` and `npm run test:browser`.
- [ ] 6.2 Timing. Check: `npm run test:perf` ("Large catalogue and skill set" within 150 s).

| Capability | Scenario | Test file (level) |
|---|---|---|
| skill-source | Map file at the top; Map file below the top; Map file in a single skill; Ignore file cannot hide it; Map file alone | test/unit/skills-lines.test.ts (unit) |
| skill-source | Malformed map file; Map file that is a folder; Secret in the map file | test/unit/skills-lines.test.ts (unit) |
| skill-source | Component in the map file; Zones in a skills layout; Line with one stop; Stop without a position | test/unit/skills-lines.test.ts (unit) |
| skill-source | Missing stop; Wrong kind; Software reference; Agent station; Stop excluded by an error; Second layout; One line name in two files | test/unit/skills-lines.test.ts (unit) |
| catalogue | Two skills folders; Absolute path; Home folder shortcut; Empty list; Too many folders; Repeated folder; Unknown skills field | test/unit/settings.test.ts (unit) |
| catalogue | Staff hide list; Unknown field name in the hide list; Repeated field name (unchanged) | test/unit/settings.test.ts (unit, existing) |
| metro-map | Map input and Legend scenarios (unchanged); Allowed names only; No embedded font; Hostile titles | test/unit/map-svg.test.ts, map-model.test.ts (unit, existing) |
| metro-map | Hostile skill names; Software station; Skills stations; Stop not in the set; No skill lines; Legend of a skills map; Same skills map everywhere; Suggested skill station | test/unit/skills-metro.test.ts (unit) |
| metro-map | Example map | test/unit/map-svg.test.ts (unit) |
| catalogue-site | Theme remembered; Site title; View in the footer; Reports link (unchanged) | test/integration/site.test.ts, test/browser/site.spec.ts (existing) |
| catalogue-site | Skills link | test/integration/site-skills.test.ts (integration) |
| build-command | Two sites; One error; Proxy reminder; Built twice (unchanged) | test/integration/build.test.ts (existing) |
| build-command | Sandboxed build | test/integration/build.test.ts (integration, updated) |
| build-command | Two sites with skills; Skills folder elsewhere; Folders from the settings; The option replaces the settings; Several option folders; No skill set; Broken settings | test/integration/build-skills.test.ts (integration) |
| build-command | Missing skills folder; Missing configured folder; Nothing found does not empty the section; Skill set with errors; Output inside the skills folder; Output contains the skills folder | test/integration/build-skills.test.ts (integration) |
| build-command | Counts line; Skills problems; Suggested skill position | test/integration/build-skills.test.ts (integration) |
| build-command | Large catalogue and skill set | test/perf/build-skills.perf.test.ts (perf) |
| skills-map-command | Output holds the linked skills map file | test/integration/skills-map.test.ts (integration) |
| skills-site | Item pages; Name that is not a file name; Skill and agent with one name; No skill set; Rules page; Both sites; Personal build | test/integration/site-skills.test.ts (integration) |
| skills-site | Playbook page; Rules on a skill page; Reached through a playbook; Lines at an item; Item with no relation; Agent page; Same as the Markdown map; Missing relation target; Every item has an error | test/unit/site-skills-data.test.ts (unit) and test/integration/site-skills.test.ts |
| skills-site | Diagram of a skill; Two playbooks that load each other; Shapes; Hostile name; Long name; At the budget; Over the budget | test/unit/skills-relations-diagram.test.ts (unit) |
| skills-site | Description with HTML; Hostile script text; Bidirectional override; Tool folder in the home folder | test/integration/site-skills.test.ts (integration) |
| skills-site | Search; Kind filter; Nothing matches; Without JavaScript; Box link; Station link; Highlight a skill line; No skill lines; Map without JavaScript; Shared rule ID; Search rules; No rules; Pages work under the policy | test/browser/site-skills.spec.ts (e2e); Shared rule ID, No rules and No skill lines also in test/integration/site-skills.test.ts |

## Workflow follow-up

- Build the owner's catalogue with `--skills` pointing at the kit and the OpenSpec clone, `--out` in a scratch folder, and report the counts, the build time and screenshots of the Skills pages. Do not change the private catalogue repository in this change.
