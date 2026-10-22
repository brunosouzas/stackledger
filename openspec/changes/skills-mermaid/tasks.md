## 1. Code

- [x] 1.1 `src/skills/source.ts`: keep, for each skill, playbook and agent, its description, its given folder and its source files (display path, path below the given folder, real path), and record the real paths of every skill folder and agent file the walk found, rejected ones included. `skills validate` output and membership do not change. Check: `npx vitest run test/unit/skills-*.test.ts test/integration/skills-validate.test.ts`.
- [x] 1.2 `src/skills/graph.ts`: a pure function from a skill set to nodes and edges (`loads`, `uses`, `preloads`, namespaces as specified, repeats once, self-relations and cycles kept) and "Reached through". Check: `npx vitest run test/unit/skills-map.test.ts`.
- [x] 1.3 `src/skills/mermaid.ts`: page file names, stable node IDs, label and Markdown escaping, description and label cuts, the diagram budget, item pages, the index, source links (relative, `/`, percent-encoded, only inside the current folder). Pure: takes the graph and computed paths, returns relative path to content. Check: same file.
- [x] 1.4 `src/skills/map-command.ts` and the `skills map` dispatch and usage text in `src/cli.ts`: options, the input and folder checks, the marker and `.gitattributes`, writing by temporary file and rename, removing stale entries without following links, the identity re-check, the "nothing found" refusal, `--check` with CRLF normalised, exit codes and stderr. Check: `npx vitest run test/integration/skills-map.test.ts`.

## 2. Tests and documentation

- [x] 2.1 One test per scenario, named after it (map below). Fixtures are fictitious (Northwind) and built in temporary folders.
- [x] 2.2 Add `mermaid` as an exact development dependency and render, in the existing browser test job, every diagram of the fixtures behind "Node names are not IDs", "Label that tries to close the node", "Diagram of a skill", "Two playbooks that load each other", "Skill that lists itself" and "Index at the edge budget"; a diagram that does not render fails the test. Those scenarios also have their unit test.
- [x] 2.3 Add the map's source files to the skills network test (`test/unit/skills-offline.test.ts`).
- [ ] 2.4 `docs/skills.md` "Map in the repository" section (command, layout, what is drawn and what is not, the owned entries and that files inside the kind folders are removed, the folder rules, `--check` in CI next to `skills validate`, not for two runs at once, run again after an interrupted run, which hosts render Mermaid); README Usage row and one sentence in "Agent skills"; `AGENTS.md` implemented list; `docs/roadmap.md` row 3 delivered and without "what it names". Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full suite. Check: `npm test`.

| Capability | Scenario | Test file |
|---|---|---|
| skills-map-command | Name with a path; Names that differ only in case; Windows device name; Long name | test/unit/skills-map.test.ts |
| skills-map-command | Name in the text; Missing relation target; Same name in two namespaces; Repeated preload | test/unit/skills-map.test.ts |
| skills-map-command | Playbook page; Skill page; Reached through a playbook; Listing order does not matter | test/unit/skills-map.test.ts |
| skills-map-command | Diagram of a skill; Two playbooks that load each other; Skill that lists itself; New skill in a diff; Node names are not IDs | test/unit/skills-map.test.ts |
| skills-map-command | Index at the edge budget; Index over the edge budget; Index tables; Set with no relations; Errors recorded in the index | test/unit/skills-map.test.ts |
| skills-map-command | Description with HTML; Multi-line description with a fence; Description at the limit; Label that tries to close the node | test/unit/skills-map.test.ts |
| skills-map-command | Skill in the repository; Tool folder in the home folder; Folder name with special characters | test/unit/skills-map.test.ts |
| skills-map-command | Missing out; Out is a file; Same set as validate; Help | test/integration/skills-map.test.ts |
| skills-map-command | Output is the given folder; Output holds a linked source; Output inside a skill folder; Output in the agents folder; Output in a tool folder; Output inside the given folder | test/integration/skills-map.test.ts |
| skills-map-command | Unrelated non-empty folder; Marker that is not valid; Other files kept; Removed skill | test/integration/skills-map.test.ts |
| skills-map-command | Linked kind folder; Linked page; Hard-linked page; Writes stay in the map folder; Folder swapped | test/integration/skills-map.test.ts |
| skills-map-command | Two runs; Checkout with CRLF; Stale map in a pipeline; Up to date; Set with errors; Wrong folder does not empty the map | test/integration/skills-map.test.ts |

## Workflow follow-up

- Run against the owner's skills repository and the OpenSpec clone with `--out` in a scratch folder (never in the real repository), and report the counts and a sample page rendered with `mmdc`.
