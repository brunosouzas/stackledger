## ADDED Requirements

### Requirement: Ignore file
A given folder that is not itself a skill folder MAY hold, at its top, an entry named exactly `.stackledgerignore`. No such entry SHALL mean no patterns. A regular file, or a link to one, SHALL be read at that path as in "Files and links". A `.stackledgerignore` anywhere else, and one in a given folder that is a skill folder, SHALL have no effect: patterns are never read from a parent or a sub-folder.

#### Scenario: Template folder ignored
- **WHEN** the given folder `repo` holds `.stackledgerignore` with the line `templates/` and holds `skills/writer/SKILL.md` and `templates/skill/SKILL.md`
- **THEN** only `writer` is read and there is no problem

#### Scenario: Ignore file below the top
- **WHEN** the given folder is `repo`, `repo/skills/.stackledgerignore` holds `writer/` and `repo/skills/writer/SKILL.md` exists
- **THEN** `writer` is read

#### Scenario: Ignore file above the given folder
- **WHEN** `repo/.stackledgerignore` holds `templates/` and the given folder is `repo/skills`, which holds `templates/skill/SKILL.md`
- **THEN** that skill is read

#### Scenario: Ignore file in a skill folder
- **WHEN** the given folder is the skill folder `writer` and holds `.stackledgerignore` with `*`
- **THEN** `writer` is read

### Requirement: Ignore file syntax
Every line SHALL be read as `ignore@7.0.13` reads it, which follows `.gitignore`: `#` comments, `\#` and `\!` escapes, trailing spaces dropped, `!` negation with the last matching line winning, a pattern with no slash but a trailing one matching at any depth, a leading or middle `/` anchoring it, a trailing `/` for folders only, and the wildcards `*`, `?`, `[...]` and `**`. No line SHALL give a problem; a line Git cannot match (such as `a[`) matches nothing.

#### Scenario: Negation re-includes a skill
- **WHEN** the ignore file holds `examples/*` and then `!examples/northwind`, and the folder holds `examples/northwind/SKILL.md` and `examples/draft/SKILL.md`
- **THEN** `northwind` is read and `draft` is not

#### Scenario: Ignored folder cannot be re-included below
- **WHEN** the ignore file holds `fixtures/` and then `!fixtures/good/`, and the folder holds `fixtures/good/SKILL.md`
- **THEN** `good` is not read, as with Git

#### Scenario: Pattern syntax table
- **WHEN** each row of this table is the whole ignore file and the folder holds the path given
- **THEN** the skill at that path is read or not as the table says:

  | Ignore file | Skill folder | Read |
  |---|---|---|
  | `draft/` | `a/b/draft` | no |
  | `/draft/` | `a/b/draft` | yes |
  | `**/tmp/` | `x/y/tmp` | no |
  | `\!keep/` | `!keep` | no |
  | `\#draft/` | `#draft` | no |
  | `# templates/` | `templates/skill` | yes |
  | `old ` (trailing space) | `old` | no |
  | `Templates/` | `templates/skill` | yes |
  | `a[` then `templates/` | `templates/skill` | no |

### Requirement: Ignore file text
Line endings MAY be LF or CRLF, and a leading UTF-8 byte-order mark SHALL be dropped. Matching SHALL be case-sensitive on every platform and SHALL compare names as stored, without Unicode normalisation.

#### Scenario: CRLF and byte-order mark
- **WHEN** the ignore file starts with a byte-order mark and holds `templates/` and `fixtures/` on CRLF lines, and the folder holds `templates/skill/SKILL.md` and `fixtures/broken/SKILL.md`
- **THEN** neither skill is read

### Requirement: Matching paths
The walk SHALL test, right after the hidden and `node_modules` skip, each folder, symbolic link, skill folder's `SKILL.md` and `.md` file directly in the top-level `agents/` folder that it meets below a given folder. A skill folder SHALL be skipped when its own path or its `SKILL.md` path matches. Other files SHALL NOT be tested or counted. A pattern for a hidden entry (such as `!.claude/`) has no effect.

#### Scenario: SKILL.md pattern
- **WHEN** the ignore file holds `fixtures/*/SKILL.md` and the folder holds `fixtures/broken/SKILL.md`
- **THEN** `broken` is not read and the ignored count is 1

#### Scenario: Files the walk does not use
- **WHEN** the ignore file holds `*.txt` and `README.md`, and the folder holds `README.md`, `notes.txt` and `skills/writer/SKILL.md`
- **THEN** `writer` is read and the ignored count is 0

### Requirement: Tested path
The tested path SHALL be relative to the given folder, separated by `/`, and end in `/` only for a real folder. A symbolic link SHALL always be tested without `/`, whatever its target, as Git does (a folder-only pattern does not match a link), and the `SKILL.md` of a linked skill folder SHALL NOT be tested.

#### Scenario: Link matched by its name
- **WHEN** the ignore file holds `shared` and `shared` is a link to a skill folder elsewhere
- **THEN** the link is not followed, there is no problem and the ignored count is 1

#### Scenario: Folder pattern does not match a link
- **WHEN** the ignore file holds `shared/` and `shared` is a link to a skill folder elsewhere
- **THEN** the linked skill is read, as Git would not ignore the link

#### Scenario: Broken link matched
- **WHEN** the ignore file holds `old` and `old` is a broken link
- **THEN** there is no problem

#### Scenario: Folder pattern does not match a broken link
- **WHEN** the ignore file holds `old/` and `old` is a broken link
- **THEN** there is one warning on `old`, as without an ignore file

#### Scenario: SKILL.md pattern and a linked skill
- **WHEN** the ignore file holds `fixtures/*/SKILL.md` and `fixtures/shared` is a link to a skill folder elsewhere
- **THEN** the linked skill is read

#### Scenario: Folder pattern does not match a file
- **WHEN** the ignore file holds `helper.md/` and `agents/helper.md` is an agent file
- **THEN** the agent `helper` is read

### Requirement: What the ignore file skips
A matched entry SHALL be skipped with no problem: a folder is not entered, a link is not followed, a skill folder is not read, and an agent file is not read. Patterns of one given folder SHALL NOT apply to entries reached through another given folder. Files inside a skill folder other than its `SKILL.md`, including `rules.md`, SHALL NOT be tested.

#### Scenario: Agent file ignored
- **WHEN** the ignore file holds `agents/README.md` and `agents/` holds `README.md`, whose frontmatter is never closed, and `reviewer.md`
- **THEN** only the agent `reviewer` is read and there is no problem

#### Scenario: Patterns stay in their folder
- **WHEN** folders `repo` and `tool` are given, `repo/.stackledgerignore` holds `writer/` and `tool/skills/writer/SKILL.md` exists
- **THEN** the skill read from `tool/skills/writer` is in the set

#### Scenario: Overlapping folders
- **WHEN** folders `repo` and `repo/skills` are given, `repo/.stackledgerignore` holds `skills/draft/` and `repo/skills/draft/SKILL.md` exists
- **THEN** `draft` is read at `repo/skills/draft`, through the second folder, and the ignored count is 1

#### Scenario: Rules file is never ignored
- **WHEN** the ignore file holds `rules.md` and `skills/writer/rules.md` exists
- **THEN** the rules of `writer` are read

### Requirement: Ignored count and list
Each entry skipped by a pattern SHALL be counted once per run, identified by the device and inode numbers of the entry itself (a link's own; a skill folder's, even when its `SKILL.md` matched). A skipped folder counts as one whatever it holds. Entries skipped because they are hidden or named `node_modules` SHALL NOT be counted. The skipped entries' paths, as displayed in problems and sorted by code point, SHALL be kept for the JSON output.

#### Scenario: Count
- **WHEN** the ignore file holds `templates/` and `fixtures/*`, and the folder holds `templates/skill/SKILL.md`, `fixtures/broken/SKILL.md` and `fixtures/empty/SKILL.md`
- **THEN** the ignored count is 3

#### Scenario: Skill skipped by its SKILL.md
- **WHEN** the ignore file holds `**/draft/SKILL.md` and `skills/draft/SKILL.md` exists, and `--json` is given
- **THEN** `ignored` is `["skills/draft"]` (relative to the given folder `.`)

#### Scenario: Folder given twice with an ignore file
- **WHEN** the command runs as `stackledger skills validate team ./team/` and `team/.stackledgerignore` holds `templates/` and `team/templates/skill/SKILL.md` exists
- **THEN** the ignored count is 1

### Requirement: Ignore file limits
An ignore file SHALL have at most 100 pattern lines (not blank, not comments), each of at most 200 characters and 16 wildcard characters (`*`, `?`, `[`). Every pattern line SHALL be compiled when the file is read. A file over a limit, or a line that cannot compile, SHALL be an ignore file problem naming the line number, never its text, and no pattern of that file is used. A later matcher failure SHALL be an internal failure holding no pattern or path.

#### Scenario: Too many pattern lines
- **WHEN** the ignore file holds 101 pattern lines and `templates/` is the first
- **THEN** there is one error on it naming line 101, and `templates/skill/SKILL.md` is read

#### Scenario: Line too long for the matcher
- **WHEN** a pattern line has 201 characters
- **THEN** there is one error on the ignore file naming that line, and its text is not in the output

#### Scenario: Too many wildcards
- **WHEN** a pattern line holds 17 `*` characters
- **THEN** there is one error on the ignore file naming that line

#### Scenario: Matcher failure
- **WHEN** the matcher throws while an entry is tested
- **THEN** the command fails as an internal failure and its message holds neither the ignore file's text nor the tested path

### Requirement: Ignore file problems
An ignore file over 64 KiB, one that cannot be read, one that breaks a secret rule, and an entry named `.stackledgerignore` that is neither a regular file nor a link to one (a folder, a FIFO or other special file, a broken or looping link) SHALL be an error at `1:1` on it, with a fixed message that never repeats its text, reported once per run at the first path in walk order. Its given folder SHALL then be walked with no patterns.

#### Scenario: Matcher failure
- **WHEN** the matcher throws while an entry is tested
- **THEN** the command fails as an internal failure and its message holds neither the ignore file's text nor the tested path

#### Scenario: Secret in the ignore file
- **WHEN** the ignore file holds `4111111111111111/` and `templates/`, and the folder holds `templates/skill/SKILL.md`
- **THEN** there is one secret error on `.stackledgerignore`, the template skill is read, and no output line contains the number

#### Scenario: Oversized ignore file
- **WHEN** the ignore file has 64 KiB and one byte
- **THEN** there is one error on it and the folder is read with no patterns

#### Scenario: FIFO ignore file
- **WHEN** `.stackledgerignore` is a FIFO
- **THEN** there is one error on it and the command finishes

#### Scenario: Broken link ignore file
- **WHEN** `.stackledgerignore` is a broken link
- **THEN** there is one error on it and the folder is read with no patterns

#### Scenario: Ignore file problem in a folder given twice
- **WHEN** the command runs as `stackledger skills validate team ./team/` and `team/.stackledgerignore` has 64 KiB and one byte
- **THEN** there is one error, on `team/.stackledgerignore`

## MODIFIED Requirements

### Requirement: One read per item
A skill folder or agent file reached more than once (through a link and directly, or from two given folders) SHALL be read once, at the first path in walk order, with no problem. Walk order SHALL be the folders in argument order, each walked as in "Finding skill folders". An entry skipped by a pattern is not reached, so it can still be read through another given folder. Copies (separate files with the same content) are different items.

#### Scenario: Linked copy of a repository skill
- **WHEN** folders `repo` and `tool` are given and `tool/skills/writer` links to `repo/skills/writer`
- **THEN** `writer` is read once, with the path under `repo`, and there is no duplicate-name error

### Requirement: Folders with nothing found
A given folder in which no skill folder and no agent file is found, counting those already read through an earlier folder, SHALL be an error, so a wrong path fails a pipeline. Entries skipped by the ignore file SHALL NOT count as found; when any were skipped, the message SHALL say how many. Its path SHALL be the folder argument as given, or `.` when no folder is given.

#### Scenario: Wrong folder
- **WHEN** the given folder holds only `README.md`
- **THEN** there is one error naming that folder

#### Scenario: Everything already read
- **WHEN** folders `repo` and `tool` are given and `tool` holds only links to skills of `repo`
- **THEN** there is no problem about `tool`

#### Scenario: Everything ignored
- **WHEN** the ignore file holds `*` and the folder holds `skills/writer/SKILL.md`
- **THEN** there is one error naming that folder whose message says 1 entry was skipped by `.stackledgerignore`, and the ignored count is 1
