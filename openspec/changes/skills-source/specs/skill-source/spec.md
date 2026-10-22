## Purpose

Defines how stackledger finds and reads agent skills, playbooks, agents and rules in folders, which relations it reads, and which problems a skill set can have.

## ADDED Requirements

### Requirement: Skill set
A skill set SHALL be every skill, playbook, agent and rule read from one or more given folders, read in the order the folders are given. Reading SHALL only read files: nothing is created, changed or deleted, and nothing is sent over the network.

#### Scenario: Two folders form one set
- **WHEN** folder `a` holds skill `writer` and folder `b` holds a playbook whose `stackledger-skills` is `writer`
- **THEN** both are read into one set and the playbook's relation finds `writer`

#### Scenario: Read-only
- **WHEN** a set is read
- **THEN** the hash and modification time of every file in the given folders are the same before and after

### Requirement: Finding skill folders
A folder holding a regular file named exactly `SKILL.md` SHALL be a skill folder. Each given folder SHALL be walked depth first, entries in code-point order, at most five levels below it; the walk SHALL NOT enter a skill folder, `node_modules`, or a folder below the given one whose name starts with `.`. The given folder itself MAY be a skill folder.

#### Scenario: Grouped skills
- **WHEN** a given folder holds `skills/developer/java/SKILL.md` and `skills/developer/developer/SKILL.md`
- **THEN** both skills are read

#### Scenario: Resources are not skills
- **WHEN** a skill folder `writer` holds `examples/draft/SKILL.md`
- **THEN** only `writer` is read

#### Scenario: Depth limit
- **WHEN** a `SKILL.md` lies six levels below the given folder (`a/b/c/d/e/f/SKILL.md`)
- **THEN** it is not read, and one at five levels is

#### Scenario: Hidden and dependency folders
- **WHEN** a given folder holds `.git/x/SKILL.md` and `node_modules/x/SKILL.md`
- **THEN** neither is read

#### Scenario: Given folder is a hidden tool folder
- **WHEN** the given folder is `.claude` and it holds `skills/writer/SKILL.md`
- **THEN** `writer` is read

#### Scenario: A single skill
- **WHEN** the given folder itself holds `SKILL.md`
- **THEN** the set has that one skill and the walk stops there

### Requirement: Symbolic links
A symbolic link to a folder that holds a `SKILL.md` SHALL be read as a skill folder found at the link's path, without walking into it. Any other symbolic link met by the walk (to a folder without `SKILL.md`, to a file, broken) SHALL get one warning on the link's path and SHALL NOT be followed.

#### Scenario: Tool folder made of links
- **WHEN** `.claude/skills/writer` is a link to a folder holding `SKILL.md`
- **THEN** `writer` is read and its problems use the path `.claude/skills/writer/SKILL.md`

#### Scenario: Link to a plain folder
- **WHEN** `skills/shared` is a link to a folder with sub-folders holding skills
- **THEN** no skill under it is read and there is one warning on `skills/shared`

#### Scenario: Broken link
- **WHEN** `skills/old` is a link to a path that does not exist
- **THEN** there is one warning on `skills/old` and the rest of the set is read

### Requirement: One read per skill folder
A skill folder reached more than once (through a link and directly, or from two given folders) SHALL be read once, at the first path in walk order, with no problem. Two folders are the same when their real paths are equal.

#### Scenario: Repository and tool folder given together
- **WHEN** the folders `repo` and `.claude` are given and `.claude/skills/writer` links to `repo/skills/writer/writer`
- **THEN** `writer` is read once, with the path under `repo`, and there is no duplicate-name error

### Requirement: Frontmatter
A `SKILL.md` SHALL start with a line `---`, after an optional byte-order mark, and the frontmatter SHALL end at the next line `---`; the text between SHALL be one YAML mapping. Line endings MAY be LF or CRLF. Otherwise the file SHALL get one error and the skill SHALL NOT join the set.

#### Scenario: No frontmatter
- **WHEN** a `SKILL.md` starts with `# Writer`
- **THEN** there is one error at `1:1` and the skill is not in the set

#### Scenario: Invalid YAML
- **WHEN** the frontmatter has a duplicate key or a syntax error
- **THEN** there is one error on that file and the skill is not in the set

#### Scenario: CRLF file
- **WHEN** a valid `SKILL.md` uses CRLF line endings
- **THEN** it is read with no problem

### Requirement: Name and description
`name` and `description` SHALL be non-empty strings; a missing, empty or non-string value SHALL be an error and the skill SHALL NOT join the set. A skill's identity in the set SHALL be its `name`, compared by code point.

#### Scenario: Missing description
- **WHEN** a `SKILL.md` has `name: writer` and no `description`
- **THEN** there is an error with field `description` and `writer` is not in the set

#### Scenario: Name not a string
- **WHEN** a `SKILL.md` has `name: 42`
- **THEN** there is an error with field `name`

### Requirement: Agent Skills specification checks
Each of these SHALL be a warning with the field it concerns: a `name` that is not 1–64 lower-case letters, digits and single hyphens with no hyphen at either end; a `name` different from the name of the folder or link where the skill was found; a `description` over 1024 characters; `compatibility` that is not a 1–500 character string; `license` or `allowed-tools` that is not a string.

#### Scenario: Upper-case name
- **WHEN** a skill has `name: Writer` in folder `Writer`
- **THEN** there is a warning with field `name` and the skill is in the set as `Writer`

#### Scenario: Name differs from the folder
- **WHEN** a skill in folder `writing` has `name: writer`
- **THEN** there is a warning with field `name` naming the folder

#### Scenario: Description at the limit
- **WHEN** a description has 1024 characters
- **THEN** there is no problem, and with 1025 characters there is one warning with field `description`

### Requirement: Fields outside the specification
Top-level fields other than `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools` SHALL give one warning per skill, at `1:1` with field `-`, naming every such field in code-point order. A `metadata` that is not a mapping, or a `metadata` value that is not a string under a key not starting with `stackledger-`, SHALL be a warning with its field.

#### Scenario: Tool-specific fields
- **WHEN** a skill has top-level `version`, `author` and `aliases`
- **THEN** there is exactly one warning, naming `aliases`, `author` and `version`

#### Scenario: Nested metadata
- **WHEN** a skill has `metadata.hermes` set to a mapping
- **THEN** there is a warning with field `metadata.hermes`

### Requirement: Relation keys
Keys in `metadata` starting with `stackledger-` in any letter case SHALL be only `stackledger-kind`, `stackledger-skills` and `stackledger-agents` (exact case), each with a string value; any other such key, or a non-string value, SHALL be an error with its field. `stackledger-kind` SHALL be `skill` or `playbook` (exact case); when absent the item is a skill.

#### Scenario: Playbook
- **WHEN** a skill has `metadata.stackledger-kind: playbook`
- **THEN** it is read as a playbook

#### Scenario: Typo in a key
- **WHEN** a skill has `metadata.stackledger-skill: writer`
- **THEN** there is an error with field `metadata.stackledger-skill`

#### Scenario: Unknown kind
- **WHEN** a skill has `metadata.stackledger-kind: process`
- **THEN** there is an error with field `metadata.stackledger-kind`

#### Scenario: List instead of a string
- **WHEN** a skill has `metadata.stackledger-skills` set to a YAML list
- **THEN** there is an error with field `metadata.stackledger-skills` saying it must be names separated by spaces

### Requirement: Declared relations
`stackledger-skills` and `stackledger-agents` SHALL be read as names separated by one or more spaces; an empty or blank string declares none. Each name SHALL be a skill or playbook (for `stackledger-skills`) or an agent (for `stackledger-agents`) of the set; otherwise it SHALL be an error with the field, naming the missing item. A name listed twice, or a skill listing itself, SHALL be a warning.

#### Scenario: Missing skill
- **WHEN** a playbook has `stackledger-skills: writer editr` and the set has no `editr`
- **THEN** there is one error with field `metadata.stackledger-skills` naming `editr`

#### Scenario: Missing agent
- **WHEN** a playbook has `stackledger-agents: reviewer` and the set has no agent `reviewer`
- **THEN** there is one error with field `metadata.stackledger-agents` naming `reviewer`

#### Scenario: Repeated name
- **WHEN** a playbook has `stackledger-skills: writer  writer`
- **THEN** there is one warning and no error

#### Scenario: Target excluded by an error
- **WHEN** a playbook names `editor` and `editor`'s `SKILL.md` has no frontmatter
- **THEN** there is an error on the playbook naming `editor`, besides the error on `editor`'s file

### Requirement: Agent files
Each regular file ending in `.md` directly inside an `agents` folder at the top of a given folder SHALL be an agent file, read with the frontmatter rules of `SKILL.md`. `name` and `description` SHALL be non-empty strings, or the file SHALL get an error and the agent SHALL NOT join the set. Other fields SHALL be accepted without problems.

#### Scenario: Claude Code subagent
- **WHEN** `agents/reviewer.md` has `name`, `description`, `tools` and `model`
- **THEN** agent `reviewer` is in the set with no problem

#### Scenario: Nested agents folder
- **WHEN** a skill folder holds `agents/helper.md`
- **THEN** it is not read as an agent

### Requirement: Preloaded skills of an agent
An agent's `skills`, when present, SHALL be a YAML list of strings; otherwise it SHALL be a warning with field `skills` and no skill is read from it. Each name not in the set as a skill or playbook SHALL be a warning with the field `skills[n]`, because the tool loading the agent only skips it.

#### Scenario: Unknown preloaded skill
- **WHEN** agent `reviewer` has `skills: [code-review, linting]` and the set has no `linting`
- **THEN** there is a warning with field `skills[1]` and no error

#### Scenario: Skills as a string
- **WHEN** an agent has `skills: code-review`
- **THEN** there is a warning with field `skills`

### Requirement: Unique names
A skill or playbook whose `name` is already used by an earlier skill or playbook of the set, in walk order, SHALL be an error on the later file and SHALL NOT join the set. The same SHALL hold for two agents with the same `name`. A skill and an agent MAY share a name.

#### Scenario: Same skill name in two folders
- **WHEN** different folders `a/writer` and `b/writer` both have `name: writer`, given as `a b`
- **THEN** there is one error on `b/writer/SKILL.md` naming the first path, and relations use the skill under `a`

### Requirement: Rules files
A regular file `rules.md` directly inside a skill folder SHALL be read for rules: each line starting with `- **ID**`, where ID is an upper-case letter, then upper-case letters or digits, `-` and digits, starts a rule whose text is the rest of the line. Lines inside fenced code blocks SHALL be ignored. The nearest earlier `## ` heading SHALL be the rule's group.

#### Scenario: Rule with why and check
- **WHEN** `rules.md` holds `- **FLOW-1** Keep flows thin.` under `## Flows (FLOW)`
- **THEN** rule `FLOW-1` with group `Flows (FLOW)` belongs to the skill

#### Scenario: Example inside a code fence
- **WHEN** `- **LOG-1** example` appears inside a fenced code block
- **THEN** no rule is read from it

### Requirement: Rule IDs
A rule ID already used earlier in the same `rules.md` SHALL be an error at the later line. A rule ID already used by a skill earlier in walk order SHALL be a warning at the later line naming that skill. Rule IDs SHALL be compared by code point.

#### Scenario: Duplicate in one file
- **WHEN** one `rules.md` defines `DOC-1` twice
- **THEN** there is an error at the second line

#### Scenario: Same ID in two skills
- **WHEN** skills `developer` and `documentation` both define `DOC-1`
- **THEN** there is a warning on the later one naming the earlier skill, and no error

### Requirement: Secrets in skill files
Every `SKILL.md`, `rules.md` and agent file read SHALL be checked with the catalogue's secret rules: private-key material, and a payment-card number of 13 to 19 digits passing the Luhn check. Each match SHALL be an error at `1:1` on that file with a fixed message that never repeats the value.

#### Scenario: Private key in a skill
- **WHEN** a `SKILL.md` body holds a `-----BEGIN RSA PRIVATE KEY-----` block
- **THEN** there is one error on that file and the output does not contain the key text

#### Scenario: Ordinary numbers
- **WHEN** a rules file holds `1234567890123` that fails the Luhn check
- **THEN** there is no problem

### Requirement: Files that cannot be read
A `SKILL.md`, `rules.md` or agent file over 1 MiB, or one that cannot be read, SHALL be an error at `1:1` on that file; the rest of the set SHALL still be read. A skill whose `SKILL.md` cannot be read SHALL NOT join the set; a skill whose `rules.md` cannot be read SHALL join it without rules.

#### Scenario: Oversized rules file
- **WHEN** a `rules.md` has 1 MiB and one byte
- **THEN** there is one error on it and its skill is in the set with no rules

### Requirement: Folders with nothing to read
A given folder from which no skill, playbook or agent is read SHALL be an error with that folder as its path, so a wrong path fails in a pipeline. A folder whose items were all already read through an earlier folder SHALL NOT get this error.

#### Scenario: Wrong folder
- **WHEN** the given folder holds only `README.md`
- **THEN** there is one error naming that folder

### Requirement: Deterministic problems
Problems SHALL be sorted by path, line, column, field, severity (error first) and message, comparing text by code point, so the same files give the same output on any machine.

#### Scenario: Listing order does not matter
- **WHEN** the same files are read on two file systems that list entries in different orders
- **THEN** the problems are identical
