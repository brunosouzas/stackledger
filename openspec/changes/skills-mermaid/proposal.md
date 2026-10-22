## Why

A team that keeps its agent skills in a repository has no picture of them: which playbooks load which skills, which agents preload what, and what a change to one skill touches. `stackledger skills validate` checks the set, but its output is a list of problems. People want the map where they already read the skills, in the repository itself: offline, in an editor or on any Git host, and visible in pull-request diffs, so a reviewer sees that a change adds or drops a relation. The site (`skills-site`, next on the roadmap) comes later and needs a network; this map does not.

## What Changes

- New command `stackledger skills map [folder...] --out <folder> [--check]`. It reads the same skill set as `skills validate` and writes Markdown pages with Mermaid diagrams into the output folder: one `README.md` index and one page per skill, playbook and agent.
- Each page shows the item's description, a one-hop diagram of its declared relations (what brings it in and what it brings in), the same relations as linked lists, its rule IDs and its files.
- Only declared relations are drawn (`metadata.stackledger-skills`, `metadata.stackledger-agents` and an agent's `skills`), never guesses from the text (ADR 10).
- The output folder belongs to stackledger: it is written whole, with a marker file, and refused when it holds other files, so the command never overwrites a person's notes.
- `--check` writes nothing and exits 1 when the folder is out of date, so a pipeline can fail a pull request that changed skills without updating the map.
- The output is byte-for-byte deterministic: no date, no version, sorted, LF line endings.

## Capabilities

### New Capabilities

- `skills-map-command`: the command, its output folder, the pages, the diagrams and `--check`.

### Modified Capabilities

None. It reads skill sets as `skill-source` defines them.

## Out of scope

- The site pages and the metro map of skills (`skills-site`).
- Relations guessed from the text (a name in backticks, "not for"): the owner's kit draws those with its own script, which keeps working.
- Software used by a skill (`skills-software-links`).
- Diagram formats other than Mermaid, and a single-page map of a whole large set.

## Decisions to confirm at gate 1

1. **A folder owned by stackledger, rewritten whole, with a marker file** (as `stackledger build` does). Recommended: no question of which files are ours, and a stale page for a removed skill disappears. The cost: the folder cannot hold hand-written notes.
2. **Layout: `README.md`, `skills/<name>.md`, `playbooks/<name>.md`, `agents/<name>.md`.** Recommended: a skill and an agent may share a name (the `skill-source` spec allows it), so they need separate folders, and the Git host shows `README.md` when the folder is opened.
3. **Only declared relations.** Recommended: a picture people use to govern skills must be exactly what the files declare; a guess shown as a fact misleads a reviewer. The kit's own script keeps its guessed mentions.
4. **A set with errors is still mapped, exit 0, with the counts on stderr** (as `stackledger build`). Recommended: the map shows what joined the set; failing on errors is `skills validate`'s job, and a pipeline runs both. `--check` fails only on a stale map.
5. **The index draws one diagram of every declared relation**, and lists the items without relations in its tables only. Recommended for skill sets up to a few hundred items; a set with no relations gets no diagram.

## Implicit requirements

- **Errors and invalid input:** requirement. Usage errors and a refused output folder exit 2 with nothing written; a write failure exits 1 and names the file.
- **Limits:** requirement. Names and descriptions come from files a fork's pull request can change: page file names are made safe, Mermaid labels and Markdown text are escaped, and a description over 1,024 characters is cut on the page (the Agent Skills limit; `skills validate` already warns).
- **Repetition and idempotency:** requirement. Running twice on the same files changes nothing; `--check` after a run exits 0.
- **Concurrency:** n/a: one process; two runs on one folder at once are not supported (stated in the docs).
- **Security:** requirement. No absolute path, home folder or path outside the working folder is ever written to a page; control characters are removed; the output folder is never a given folder, and never contains one.
- **Logs and observability:** requirement. stderr says how many pages were written, changed and removed, and the problem counts when there are any.

## Dependencies

`skills-source` and `skills-ignore` (delivered). No new package: Mermaid is text, rendered by the Git host or editor.

## Documentation

- `docs/skills.md`: a "Map in the repository" section (command, layout, what is drawn, the marker, `--check` in CI, which Git hosts and editors render Mermaid).
- `README.md`: the Usage row and one sentence in "Agent skills".
- `AGENTS.md`: implemented list. `docs/roadmap.md`: row 3.
- Brain vault: the stackledger architecture, roadmap and changelog.
