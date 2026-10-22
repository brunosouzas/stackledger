## Context

`readSkillSet` (src/skills/source.ts) returns the skills and playbooks with their declared `skills` and `agents`, the agents with their `preloads`, the rules of each skill, the problems and the ignored entries. `stackledger build` already owns an output folder safely (src/site/command.ts: refused when it is or holds the catalogue, or is non-empty without its marker). The kit's `kit.py map` writes similar pages for one repository, with relations guessed from the text; this command is the general, declared-only version.

## Decisions

### 1. One graph, two renderers later

A pure function turns a skill set into a graph: nodes (skill, playbook, agent, keyed by kind and name) and edges with a kind: `loads` (from `stackledger-skills`), `uses` (from `stackledger-agents`) and `preloads` (an agent's `skills`). Edges to names that are not in the set are dropped, because `skills validate` already reports them. The Mermaid writer renders this graph; `skills-site` will render the same graph as SVG, so the two can never disagree.

### 2. Pages

`README.md` holds the counts, one diagram of every edge, and one table each for playbooks, agents and skills (name linked to its page, what it loads or preloads, what brings it in). Each item page holds: a title (the name), the generated-file notice, the description, a one-hop diagram, "Brought in by" and "Brings in" lists with links, the rule IDs, the source files, and a link back to the index.

The one-hop diagram is a `flowchart LR`: the item in the middle with a thick border, what brings it in on the left, what it brings in on the right. Playbooks are rounded boxes, agents hexagons, skills plain boxes, as in the kit's pages, so the article can show both. Node IDs are generated (`n1`, `n2`, … in drawing order), never names, so a name cannot break the diagram syntax.

### 3. Text from the files is untrusted

Names, descriptions and rule IDs come from files a fork can change, and the pages are rendered by Git hosts. So: control characters are removed (as everywhere); in Mermaid labels `"` and characters outside printable ASCII letters, digits and `-_ .:/()` are written as Mermaid entity codes (`#34;`); in Markdown, `\`, `` ` ``, `*`, `_`, `[`, `]`, `<`, `>`, `|`, `#` and `&` are escaped; a description longer than 1,024 code points is cut and ends with `…`. Link targets are always pages this command wrote, or source files, never text from a file.

Page file names: a name that follows the Agent Skills rule (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters) is used as it is; any other name is written as `_` followed by the hexadecimal UTF-8 bytes of the name, cut to 64 bytes, and a short hash of the full name when cut. Every file name is then lowercase ASCII, so case-insensitive file systems (macOS, Windows) cannot merge two pages.

### 4. Paths never leak

Source paths in the set are display paths, which may be absolute (a tool folder in the home folder). A page links a source file only when its real path is inside the working folder, as a path relative to the page; otherwise it shows the file name and "outside the working folder". No page holds an absolute path.

### 5. The output folder

The output folder is resolved through links, then refused (exit 2, nothing written) when it is a given folder, contains one, or is inside a skill folder of the set; when it exists, is non-empty and has no marker `.stackledger-skills-map` (a regular file with fixed content); or when the marker, `README.md`, `skills`, `playbooks` or `agents` in it is a symbolic link. Inside an accepted folder, the command writes each page only when its content differs, removes every other entry under `skills/`, `playbooks/` and `agents/`, and never touches anything else. There is no atomic swap: the folder is meant to be committed, so Git restores it after an interrupted run; the docs say so.

Being inside a given folder is allowed (the usual `docs/skills-map/` of a skills repository), because generated pages are never named `SKILL.md`, and agent files are only read from the top-level `agents/` of a given folder, which the output folder can never be.

### 6. `--check`

`--check` computes the same files and compares them with the folder, writing nothing. It exits 1 and lists, one per line on stderr, each page that would be written, changed or removed; it exits 0 when nothing would change. The folder safety checks apply, except that a missing folder is simply out of date.

### 7. Exit codes

0 when the map was written (or is up to date with `--check`), whatever the set's problems; 1 for a stale map with `--check` or a write failure; 2 for usage errors and refused folders. Problems in the set are counted on stderr with a hint to run `stackledger skills validate`.

## Risks

- A very large set gives a large index diagram that some renderers refuse (GitHub draws up to a few hundred edges). The pages still work; the docs say so.
- Azure Repos and some editors render Mermaid only with a plugin or a different fence; the pages stay readable as text.
