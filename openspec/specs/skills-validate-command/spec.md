# skills-validate-command Specification

## Purpose
Defines how `stackledger skills validate` checks a skill set from the command line and reports the result to a person or a pipeline.

## Requirements

### Requirement: Command input
`stackledger skills validate [folder...] [--json]` SHALL check one skill set read from the given folders in the given order, or from the current folder when none is given. Arguments SHALL be used as received (the tool does not expand `~`). A folder given again, under any spelling, SHALL be read once.

#### Scenario: Default folder
- **WHEN** the command runs with no folder inside a skills repository
- **THEN** that folder is checked

#### Scenario: Several folders
- **WHEN** the command runs as `stackledger skills validate team vendor` on two temporary folders
- **THEN** one set is read from both, `team` first

#### Scenario: Folder given twice
- **WHEN** the command runs as `stackledger skills validate team ./team/`
- **THEN** the set is read once and there is no duplicate-name problem

### Requirement: Skills usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise `stackledger skills` with no subcommand, an unknown subcommand or an unknown option SHALL print the reason and usage on stderr, nothing on stdout, and exit 2. The global usage SHALL list `stackledger skills validate [folder...] [--json]`.

#### Scenario: Help wins
- **WHEN** the command runs as `stackledger skills validate --help --fast`
- **THEN** stdout shows usage including the skills command, stderr is empty and the exit code is 0

#### Scenario: No subcommand
- **WHEN** the command runs as `stackledger skills`
- **THEN** the exit code is 2, stdout is empty and stderr says a skills subcommand is required

#### Scenario: Unknown subcommand
- **WHEN** the command runs as `stackledger skills check`
- **THEN** the exit code is 2 and stderr names `check`

#### Scenario: Unknown option
- **WHEN** the command runs as `stackledger skills validate --strict`
- **THEN** the exit code is 2 and stderr names `--strict`

### Requirement: Skills exit codes
The command SHALL exit 0 when there is no error (warnings allowed), 1 when there is at least one error, and 2 when it cannot check: a usage error, or a given folder that does not exist, is not a folder or cannot be listed. With exit 2, stdout SHALL be empty, also with `--json`, and stderr SHALL name the folder.

#### Scenario: Warnings only
- **WHEN** the set has warnings and no error
- **THEN** the exit code is 0

#### Scenario: One error
- **WHEN** the set has one error
- **THEN** the exit code is 1

#### Scenario: Missing second folder
- **WHEN** the command runs as `stackledger skills validate repo missing --json` and `missing` does not exist
- **THEN** the exit code is 2, stdout is empty and stderr names `missing`

### Requirement: Problem paths
A problem's path SHALL be the folder argument without trailing separators, then `/`, then the path below it with `/` as separator; with no folder argument, only the path below the current folder. A problem about a given folder itself SHALL use the argument without trailing separators, or `.` when no folder is given.

#### Scenario: Relative argument
- **WHEN** `skills/writer/SKILL.md` has an error and the command ran as `stackledger skills validate repo`
- **THEN** the path is `repo/skills/writer/SKILL.md`

#### Scenario: No argument
- **WHEN** the same error is found running with no folder inside `repo`
- **THEN** the path is `skills/writer/SKILL.md`

#### Scenario: Trailing separator
- **WHEN** the command ran as `stackledger skills validate repo/`
- **THEN** the path is `repo/skills/writer/SKILL.md`

### Requirement: Problem positions and fields
A problem about a frontmatter value SHALL point at the value's line and column in the file, and one about a key (an unknown `stackledger-` key) at the key; a missing field, a whole-file problem and a folder problem SHALL use `1:1`. A rule problem SHALL use the rule's line and column 1. Fields SHALL be written as in `stackledger validate`, with `-` (text) or `null` (JSON) for none.

#### Scenario: Position of a relation
- **WHEN** line 5 of a `SKILL.md` is `  stackledger-skills: writer editr` and `editr` is missing
- **THEN** the error is at `5:23` (the start of the value) with field `metadata.stackledger-skills`

#### Scenario: Position of an unknown key
- **WHEN** line 6 of a `SKILL.md` is `  stackledger-skill: writer`
- **THEN** the error is at `6:3` (the start of the key) with field `metadata.stackledger-skill`

### Requirement: Skills text output
By default each problem SHALL be one line on stdout, `<path>:<line>:<column> <error|warning> <field> <message>`, with control characters removed as in `stackledger validate`. A last line SHALL give the counts `skills`, `playbooks`, `agents`, `rules`, `ignored`, `errors` and `warnings`, where the first four count what joined the set and `ignored` counts the entries skipped by ignore files.

#### Scenario: Problem line
- **WHEN** `repo/skills/writer/SKILL.md` has a description of 1025 code points at line 3, column 14
- **THEN** stdout starts with the line `repo/skills/writer/SKILL.md:3:14 warning description ` followed by the message

#### Scenario: Control characters in a file name
- **WHEN** a skill folder's name holds ESC and U+009B and its skill has a problem
- **THEN** no text output line holds either character, and the JSON output writes U+009B as `\u009b`

#### Scenario: Clean set
- **WHEN** a set has 3 skills, 1 playbook, 2 agents, 10 rules, nothing ignored and no problem
- **THEN** stdout is exactly `skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 0, warnings: 0` and a newline

### Requirement: Skills JSON output
With `--json`, stdout SHALL be one JSON object and a newline with, in this order: `problems` (objects with `path`, `line`, `column`, `severity`, `field` and `message`), `ignored` (the sorted paths of the entries skipped by ignore files) and `summary` (the counts in the text output's order, `ignored` after `rules`). U+007F to U+009F SHALL be written as `\u` escapes as in `stackledger validate`.

#### Scenario: JSON with one error
- **WHEN** the set has one error and `--json` is given
- **THEN** stdout parses as JSON with one problem, `summary.errors` is 1 and the exit code is 1

#### Scenario: JSON ignored list
- **WHEN** the ignore file of `repo` skips `fixtures/` and `templates/`, and `--json` is given
- **THEN** `ignored` is `["repo/fixtures", "repo/templates"]` and `summary.ignored` is 2

### Requirement: Skills map file problems in the output
Problems of a skills map file SHALL be reported like every other problem of the set: one line each with the map file's path, line, column and field, counted in `errors` and `warnings`, deciding the exit code. No count is added to the counts line or to `summary`.

#### Scenario: Broken map file fails a pipeline
- **WHEN** `repo/stackledger-skills.yaml` has a line whose second stop, at line 9 column 7, is `skill:editr`, and the set has no `editr`
- **THEN** stdout has a line starting `repo/stackledger-skills.yaml:9:7 error spec.stops[1]`, the counts line has `errors: 1`, and the exit code is 1

#### Scenario: Counts line unchanged
- **WHEN** a set with a valid map file of two lines has 3 skills, 1 playbook, 2 agents, 10 rules and no problem
- **THEN** stdout is exactly `skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 0, warnings: 0` and a newline
