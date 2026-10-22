## ADDED Requirements

### Requirement: Ignore file
A given folder that is not itself a skill folder MAY hold, at its top, a file named exactly `.stackledgerignore` listing entries the walk skips there. A `.stackledgerignore` anywhere else, and one in a given folder that is a skill folder, SHALL have no effect.

#### Scenario: Template folder ignored
- **WHEN** the given folder `repo` holds `.stackledgerignore` with the line `templates/` and holds `skills/writer/SKILL.md` and `templates/skill/SKILL.md`
- **THEN** only `writer` is read and there is no problem

#### Scenario: Ignore file below the top
- **WHEN** `repo/skills/.stackledgerignore` holds `writer/` and `repo/skills/writer/SKILL.md` exists
- **THEN** `writer` is read

#### Scenario: Ignore file in a skill folder
- **WHEN** the given folder is the skill folder `writer` and holds `.stackledgerignore` with `*`
- **THEN** `writer` is read

### Requirement: Ignore file syntax
The ignore file SHALL use `.gitignore` syntax: blank lines and `#` comments, `\#` and `\!` escapes, unescaped trailing spaces dropped, `!` to negate with the last matching line winning, a leading or middle `/` to anchor to the given folder, a trailing `/` for folders only, and the wildcards `*`, `?`, `[...]` and `**`. Matching SHALL be case-sensitive on every platform.

#### Scenario: Negation re-includes a skill
- **WHEN** the ignore file holds `examples/*` and then `!examples/northwind`, and the folder holds `examples/northwind/SKILL.md` and `examples/draft/SKILL.md`
- **THEN** `northwind` is read and `draft` is not

#### Scenario: Ignored folder cannot be re-included below
- **WHEN** the ignore file holds `fixtures/` and then `!fixtures/good/`, and the folder holds `fixtures/good/SKILL.md`
- **THEN** `good` is not read, as with Git

#### Scenario: Case-sensitive match
- **WHEN** the ignore file holds `Templates/` and the folder holds `templates/skill/SKILL.md`
- **THEN** that skill is read

#### Scenario: Comment and escaped hash
- **WHEN** the ignore file holds `# templates/` and `\#draft/`, and the folder holds `templates/skill/SKILL.md` and `#draft/SKILL.md`
- **THEN** the template skill is read and `#draft` is not

### Requirement: Matching paths
Each entry the walk meets below a given folder SHALL be tested, right after the hidden and `node_modules` skip, against that folder's patterns with its path relative to the given folder, separated by `/`, ending in `/` for a folder or a link to a folder.

#### Scenario: Link matched by its own path
- **WHEN** the ignore file holds `shared` and `shared` is a link to a skill folder elsewhere
- **THEN** the link is not followed and there is no problem

#### Scenario: Folder pattern does not match a file
- **WHEN** the ignore file holds `helper.md/` and `agents/helper.md` is an agent file
- **THEN** the agent `helper` is read

### Requirement: What the ignore file skips
A matched entry SHALL be skipped before any other check, with no problem: a folder is not entered, a link is not followed, and an agent file in `agents/` is not read. Patterns of one given folder SHALL NOT apply to entries reached through another given folder. Files inside a skill folder, including `rules.md`, SHALL NOT be tested.

#### Scenario: Agent file ignored
- **WHEN** the ignore file holds `agents/README.md` and `agents/` holds `README.md`, whose frontmatter is never closed, and `reviewer.md`
- **THEN** only the agent `reviewer` is read and there is no problem

#### Scenario: Link matched by its own path
- **WHEN** the ignore file holds `shared` and `shared` is a link to a skill folder elsewhere
- **THEN** the link is not followed and there is no problem

#### Scenario: Patterns stay in their folder
- **WHEN** folders `repo` and `tool` are given, `repo/.stackledgerignore` holds `writer/` and `tool/skills/writer/SKILL.md` exists
- **THEN** the skill read from `tool/skills/writer` is in the set

#### Scenario: Rules file is never ignored
- **WHEN** the ignore file holds `rules.md` and `skills/writer/rules.md` exists
- **THEN** the rules of `writer` are read

### Requirement: Ignored count
The number of entries skipped by an ignore pattern SHALL be counted; a skipped folder counts as one whatever it holds. Entries skipped because they are hidden or named `node_modules` SHALL NOT be counted.

#### Scenario: Count
- **WHEN** the ignore file holds `templates/` and `fixtures/*`, and the folder holds `templates/skill/SKILL.md`, `fixtures/broken/SKILL.md` and `fixtures/empty/SKILL.md`
- **THEN** the ignored count is 3

### Requirement: Ignore file problems
An ignore file over 1 MiB, that cannot be read, or that breaks a secret rule SHALL be an error at `1:1` on that file, with a fixed message that never repeats a line's text, and its given folder SHALL then be walked with no patterns. A line that is not a valid pattern (such as `[z-a]`) SHALL match nothing and give no problem, as in Git, and the other lines SHALL still apply.

#### Scenario: Secret in the ignore file
- **WHEN** the ignore file holds `4111111111111111/` and `templates/`, and the folder holds `templates/skill/SKILL.md`
- **THEN** there is one secret error on `.stackledgerignore`, the template skill is read, and no output line contains the number

#### Scenario: Invalid pattern line
- **WHEN** the ignore file holds `[z-a]` and `templates/`, and the folder holds `templates/skill/SKILL.md`
- **THEN** the template skill is not read and there is no problem

#### Scenario: Oversized ignore file
- **WHEN** the ignore file has 1 MiB and one byte
- **THEN** there is one error on it and the folder is read with no patterns

## MODIFIED Requirements

### Requirement: Folders with nothing found
A given folder in which no skill folder and no agent file is found, counting those already read through an earlier folder, SHALL be an error, so a wrong path fails a pipeline. Entries skipped by the ignore file SHALL NOT count as found. Its path SHALL be the folder argument as given, or `.` when no folder is given.

#### Scenario: Wrong folder
- **WHEN** the given folder holds only `README.md`
- **THEN** there is one error naming that folder

#### Scenario: Everything already read
- **WHEN** folders `repo` and `tool` are given and `tool` holds only links to skills of `repo`
- **THEN** there is no problem about `tool`

#### Scenario: Everything ignored
- **WHEN** the ignore file holds `*` and the folder holds `skills/writer/SKILL.md`
- **THEN** there is one error naming that folder, and the ignored count is 1
