## Purpose

Defines how `stackledger skills validate` checks a skill set from the command line and reports the result to a person or a pipeline.

## ADDED Requirements

### Requirement: Command input
`stackledger skills validate [folder...] [--json]` SHALL check one skill set read from the given folders in the given order, or from the current folder when none is given. A folder given twice, by the same or another spelling of its real path, SHALL be read once.

#### Scenario: Default folder
- **WHEN** the command runs with no folder inside a skills repository
- **THEN** that folder is checked

#### Scenario: Several folders
- **WHEN** the command runs as `stackledger skills validate repo ~/.claude`
- **THEN** one set is read from both, `repo` first

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
A problem's path SHALL be the folder argument as given, then `/`, then the path below it with `/` as separator; with no folder argument, only the path below the current folder. A problem about a given folder itself SHALL use the folder argument as given.

#### Scenario: Relative argument
- **WHEN** `skills/writer/SKILL.md` has an error and the command ran as `stackledger skills validate repo`
- **THEN** the path is `repo/skills/writer/SKILL.md`

#### Scenario: No argument
- **WHEN** the same error is found running with no folder inside `repo`
- **THEN** the path is `skills/writer/SKILL.md`

### Requirement: Problem positions and fields
A problem about a frontmatter value SHALL point at the value's line and column in the file, and one about a key (an unknown `stackledger-` key) at the key; a missing field, a whole-file problem and a folder problem SHALL use `1:1`. A rule problem SHALL use the rule's line and column 1. Fields SHALL be written as in `stackledger validate`, with `-` (text) or `null` (JSON) for none.

#### Scenario: Position of a relation
- **WHEN** line 5 of a `SKILL.md` is `  stackledger-skills: writer editr` and `editr` is missing
- **THEN** the error is at `5:23` (the start of the value) with field `metadata.stackledger-skills`

### Requirement: Skills text output
By default each problem SHALL be one line on stdout, `<path>:<line>:<column> <error|warning> <field> <message>`, with control characters removed as in `stackledger validate`. A last line SHALL give the counts `skills`, `playbooks`, `agents`, `rules`, `errors` and `warnings`, where the first four count what joined the set.

#### Scenario: Clean set
- **WHEN** a set has 3 skills, 1 playbook, 2 agents, 10 rules and no problem
- **THEN** stdout is exactly `skills: 3, playbooks: 1, agents: 2, rules: 10, errors: 0, warnings: 0` and a newline

### Requirement: Skills JSON output
With `--json`, stdout SHALL be one JSON object and a newline: `problems` (objects with `path`, `line`, `column`, `severity`, `field` and `message`) and `summary` (the six counts), with U+007F to U+009F written as `\u` escapes as in `stackledger validate`.

#### Scenario: JSON with one error
- **WHEN** the set has one error and `--json` is given
- **THEN** stdout parses as JSON with one problem, `summary.errors` is 1 and the exit code is 1
