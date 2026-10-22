## Why

A team that keeps its agent skills in a repository has no picture of them: which playbooks load which skills, which agents preload what, and what a change to one skill touches. `stackledger skills validate` checks the set, but its output is a list of problems. People want the map where they already read the skills, in the repository itself: offline, in an editor or on a Git host, and visible in pull-request diffs, so a reviewer sees that a change adds or drops a relation. The site (`skills-site`, next on the roadmap) comes later and needs hosting; this map does not.

## What Changes

- New command `stackledger skills map [folder...] --out <folder> [--check]`. It reads the same skill set as `skills validate` and writes Markdown pages with Mermaid diagrams into the output folder: one `README.md` index and one page per skill, playbook and agent.
- Each page shows the item's description, a one-hop diagram of its declared relations (what brings it in and what it brings in), the same relations as linked lists, what reaches it through more than one relation, its rule IDs and its files. The index adds the counts (errors and ignored entries included), one diagram of every relation within a size budget, tables, and the skills nothing brings in.
- Only declared relations are drawn (`metadata.stackledger-skills`, `metadata.stackledger-agents` and an agent's `skills`), never guesses from the text (ADR 10).
- stackledger owns a marker, `.gitattributes`, `README.md` and the `skills/`, `playbooks/` and `agents/` subtrees of the output folder; it never writes through a link, and refuses an output folder that holds any input.
- `--check` writes nothing and exits 1 when the map is out of date, so a pipeline can fail a pull request that changed skills without updating the map.
- The output is byte-for-byte deterministic on any platform, with node IDs that stay stable, so a diff shows only what changed.

## Capabilities

### New Capabilities

- `skills-map-command`: the command, its output folder, the pages, the diagrams and `--check`.

### Modified Capabilities

None. It reads skill sets as `skill-source` defines them.

## Out of scope

- The site pages and the metro map of skills (`skills-site`).
- Relations guessed from the text (a name in backticks, "not for"): the owner's kit draws those with its own script, which keeps working.
- Software used by a skill (`skills-software-links`).
- Agent fields other than the preloaded skills (tools, model, effort): they are tool-specific; a later change can add them.
- Diagram formats other than Mermaid; an SVG fallback for hosts that do not render Mermaid.
- Running two map commands on one folder at the same time.

## Decisions to confirm at gate 1

1. **stackledger owns part of the output folder**: the marker, `.gitattributes`, `README.md` and the whole `skills/`, `playbooks/` and `agents/` subtrees; other top-level files are kept. Recommended: a removed skill's page disappears, a person can keep notes next to the map, and anything placed inside the three subtrees is removed by the next run (stated in the docs).
2. **Layout: `README.md`, `skills/<name>.md`, `playbooks/<name>.md`, `agents/<name>.md`.** Recommended: a skill and an agent may share a name (the `skill-source` spec allows it), so they need separate folders, and the Git host shows `README.md` when the folder is opened. Unsafe names (paths, capitals, Windows device names, long names) get a hexadecimal file name.
3. **Only declared relations.** Recommended: a picture people use to govern skills must be exactly what the files declare; a guess shown as a fact misleads a reviewer. A declaration says the file asks for the skill; it does not prove a tool loads it, and the index says so.
4. **A set with errors is still mapped, exit 0**, with the counts in the index and on stderr, **except** when a given folder has nothing found in it (a wrong path or an ignore file hiding everything): then exit 1 and nothing changes, so a mistake cannot empty the map. Recommended: failing on errors is `skills validate`'s job, and the docs' pipeline runs both.
5. **The index draws every relation in one diagram, within a budget**: at most 400 edges and 40,000 characters (measured: Mermaid 11 refuses 501 edges and about 50,000 characters); over it, the page says so and the tables hold everything. Recommended: no page breaks on a large set.

## Gate 1

The owner approved the five decisions above as recommended (2026-10-22), after both spec reviews.

## Implicit requirements

- **Errors and invalid input:** requirement. Usage errors and refused folders exit 2 with nothing written; a write failure or a folder changed during the run exits 1 and names it.
- **Limits:** requirement. Names and descriptions come from files a fork's pull request can change: file names are made safe, Mermaid labels and Markdown text are escaped, labels are cut at 64 code points and descriptions at 1,024, and diagrams have a budget.
- **Repetition and idempotency:** requirement. Running twice changes nothing; `--check` after a run exits 0, also on a CRLF checkout.
- **Concurrency:** n/a: one process; two runs on one folder at once are not supported (stated in the docs).
- **Security:** requirement. Writes stay inside the output folder, never through a link, by rename; the output folder never holds an input, a tool folder or an `openspec/` folder; no computed path is absolute; no network.
- **Logs and observability:** requirement. stderr says how many pages were created, updated and removed, and the problem counts; the index records them for offline readers.

## Dependencies

`skills-source` and `skills-ignore` (delivered). No new runtime package: Mermaid is text, rendered by the Git host or editor. A pinned `mermaid` development dependency renders the test fixtures in the existing browser test job.

## Documentation

- `docs/skills.md`: a "Map in the repository" section (command, layout, what is drawn and what is not, the owned entries, the folder rules, `--check` in CI next to `skills validate`, run again after an interrupted run, and which hosts render Mermaid: GitHub, GitLab and VS Code; not Bitbucket Cloud or Azure Repos files, where the lists and tables still read).
- `README.md`: the Usage row and one sentence in "Agent skills".
- `AGENTS.md`: implemented list. `docs/roadmap.md`: row 3, without "what it names".
- Brain vault: the stackledger architecture, roadmap and changelog.
