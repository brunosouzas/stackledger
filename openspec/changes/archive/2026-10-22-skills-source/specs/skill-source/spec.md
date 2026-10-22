## Purpose

Defines how stackledger finds and reads agent skills, playbooks, agents and rules in folders, which relations it reads, and which problems a skill set can have.

## ADDED Requirements

### Requirement: Skill set
A skill set SHALL be the skills, playbooks, agents and rules read from one or more given folders, in the order the folders are given: what one agent would see. Reading SHALL only read files: nothing is created, changed or deleted, and nothing is sent over the network.

#### Scenario: Two folders form one set
- **WHEN** folder `a` holds skill `writer` and folder `b` holds a playbook whose `stackledger-skills` is `writer`
- **THEN** both are read into one set and the playbook's relation finds `writer`

#### Scenario: Read-only
- **WHEN** a set is read
- **THEN** the hash and modification time of every file in the given folders are the same before and after

#### Scenario: Write-protected run
- **WHEN** the command runs under Node's permission model with file reads allowed and no write or child-process permission
- **THEN** its output and exit code equal those of an unrestricted run

#### Scenario: Network not used
- **WHEN** the source files of the skill reading and the command are inspected
- **THEN** none imports `node:http`, `node:https`, `node:net`, `node:tls`, `node:dns` or `node:dgram`, or calls `fetch`

### Requirement: Files and links
A file SHALL be an entry that is a regular file or a symbolic link to a regular file; a file link SHALL be read at the link's path. A given folder that is a symbolic link SHALL be followed. Folder links met by the walk follow "Symbolic links to folders". Two entries SHALL be the same item when their targets have the same device and inode numbers.

#### Scenario: Linked SKILL.md
- **WHEN** folder `writer` holds `SKILL.md` as a link to a regular file
- **THEN** `writer` is a skill folder and its problems use the path `writer/SKILL.md`

#### Scenario: Linked given folder
- **WHEN** the given folder is a link to a folder holding skills
- **THEN** the skills are read and paths start with the argument as given

### Requirement: Finding skill folders
A folder holding a file named exactly `SKILL.md` SHALL be a skill folder. Each given folder SHALL be walked depth first, entries in code-point order of their names, at most five levels below it. An entry below the given folder named `node_modules` or starting with `.` SHALL be skipped before any other check, link or not, with no problem. The walk SHALL NOT enter a skill folder. When the given folder is itself a skill folder, it SHALL give that one skill.

#### Scenario: Grouped skills
- **WHEN** a given folder holds `skills/developer/java/SKILL.md` and `skills/developer/developer/SKILL.md`
- **THEN** both skills are read

#### Scenario: Resources are not skills
- **WHEN** a skill folder `writer` holds `examples/draft/SKILL.md`
- **THEN** only `writer` is read

#### Scenario: Depth limit
- **WHEN** a `SKILL.md` lies in a folder six levels below the given folder (`a/b/c/d/e/f/SKILL.md`)
- **THEN** it is not read and there is no problem, and one in a folder five levels below (`a/b/c/d/e/SKILL.md`) is read

#### Scenario: Hidden and dependency folders
- **WHEN** a given folder holds `.git/x/SKILL.md` and `node_modules/x/SKILL.md`
- **THEN** neither is read and there is no problem

#### Scenario: Hidden link to a skill
- **WHEN** `.cache` and `node_modules` are links to skill folders
- **THEN** neither is read and there is no problem

#### Scenario: Given folder is a hidden tool folder
- **WHEN** the given folder is `.claude` and it holds `skills/writer/SKILL.md`
- **THEN** `writer` is read

#### Scenario: A single skill
- **WHEN** the given folder itself holds `SKILL.md` and an `agents` folder with `helper.md`
- **THEN** that folder gives one skill and no agent

### Requirement: Symbolic links to folders
A symbolic link to a folder holding a `SKILL.md` SHALL be read as a skill folder found at the link's path, without walking into it. A link to a file SHALL be read only where that file is expected and otherwise ignored, like any file. Every other link (to a folder without `SKILL.md`, broken, looping, or to neither a file nor a folder) SHALL get one warning on its path and SHALL NOT be followed. So the walk never loops.

#### Scenario: Tool folder made of links
- **WHEN** `.claude/skills/writer` is a link to a folder holding `SKILL.md`
- **THEN** `writer` is read and its problems use the path `.claude/skills/writer/SKILL.md`

#### Scenario: Link to a plain folder
- **WHEN** `skills/shared` is a link to a folder with sub-folders holding skills
- **THEN** no skill under it is read and there is one warning on `skills/shared`

#### Scenario: Broken link
- **WHEN** `skills/old` is a link to a path that does not exist
- **THEN** there is one warning on `skills/old` and the rest of the set is read

#### Scenario: Link to a file elsewhere
- **WHEN** `skills/LICENSE` is a link to a regular file outside the given folder
- **THEN** it is not read and there is no problem

#### Scenario: Link loop
- **WHEN** `skills/a` links to `skills/b` and `skills/b` links to `skills/a`
- **THEN** each gets one warning saying the link loops, and the command finishes

### Requirement: One read per item
A skill folder or agent file reached more than once (through a link and directly, or from two given folders) SHALL be read once, at the first path in walk order, with no problem. Walk order SHALL be the folders in argument order, each walked as in "Finding skill folders". Copies (separate files with the same content) are different items.

#### Scenario: Linked copy of a repository skill
- **WHEN** folders `repo` and `tool` are given and `tool/skills/writer` links to `repo/skills/writer`
- **THEN** `writer` is read once, with the path under `repo`, and there is no duplicate-name error

### Requirement: Folders that cannot be read
A folder below a given folder that cannot be listed, or a linked skill folder that cannot be read, SHALL be an error at `1:1` on its path; the rest of the set SHALL still be read. A given folder that cannot be read is a command failure, defined by the command.

#### Scenario: Unlistable sub-folder
- **WHEN** `skills/private` cannot be listed
- **THEN** there is one error on `skills/private` and the other skills are read

### Requirement: Order of checks in one file
Each `SKILL.md` and agent file SHALL get its own checks in this order, an error at a step stopping the later ones: (1) size and readability; (2) secret rules on the raw text; (3) frontmatter shape; (4) secret rules on every decoded frontmatter key and string; (5) `name` and `description`, both reported; (6) the other field checks of this file, all reported. Only a file with no error from these SHALL be a candidate for the set.

#### Scenario: Secret and no frontmatter
- **WHEN** a `SKILL.md` has no frontmatter and holds private-key material
- **THEN** there is exactly one error, the secret one, and the skill is not in the set

#### Scenario: Escaped card number
- **WHEN** a playbook has `stackledger-skills: "411111111111111\u0031"`, whose raw text holds no card number
- **THEN** there is exactly one error, the secret one, and no output line holds the decoded number

#### Scenario: Several field problems
- **WHEN** a skill has `stackledger-kind: process` and a 1025-code-point description
- **THEN** both problems are reported and the skill is not in the set

#### Scenario: Name and description both missing
- **WHEN** a `SKILL.md` frontmatter is `{}`
- **THEN** there are two errors, for `name` and `description`

### Requirement: Checks across items
After the own checks, a later candidate whose name an earlier candidate already uses SHALL be rejected (see "Unique names"); the remaining candidates SHALL be the set, fixed from then on. Relation targets, agent preloads and rule IDs across skills SHALL then be checked against that set; their problems SHALL NOT remove an item from it. A rejected file's values never reach another item's message.

#### Scenario: Target excluded by an error
- **WHEN** a playbook names `editor` and `editor`'s `SKILL.md` has no frontmatter
- **THEN** there is an error on the playbook naming `editor`, besides the error on `editor`'s file

#### Scenario: Cascading relations
- **WHEN** playbook `a` lists skill `b`, and `b` lists `missing`, which is not in the set
- **THEN** there is one error, on `b`, and the summary counts both `a` and `b`

### Requirement: Frontmatter
A `SKILL.md` SHALL start with a line `---`, after an optional UTF-8 byte-order mark, and the frontmatter SHALL end at the next line `---`; the text between SHALL be one YAML mapping without duplicate keys. Line endings MAY be LF or CRLF. Otherwise the file SHALL get exactly one error at `1:1`.

#### Scenario: No frontmatter
- **WHEN** a `SKILL.md` starts with `# Writer`
- **THEN** there is one error at `1:1` and the skill is not in the set

#### Scenario: Invalid YAML
- **WHEN** the frontmatter has a duplicate key and a syntax error
- **THEN** there is exactly one error at `1:1` on that file and the skill is not in the set

#### Scenario: Frontmatter never closed
- **WHEN** a `SKILL.md` starts with `---` and has no second `---` line
- **THEN** there is one error at `1:1`

#### Scenario: CRLF and byte-order mark
- **WHEN** a valid `SKILL.md` starts with a byte-order mark and uses CRLF line endings
- **THEN** it is read with no problem

### Requirement: Name and description
`name` and `description` SHALL be non-empty strings; a missing, empty or non-string value SHALL be an error with that field, at `1:1` when missing. A skill's identity SHALL be its `name`, compared by code point, because tools load a skill by its exact name.

#### Scenario: Missing description
- **WHEN** a `SKILL.md` has `name: writer` and no `description`
- **THEN** there is an error with field `description` at `1:1` and `writer` is not in the set

#### Scenario: Name not a string
- **WHEN** a `SKILL.md` has `name: 42`
- **THEN** there is an error with field `name`

### Requirement: Agent Skills specification checks
Each SHALL be a warning with its field: a `name` that, after NFKC normalisation, is over 64 code points, has an upper-case letter, holds anything but Unicode letters, digits and hyphens, starts or ends with `-`, or holds `--`; a `name` unlike the folder or link name where the skill was found; a `description` over 1024 code points or `compatibility` not a 1–500 code-point string, both counted without normalisation; `license` or `allowed-tools` not a string.

#### Scenario: Upper-case name
- **WHEN** a skill has `name: Writer` in folder `Writer`
- **THEN** there is a warning with field `name` and the skill is in the set as `Writer`

#### Scenario: Name differs from the folder
- **WHEN** a skill in folder `writing` has `name: writer`
- **THEN** there is a warning with field `name` naming the folder

#### Scenario: Ligatures in a description
- **WHEN** a description is 342 times the character `ﬃ` (1,026 code points after NFKC)
- **THEN** there is no problem

#### Scenario: Description at the limit
- **WHEN** a description has 1024 code points, one of them an emoji
- **THEN** there is no problem, and with 1025 code points there is one warning with field `description`

### Requirement: Fields outside the specification
Top-level fields other than `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools` SHALL give one warning per skill, at `1:1` with no field, naming them in code-point order. A `metadata` that is not a mapping, a `metadata` key that is not a string (warned at the key, its field written from the key's text), or a value that is not a string under a key not starting with `stackledger-` in any letter case, SHALL be a warning with its field.

#### Scenario: Tool-specific fields
- **WHEN** a skill has top-level `version`, `author` and `aliases`
- **THEN** there is exactly one warning, naming `aliases`, `author` and `version`

#### Scenario: Number as a metadata key
- **WHEN** a skill has `metadata` with the key `42` (a YAML integer) and the value `note`
- **THEN** there is a warning at the key with field `metadata.42`

#### Scenario: Nested metadata
- **WHEN** a skill has `metadata.hermes` set to a mapping
- **THEN** there is a warning with field `metadata.hermes`

### Requirement: Relation keys
Keys in `metadata` starting with `stackledger-` in any letter case SHALL be only `stackledger-kind`, `stackledger-skills` and `stackledger-agents` (exact case), each with a string value. Any other such key SHALL be one error at the key; a non-string value, one error at the value. `stackledger-kind` SHALL be `skill` or `playbook` (exact case); absent means `skill`.

#### Scenario: Playbook
- **WHEN** a skill has `metadata.stackledger-kind: playbook`
- **THEN** it is read as a playbook

#### Scenario: Typo in a key
- **WHEN** a skill has `metadata.stackledger-skill: writer`
- **THEN** there is one error with field `metadata.stackledger-skill` at the key

#### Scenario: Unknown key with a list value
- **WHEN** a skill has `metadata.Stackledger-Uses` set to a YAML list
- **THEN** there is exactly one error, at the key

#### Scenario: Unknown kind
- **WHEN** a skill has `metadata.stackledger-kind: process`
- **THEN** there is an error with field `metadata.stackledger-kind`

#### Scenario: List instead of a string
- **WHEN** a skill has `metadata.stackledger-skills` set to a YAML list
- **THEN** there is an error with field `metadata.stackledger-skills` saying it must be names separated by spaces

### Requirement: Declared relations
Skills and playbooks MAY declare `stackledger-skills` and `stackledger-agents`, read as names separated by whitespace (spaces, tabs, line breaks); a blank string declares none. Each distinct name not in the set as a skill or playbook (for `stackledger-skills`) or as an agent (for `stackledger-agents`) SHALL be one error with the field, naming it.

#### Scenario: Missing skill
- **WHEN** a playbook has `stackledger-skills: writer editr` and the set has no `editr`
- **THEN** there is one error with field `metadata.stackledger-skills` naming `editr`

#### Scenario: Missing agent
- **WHEN** a playbook has `stackledger-agents: reviewer` and the set has no agent `reviewer`
- **THEN** there is one error with field `metadata.stackledger-agents` naming `reviewer`

#### Scenario: Names on several lines
- **WHEN** `stackledger-skills` is a YAML block holding `writer` and `editor` on two lines, both in the set
- **THEN** both relations are read and there is no problem

### Requirement: Repeated and self relations
A name listed more than once in one relation SHALL give one warning, and a skill or playbook listing itself in `stackledger-skills` SHALL give one warning; these come in addition to the missing-name error when the name is also missing.

#### Scenario: Repeated name
- **WHEN** a playbook has `stackledger-skills: writer  writer`
- **THEN** there is one warning and no error

#### Scenario: Missing name repeated
- **WHEN** a playbook has `stackledger-skills: editr editr` and the set has no `editr`
- **THEN** there is one error and one warning

### Requirement: Agent files
Each file ending in `.md` directly in an `agents` folder at the top of a given folder that is not a skill folder SHALL be checked as an agent, with the frontmatter rules of `SKILL.md`, except that a file with no frontmatter block SHALL get one warning and not be an agent. `name` and `description` SHALL be non-empty strings, or the file SHALL get an error. Other fields SHALL give no problem.

#### Scenario: Claude Code subagent
- **WHEN** `agents/reviewer.md` has `name`, `description`, `tools` and `model`
- **THEN** agent `reviewer` is in the set with no problem

#### Scenario: Linked agent file
- **WHEN** `agents/reviewer.md` is a link to a regular file with a valid agent
- **THEN** agent `reviewer` is read at the path `agents/reviewer.md`

#### Scenario: Agent without a name
- **WHEN** `agents/helper.md` has a frontmatter with only `description`
- **THEN** there is an error with field `name` and no agent from that file

#### Scenario: Notes in the agents folder
- **WHEN** `agents/README.md` has no frontmatter
- **THEN** there is one warning and no agent from that file

#### Scenario: Nested agents folder
- **WHEN** a skill folder holds `agents/helper.md`
- **THEN** it is not read as an agent

### Requirement: Preloaded skills of an agent
An agent's `skills`, when present, SHALL be a YAML list of strings; otherwise it SHALL be one warning with field `skills` and no preload is read. Each listed name not in the set as a skill or playbook SHALL be a warning with field `skills[n]`, because the tool loading the agent only skips it.

#### Scenario: Unknown preloaded skill
- **WHEN** agent `reviewer` has `skills: [code-review, linting]` and the set has no `linting`
- **THEN** there is a warning with field `skills[1]` and no error

#### Scenario: Skills as a string
- **WHEN** an agent has `skills: code-review`
- **THEN** there is a warning with field `skills`

### Requirement: Unique names
A skill or playbook whose `name` is already used by an earlier skill or playbook of the set SHALL be an error with field `name` on the later file, naming the earlier path, and SHALL NOT join the set. The same SHALL hold for two agents. A skill and an agent MAY share a name.

#### Scenario: Same skill name in two folders
- **WHEN** different folders `a/writer` and `b/writer` both have `name: writer`, given as `a b`
- **THEN** there is one error on `b/writer/SKILL.md` naming `a/writer/SKILL.md`, and relations use the skill under `a`

#### Scenario: Two agents with one name
- **WHEN** `agents/review.md` and `agents/reviewer.md` both have `name: reviewer`
- **THEN** there is one error on `agents/reviewer.md`

### Requirement: Rules files
For a skill that joined the set, the file `rules.md` directly in its folder SHALL be read for rules: a line starting at column 1 with `- **ID**`, ID matching `[A-Z][A-Z0-9]*-[0-9]+`, then a space and text, starts a rule. Indented lines starting with `Why:` or `Check:` before the next rule or heading SHALL be its optional why and check. The nearest earlier `## ` heading SHALL be its group, or none.

#### Scenario: Rule with why and check
- **WHEN** `rules.md` holds `- **FLOW-1** Keep flows thin.` under `## Flows (FLOW)`, then `  Why: logic hides.` and `  Check: one reference.`
- **THEN** rule `FLOW-1` has that text, why, check and group `Flows (FLOW)`

#### Scenario: Indented item
- **WHEN** a line is `  - **FLOW-2** nested`
- **THEN** no rule is read from it

### Requirement: Code fences in rules files
A line starting with up to three spaces and then three or more backticks or tildes SHALL open a fenced block, closed by a line with at least as many of the same character; a block never closed runs to the end of the file. No rule SHALL be read inside a fenced block.

#### Scenario: Example inside a code fence
- **WHEN** `- **LOG-1** example` appears between two lines `~~~`
- **THEN** no rule is read from it

#### Scenario: Fence never closed
- **WHEN** a line of three backticks has no closing line
- **THEN** no rule is read after it

### Requirement: Rule IDs
A rule ID used earlier in the same `rules.md` SHALL be an error at the later line, and that rule SHALL NOT be read. Otherwise, a rule ID used by a skill earlier in walk order SHALL be a warning at the later line naming that skill, and the rule SHALL be read. IDs SHALL be compared by code point.

#### Scenario: Duplicate in one file
- **WHEN** one `rules.md` defines `DOC-1` twice
- **THEN** there is one error at the second line and the skill has one rule `DOC-1`

#### Scenario: Same ID in two skills
- **WHEN** skills `developer` and `documentation` both define `DOC-1`
- **THEN** there is a warning on the later one naming the earlier skill, and no error

### Requirement: Secrets in skill files
Every `SKILL.md`, `rules.md` and agent file read SHALL be checked with the catalogue's secret rules (private-key material; a payment-card number of 13 to 19 digits passing the Luhn check), fenced blocks included. Each broken rule SHALL be one error at `1:1` with a fixed message that never repeats the value; a `rules.md` with such an error gives no rules.

#### Scenario: Private key in a skill
- **WHEN** a `SKILL.md` body holds a `-----BEGIN RSA PRIVATE KEY-----` block
- **THEN** there is one error on that file and the output does not contain the key text

#### Scenario: Card number as a skill name
- **WHEN** a `SKILL.md` has `name: "4111111111111111"` and a playbook lists the same number in `stackledger-skills`
- **THEN** each of the two files has one secret error and no other problem, and no output line contains the number

#### Scenario: Ordinary numbers
- **WHEN** a rules file holds `1234567890123` that fails the Luhn check
- **THEN** there is no problem

### Requirement: Files that cannot be read
A `SKILL.md`, `rules.md` or agent file over 1 MiB, or one that cannot be read, SHALL be an error at `1:1` on that file; the rest of the set SHALL still be read. A skill whose `rules.md` is too large, cannot be read or breaks a secret rule SHALL join the set with no rules; other rules problems drop only the rule concerned.

#### Scenario: Oversized rules file
- **WHEN** a `rules.md` has 1 MiB and one byte
- **THEN** there is one error on it and its skill is in the set with no rules

#### Scenario: Unreadable SKILL.md
- **WHEN** a `SKILL.md` cannot be read
- **THEN** there is one error on it, the skill is not in the set and the other skills are read

### Requirement: Folders with nothing found
A given folder in which no skill folder and no agent file is found, counting those already read through an earlier folder, SHALL be an error, so a wrong path fails a pipeline. Its path SHALL be the folder argument as given, or `.` when no folder is given.

#### Scenario: Wrong folder
- **WHEN** the given folder holds only `README.md`
- **THEN** there is one error naming that folder

#### Scenario: Everything already read
- **WHEN** folders `repo` and `tool` are given and `tool` holds only links to skills of `repo`
- **THEN** there is no problem about `tool`

### Requirement: Deterministic problems
Problems SHALL be sorted by path, line, column, field, severity (error first) and message, comparing text by code point, so the same files give the same output on any machine.

#### Scenario: Listing order does not matter
- **WHEN** the same files are read through a folder listing that returns entries in reversed order
- **THEN** the problems are identical
