## Purpose
Defines `stackledger skills map`: deterministic Markdown pages with Mermaid diagrams of a skill set's declared relations, written into a folder stackledger owns, for offline reading and pull-request review, and `--check` for pipelines.

## ADDED Requirements

### Requirement: Map command input
`stackledger skills map [folder...] --out <folder> [--check]` SHALL read one skill set from the given folders exactly as `stackledger skills validate` does, the current folder when none is given. A missing or empty `--out`, an unknown option, an `--out` that exists and is not a folder, or a given folder that does not exist or cannot be listed SHALL exit 2 with stderr naming the problem, stdout empty and nothing written.

#### Scenario: Missing out
- **WHEN** the command runs as `stackledger skills map repo` or `stackledger skills map repo --check`
- **THEN** the exit code is 2, stderr says `--out` is required and nothing is written

#### Scenario: Out is a file
- **WHEN** `--out` names an existing regular file
- **THEN** the exit code is 2 and the file is unchanged

#### Scenario: Same set as validate
- **WHEN** folders `repo` and `tool` are given, `repo` ignores `templates/`, `tool/skills/writer` links to `repo/skills/writer`, and `tool/skills/writer2` repeats the name `writer`
- **THEN** the map has one page for `writer`, from `repo`, and none for the template

### Requirement: Map usage text
The global usage text and `stackledger --help` SHALL list `stackledger skills map [folder...] --out <folder> [--check]`. `--help` SHALL win over every other argument, as for the other commands.

#### Scenario: Help
- **WHEN** the command runs as `stackledger skills map --help --bogus`
- **THEN** the exit code is 0 and stdout holds the usage text with the `skills map` line

### Requirement: Inputs the map folder must not touch
After resolving links, the output folder SHALL be refused, with exit 2 and nothing written, when it is or contains a given folder, or the real path of any skill folder, agent file or file read (rejected ones included); is inside such a skill folder; is or is inside a given folder's top-level `agents/`; or has a segment below the current folder or a given folder that starts with `.` or is `openspec`. Names SHALL be compared ignoring case.

#### Scenario: Output is the given folder
- **WHEN** the command runs as `stackledger skills map repo --out repo`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Output holds a linked source
- **WHEN** a given folder `tool` holds `skills/writer`, a link to `repo/map/skills/writer`, and `--out` is `repo/map`
- **THEN** the exit code is 2 and nothing is removed

#### Scenario: Output inside a skill folder
- **WHEN** `--out` is `repo/skills/writer/map` and `repo/skills/writer/SKILL.md` exists
- **THEN** the exit code is 2

#### Scenario: Output in the agents folder
- **WHEN** `--out` is `repo/agents` for the given folder `repo`
- **THEN** the exit code is 2

#### Scenario: Output in a tool folder
- **WHEN** `--out` is `.claude/commands/map`, `OpenSpec/specs/map`, or `../home/.claude/commands/map` with `../home/.claude` given
- **THEN** the exit code is 2

#### Scenario: Output holds a linked source file
- **WHEN** `repo/skills/writer/SKILL.md` is a link to `map/skills/input.md` and `--out` is `map`
- **THEN** the exit code is 2 and `map/skills/input.md` is untouched

#### Scenario: Output inside the given folder
- **WHEN** the command runs in `repo` as `stackledger skills map . --out docs/skills-map` and that folder does not exist
- **THEN** the folder is created with the marker, `.gitattributes`, the index and the pages, and the exit code is 0

### Requirement: Owned entries of the map folder
stackledger SHALL own, in the output folder, the marker `.stackledger-skills-map` (a regular file holding `stackledger skills map` and a newline, LF or CRLF), `.gitattributes` (`* text eol=lf` and a newline), `README.md`, top-level files named `.stackledger-skills-map-*.tmp`, and the whole `skills/`, `playbooks/` and `agents/` subtrees. Every other top-level entry SHALL be left untouched. An existing non-empty folder without a valid marker SHALL be refused with exit 2.

#### Scenario: Unrelated non-empty folder
- **WHEN** `--out` is a folder holding `notes.md` and no marker
- **THEN** the exit code is 2 and `notes.md` is untouched

#### Scenario: Marker that is not valid
- **WHEN** the marker is a folder, a link or holds other text
- **THEN** the exit code is 2 and nothing changes

#### Scenario: Other files kept
- **WHEN** a marked map folder holds `notes.txt` at its top
- **THEN** `notes.txt` is untouched

#### Scenario: Removed skill
- **WHEN** a marked map folder holds `skills/old.md`, `skills/scratch/x.md` and a leftover `.stackledger-skills-map-1.tmp`, and `old` is no longer in the set
- **THEN** all three are removed, and `--check` before the run lists them as `remove`

#### Scenario: Stray spelling on a case-insensitive disk
- **WHEN** on a case-insensitive file system a marked map folder holds `skills/Writer.md` and the set has `writer`
- **THEN** after the run `skills/writer.md` exists with the current page, and `--check` exits 0

### Requirement: Writing without following links
An owned entry that is a symbolic link SHALL be refused with exit 2 when it is the marker, `.gitattributes`, `README.md` or a kind folder, and removed without being followed anywhere below a kind folder. A page SHALL be written to a new file in its folder and renamed into place, never written through an existing entry. The command SHALL write only inside the output folder and open no network connection.

#### Scenario: Linked kind folder
- **WHEN** `skills` in a marked map folder is a link to another folder
- **THEN** the exit code is 2 and the link's target is untouched

#### Scenario: Linked page
- **WHEN** `skills/writer.md` in a marked map folder is a link to a file outside it
- **THEN** the target is unchanged and `skills/writer.md` is a regular file

#### Scenario: Hard-linked page
- **WHEN** `skills/writer.md` is a hard link to a file outside the map folder and the page changes
- **THEN** the outside file is unchanged

#### Scenario: Writes stay in the map folder
- **WHEN** the command runs under the Node permission model with writes allowed only in `--out`
- **THEN** it exits 0

### Requirement: Folder changed during the run
The device and inode of the output folder and of each kind folder, or their absence, SHALL be recorded when checked and compared again before each change; any difference, and any entry that vanishes or appears while the folder is compared or written, SHALL stop the run with exit 1, naming the folder, with no usage text.

#### Scenario: Folder swapped
- **WHEN** the output folder is replaced by another folder between the check and the first write
- **THEN** the exit code is 1 and neither folder is changed

#### Scenario: Kind folder appears as a link
- **WHEN** `skills/` did not exist at the check and a link named `skills` to another folder appears before the first write
- **THEN** the exit code is 1 and the link's target is unchanged

#### Scenario: Page that cannot be read
- **WHEN** an existing page cannot be read and its content changes
- **THEN** it is replaced by rename and the exit code is 0

### Requirement: Page file names
A name SHALL be the page's file name when it matches `^[a-z0-9]+(-[a-z0-9]+)*$`, has at most 64 characters and is not a Windows device name (`con`, `prn`, `aux`, `nul`, `com0`–`com9`, `lpt0`–`lpt9`). Any other name SHALL be written as `_` and the lowercase hexadecimal of its UTF-8 bytes; when that has more than 64 characters, its first 52 characters, `-`, and the first 11 hexadecimal digits of the SHA-256 of those bytes.

#### Scenario: Name with a path
- **WHEN** a skill is named `../writer`
- **THEN** its page is `skills/_2e2e2f777269746572.md` and nothing is written outside the map folder

#### Scenario: Names that differ only in case
- **WHEN** a skill is named `Writer` and another `writer`
- **THEN** the pages are `skills/_577269746572.md` and `skills/writer.md`

#### Scenario: Windows device name
- **WHEN** a skill is named `con`
- **THEN** its page is `skills/_636f6e.md`

#### Scenario: Long name
- **WHEN** a skill is named with 65 `a` characters
- **THEN** its page is `skills/_616161616161616161616161616161616161616161616161616-635361c48bb.md`

### Requirement: One page per item
Two items of one kind whose page file names are equal (a hash collision, or names that are not valid Unicode and encode alike) SHALL stop the command with exit 1 before anything is written, naming both items' source files.

#### Scenario: Colliding page names
- **WHEN** two skills with long names give the same page file name
- **THEN** the exit code is 1, stderr names both `SKILL.md` files, and nothing is written

### Requirement: Declared relations only
The map SHALL draw only declared relations: `loads` from a skill or playbook to each skill or playbook in its `stackledger-skills`, `uses` to each agent in its `stackledger-agents`, and `preloads` from an agent to each skill or playbook in its `skills`. A relation to a name not in the set SHALL NOT be drawn, and repeats SHALL be drawn once. Nothing SHALL be drawn from the text of a file.

#### Scenario: Name in the text
- **WHEN** a skill's body names another skill in backticks and declares no relation
- **THEN** its page has no relation to that skill

#### Scenario: Missing relation target
- **WHEN** a playbook lists `ghost` in `stackledger-skills` and there is no such skill
- **THEN** no page shows `ghost`

#### Scenario: Same name in two namespaces
- **WHEN** a playbook loads `reviewer` and uses `reviewer`, and both a skill and an agent are named `reviewer`
- **THEN** its page links `skills/reviewer.md` for `loads` and `agents/reviewer.md` for `uses`

#### Scenario: Repeated preload
- **WHEN** an agent lists `writer` twice in `skills`
- **THEN** one `preloads` relation is drawn

### Requirement: Item page
Each item page SHALL hold, in order: `# <name>`, a notice that `stackledger skills map` generated it, the kind, the description, a legend, the one-hop diagram, "Brought in by" and "Brings in" lists (relation kind and a link to the other page), "Reached through" (items that bring it in through two or more relations), its rule IDs in file order, its source files, and a link to `README.md`.

#### Scenario: Playbook page
- **WHEN** the playbook `release` loads `writer` and `editor` and uses the agent `reviewer`
- **THEN** `playbooks/release.md` lists under "Brings in" `editor` (loads), `reviewer` (uses) and `writer` (loads), each linked

#### Scenario: Skill page
- **WHEN** the skill `writer` is loaded by `release`, preloaded by the agent `drafter`, and its `rules.md` defines `WR-1` and `WR-2`
- **THEN** `skills/writer.md` lists under "Brought in by" `drafter` (preloads) and `release` (loads), and lists `WR-1, WR-2`

#### Scenario: Reached through a playbook
- **WHEN** the playbook `ship` loads the playbook `release`, which loads `writer`
- **THEN** `skills/writer.md` lists `ship` under "Reached through" and not under "Brought in by"

### Requirement: Order of relations
Lists and tables SHALL be sorted by name, then kind (skill, playbook, agent), comparing by code point. Diagram nodes SHALL be listed by kind then name, and edges by source node, relation kind and target node.

#### Scenario: Listing order does not matter
- **WHEN** the same files are read through a folder listing that returns entries in reversed order
- **THEN** every page is byte for byte the same

### Requirement: One-hop diagram
Each item page SHALL hold one `mermaid` block, a `flowchart LR` with the item (thick border) and its direct relations: what brings it in on the left, what it brings in on the right. A neighbour on both sides SHALL appear on both; a relation to itself SHALL be a loop on the item. Playbooks SHALL be rounded boxes, agents hexagons, skills plain boxes.

#### Scenario: Diagram of a skill
- **WHEN** the skill `writer` is loaded by `release`
- **THEN** the diagram has a rounded node `release`, a plain node `writer` with a thick border and one edge labelled `loads` from `release` to `writer`

#### Scenario: Two playbooks that load each other
- **WHEN** `a` loads `b` and `b` loads `a`
- **THEN** `b` appears on both sides of `a`'s diagram, with one `loads` edge each way

#### Scenario: Skill that lists itself
- **WHEN** `writer` lists `writer` in `stackledger-skills`
- **THEN** its diagram has one `loads` edge from `writer` to itself

### Requirement: Stable node IDs
A node ID SHALL be `s_`, `p_` or `a_` (skill, playbook, agent) followed by the page file name without `.md`, with `-` written as `_`; in a one-hop diagram, neighbours SHALL start with `in_` or `out_`. So adding an item SHALL change only the lines about it.

#### Scenario: New skill in a diff
- **WHEN** a skill `aardvark` loaded by `release` is added to a set that already maps `release`
- **THEN** the index diagram gains only the lines of the `s_aardvark` node and its edge

#### Scenario: Node names are not IDs
- **WHEN** a skill is named `end`, a Mermaid keyword
- **THEN** its node ID is `s_end`, its label is `end`, and the block renders

### Requirement: Diagram budget
A label SHALL show at most 64 code points of the name, then `…`. A diagram SHALL be drawn only when it has at most 400 edges and its block has at most 40,000 characters; otherwise the page SHALL say `This set has <N> relations, too many for one diagram; the lists below hold them all.` in its place.

#### Scenario: Index at the edge budget
- **WHEN** the set has exactly 400 relations
- **THEN** the index has a diagram with 400 edges

#### Scenario: Index over the edge budget
- **WHEN** the set has 401 relations
- **THEN** the index has no `mermaid` block, says it has 401 relations, and its tables list every relation

### Requirement: Map index
`README.md` SHALL hold the generated notice; a note that only declared relations are drawn; the counts of skills, playbooks, agents, rules, ignored entries, errors and warnings with a hint to run `stackledger skills validate`; a legend; one `flowchart LR` of every drawn relation, within the budget; tables of playbooks, agents and skills with what each brings in and what brings it in; and "No declared incoming relations", the skills and playbooks nothing brings in.

#### Scenario: Index tables
- **WHEN** the set has 2 playbooks, 1 agent and 5 skills
- **THEN** `README.md` has tables with 2, 1 and 5 rows, sorted by name

#### Scenario: Set with no relations
- **WHEN** no item declares a relation
- **THEN** `README.md` has no `mermaid` block and lists every skill and playbook under "No declared incoming relations"

#### Scenario: Errors recorded in the index
- **WHEN** one skill has no description
- **THEN** `README.md` gives 1 error and the validate hint

### Requirement: Text from the files
Descriptions SHALL have whitespace runs made one space, control and format characters (Unicode `Cf`, tag characters included) removed, and be cut to 1,023 code points and `…` when over 1,024. In Markdown, `\`, `` ` ``, `*`, `_`, `[`, `]`, `<`, `>`, `|`, `#`, `&`, `~`, a leading `-` or `+`, the `.` of a leading number, `:` after a URL scheme and `.` after `www` SHALL be escaped with `\`, and `$` written as `<span>$</span>`.

#### Scenario: Description with HTML
- **WHEN** a description holds `<img src=x onerror=alert(1)>`
- **THEN** the page source holds `\<img src=x onerror=alert(1)\>` and every `<` from the description is preceded by `\`

#### Scenario: Multi-line description with a fence
- **WHEN** a `|` description has the lines `First line.`, `~~~` and `Last line.`
- **THEN** the page holds `First line. \~\~\~ Last line.` on one line, and the diagram after it is intact

#### Scenario: Description that would link or render math
- **WHEN** a description is `- see https://evil.example and www.evil.example for $\color{red}{FAKE}$`
- **THEN** the page holds `\- see https\://evil.example and www\.evil.example`, every `$` is written as `<span>$</span>`, and GitHub's Markdown renderer makes no link, list or math from it

#### Scenario: Description at the limit
- **WHEN** descriptions have 1,024 and 1,025 code points
- **THEN** the first is shown whole and the second as its first 1,023 code points and `…`

### Requirement: Mermaid labels
In a Mermaid label, every character other than ASCII letters, digits, space and `-_.:/()` SHALL be written as `#<decimal code point>;`, after control and format characters are removed.

#### Scenario: Label that tries to close the node
- **WHEN** a skill is named `a"]; click n1 "https://example.com`
- **THEN** the label holds `#34;`, `#93;` and `#59;`, no line of the block starts with `click`, and the block renders with the name as text

### Requirement: Source files
An item's source files SHALL be its `SKILL.md` and the `rules.md` read for it, or its agent file. A page SHALL link one only when it and the map folder are inside the current folder (real paths), as a relative URL with `/` and percent-encoded segments; otherwise it SHALL show the path below its given folder and why it is not linked. No path the command computes SHALL be absolute.

#### Scenario: Skill in the repository
- **WHEN** the command runs in `repo` as `stackledger skills map . --out docs/skills-map` and `skills/writer/SKILL.md` exists
- **THEN** `docs/skills-map/skills/writer.md` links `../../../skills/writer/SKILL.md`

#### Scenario: Tool folder in the home folder
- **WHEN** the command runs in `repo` as `stackledger skills map . /home/northwind/.claude --out docs/skills-map`
- **THEN** pages for skills under `/home/northwind/.claude` show `skills/<name>/SKILL.md`, "outside the current folder", and no `/home/northwind`

#### Scenario: Map folder outside the current folder
- **WHEN** the command runs in `stackledger` as `stackledger skills map ../repo --out ../repo/docs/skills-map`
- **THEN** the pages show `skills/writer/SKILL.md` without a link and say the map folder is outside the current folder

#### Scenario: Folder name with special characters
- **WHEN** a skill folder in the repository is named `my skill#1`
- **THEN** its link is `../../../skills/my%20skill%231/SKILL.md`

### Requirement: Deterministic map
The same files SHALL give the same bytes on any machine and platform: no date, version or time, the orders stated above, `/` in every link, LF line endings and one newline at the end of each file. `--check` SHALL compare after turning CRLF into LF.

#### Scenario: Two runs
- **WHEN** the command runs twice on the same files
- **THEN** the second run changes no file and stderr says nothing changed

#### Scenario: Checkout with CRLF
- **WHEN** every page in the map folder has CRLF line endings and is otherwise up to date
- **THEN** `--check` exits 0

### Requirement: Check mode
With `--check`, the command SHALL write nothing, print on stderr one line per page that would be created, updated or removed (`create`, `update` or `remove`, a space, and its path inside the map folder), and exit 1 when there is any, 0 otherwise. The folder rules SHALL apply; a missing output folder SHALL be out of date.

#### Scenario: Stale map in a pipeline
- **WHEN** a skill gained a relation after the map was written, and the command runs with `--check`
- **THEN** the exit code is 1, stderr has an `update` line for each changed page, and no file changes

#### Scenario: Up to date
- **WHEN** the command runs with `--check` right after a run without it
- **THEN** the exit code is 0

### Requirement: Map exit codes and messages
Without `--check`, the command SHALL exit 0 when the map was written; 1 when a given folder has the "No skill folder or agent file found" error (nothing changed), when the folder changed during the run, or when a file cannot be written or removed (naming it); 2 for usage errors and refused folders. stderr SHALL give the pages created, updated and removed and, with problems, their counts and the validate hint; stdout stays empty.

#### Scenario: Set with errors
- **WHEN** one skill has no description and the rest are valid
- **THEN** the map is written without that skill, the exit code is 0, and stderr gives the error count and the hint

#### Scenario: Wrong folder does not empty the map
- **WHEN** a marked map exists and the command is given a folder with nothing found in it
- **THEN** the exit code is 1 and no page is removed
