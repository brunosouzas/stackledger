## Context

`readSkillSet` (src/skills/source.ts) returns the skills and playbooks with their declared `skills` and `agents`, the agents with their `preloads`, the rules of each skill, the problems and the ignored entries. It does not keep descriptions, the given folder of each item, or the real paths the walk met; this change adds them without changing what `skills validate` prints. `stackledger build` already owns an output folder safely (src/site/command.ts). The kit's `kit.py map` writes similar pages for one repository, with relations guessed from the text; this command is the general, declared-only version.

## Decisions

### 1. One graph, two renderers later

A pure function turns a skill set into a graph: nodes keyed by kind and name, and edges `loads` (from `stackledger-skills`, to a skill or playbook), `uses` (from `stackledger-agents`, to an agent) and `preloads` (an agent's `skills`, to a skill or playbook). Edges to names not in the set are dropped, because `skills validate` reports them; repeats are kept once; a self-relation and cycles are kept. "Reached through" is a breadth-first walk over incoming edges, safe with cycles. The Mermaid writer renders this graph; `skills-site` will render the same graph as SVG, so the two can never disagree.

### 2. Pages

`README.md`: the notice, a note that only declared relations are drawn (a declaration is not proof that a tool loads the skill), the counts with a hint to run `skills validate`, a legend, one diagram, tables of playbooks, agents and skills, and "No declared incoming relations" (not called "unused": a person may load a skill by hand). Each item page: title, notice, kind, description, legend, one-hop diagram, "Brought in by", "Brings in", "Reached through", rule IDs, source files and a link back.

The one-hop diagram is a `flowchart LR` (supported by GitHub, GitLab and VS Code): the item with a thick border, what brings it in on the left, what it brings in on the right. A neighbour on both sides appears twice, as `in_` and `out_` nodes, as in the kit's pages. Playbooks are rounded boxes, agents hexagons, skills plain boxes.

### 3. Stable node IDs

Node IDs come from the page file name: `s_`, `p_` or `a_` and the file name stem with `-` as `_` (`s_code_review`, `s__577269746572`). Valid names never hold `_` and hexadecimal names start with `_`, so IDs are unique, never a Mermaid keyword, and stay the same when other items are added: a pull request that adds one skill changes only the lines about it. Numbered IDs were rejected for that reason. Nodes are listed by kind then name and edges by source, kind and target.

### 4. Diagram budget

Mermaid 11 (as used by GitHub and the mermaid CLI) refuses more than 500 edges and about 50,000 characters of text by default, measured in the spec review. The budget is 400 edges and 40,000 characters per block, with room for host differences; labels are cut at 64 code points, because one non-ASCII character becomes up to eight characters as an entity. Over the budget, the page states the number of relations and the tables keep every one.

### 5. Text from the files is untrusted

Names, descriptions, rule IDs and folder names come from files a fork can change, and pages are rendered by Git hosts. Descriptions are made one line (whitespace runs become one space, so a `|` block cannot open a fence or a code block), control and Unicode format characters are removed (so bidirectional overrides cannot mislead a reviewer), then cut, then Markdown-escaped, `~` included. Mermaid labels write everything outside a small safe set as `#<code>;` entities, which Mermaid renders as text. Link targets are pages this command names, or source paths it computes and percent-encodes, never text from a file.

Page file names: a valid Agent Skills name (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters) that is not a Windows device name is used as it is; anything else becomes `_` and hexadecimal UTF-8, cut at 52 characters plus `-` and 11 hexadecimal digits of SHA-256 when longer than 64. Every file name is lowercase ASCII, so case-insensitive file systems cannot merge two pages, and every one checks out on Windows.

### 6. Paths never leak

An item's source files are its `SKILL.md` and the `rules.md` read for it, or its agent file; other resources in a skill folder are not listed (a folder listing would pick up `.DS_Store` and editor files). A page links a source file only when its real path is inside the real path of the current folder and a relative path exists (not across Windows volumes), with `/` separators and percent-encoded segments. Otherwise it shows the path below its given folder. The command never computes an absolute path into a page; a description that contains one is the author's text.

### 7. The output folder

Checks, after resolving links, before any write (exit 2): the output folder is not and does not contain a given folder or the real path of any skill folder or agent file the walk found, rejected ones included (a tool folder's link can point into the map folder, and cleaning would delete the source); it is not inside such a skill folder; it is not, nor inside, the top-level `agents/` of a given folder (its `README.md` would be read as an agent); it has no segment below the current folder that starts with `.` (tool folders such as `.claude/commands` load Markdown as instructions) or is named `openspec`. An existing folder is either empty or holds a valid marker; the marker, `.gitattributes`, `README.md` and the kind folders are not links.

Writes: each changed file is written to a new temporary file in its folder and renamed into place, so a link or hard link at a page path is replaced, never written through, and a page is never left half-written. Entries below a kind folder that are not current pages are removed without following links. The output folder's and kind folders' device and inode numbers are checked again right before the first change. There is no atomic swap of the whole folder: after an interrupted run, run the command again (or restore with Git).

`.gitattributes` holds `* text eol=lf`, so a Windows checkout keeps LF, and `--check` turns CRLF into LF before comparing anyway, for checkouts made before the file existed.

### 8. `--check` and exit codes

`--check` computes the same files, applies the same folder checks, writes nothing, prints `create`, `update` or `remove` and the path for each difference, and exits 1 when there is any. Without it: 0 when written, whatever the set's problems; 1 when a given folder has nothing found (nothing changed), when a folder changed during the run, or on a write failure; 2 for usage and refused folders.

## Risks

- Hosts differ: GitHub, GitLab and VS Code render `mermaid` fences; Bitbucket Cloud and Azure Repos files do not, and Azure DevOps wikis do not support `flowchart`. The lists and tables carry everything, so the pages stay useful as text; the docs say so.
- A skill set near the budget gives a dense diagram; the tables remain the reference.
