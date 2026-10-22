## 1. Code

- [ ] 1.1 `src/skills/graph.ts`: a pure function from a skill set to nodes (kind and name) and edges (`loads`, `uses`, `preloads`), dropping edges to names not in the set. Check: `npx vitest run test/unit/skills-map.test.ts`.
- [ ] 1.2 `src/skills/mermaid.ts`: page file names, Mermaid label and Markdown escaping, description cut, the one-hop diagram, item pages, the index; source links relative to the page only inside the working folder. Pure: returns a map of relative path to content. Check: same file.
- [ ] 1.3 `src/skills/map-command.ts` and the `skills map` dispatch in `src/cli.ts` (usage text and help): options, the safe map folder (resolve links; refuse a given folder, a folder holding one, a folder inside a skill folder, a non-empty folder without the marker, linked marker, index or kind folders), writing only changed pages, removing stale entries under the three kind folders, `--check`, exit codes and stderr. Check: `npx vitest run test/integration/skills-map.test.ts`.

## 2. Tests and documentation

- [ ] 2.1 One test per scenario, named after it (map below). Fixtures are fictitious (Northwind) and built in temporary folders. Each diagram in the tests' fixtures is also checked to parse with the Mermaid version the docs name, if it can run offline in the test environment; otherwise the syntax is checked by structure.
- [ ] 2.2 `docs/skills.md` "Map in the repository" section (command, layout, what is drawn and what is not, the marker and the folder rules, `--check` in CI, not safe for two runs at once, Git restores an interrupted run, which hosts render Mermaid); README Usage row and one sentence in "Agent skills"; `AGENTS.md` implemented list; `docs/roadmap.md` row 3 delivered. Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full suite. Check: `npm test`.

| Capability | Scenario | Test file |
|---|---|---|
| skills-map-command | Name in the text; Missing relation target; Name with a path; Names that differ only in case | test/unit/skills-map.test.ts |
| skills-map-command | Playbook page; Skill page; Diagram of a skill; Node names are not IDs; Index tables; Set with no relations | test/unit/skills-map.test.ts |
| skills-map-command | Label that tries to close the node; Description with HTML; Tool folder in the home folder; Skill in the repository | test/unit/skills-map.test.ts |
| skills-map-command | Missing out; Same set as validate; Output is the given folder; Output inside the given folder; Unrelated non-empty folder; Linked pages folder | test/integration/skills-map.test.ts |
| skills-map-command | Removed skill; Skill and agent with one name; Other files kept; Two runs; Stale map in a pipeline; Up to date; Set with errors | test/integration/skills-map.test.ts |

## Workflow follow-up

- Run against the owner's skills repository and the OpenSpec clone with `--out` in a scratch folder (never in the real repository), and report the counts and a sample page rendered with `mmdc`.
