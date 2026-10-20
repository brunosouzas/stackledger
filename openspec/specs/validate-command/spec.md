# validate-command Specification

## Purpose
Defines how `stackledger validate` checks a catalogue folder from the command line and reports the result to a person or a pipeline.

## Requirements

### Requirement: Command input
`stackledger validate [folder]` SHALL check the catalogue in `folder`, or in the current folder when none is given. It SHALL only read files.

#### Scenario: Default folder
- **WHEN** the command runs with no argument inside a catalogue folder
- **THEN** that folder is checked

#### Scenario: Read-only
- **WHEN** the command checks a folder
- **THEN** no file in or outside the folder is created, changed or deleted

### Requirement: Usage
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0, whatever the other arguments are. Otherwise, a missing or unknown command, an unknown option or more than one folder SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2.

#### Scenario: Help
- **WHEN** the command runs as `stackledger validate --help`
- **THEN** stdout shows usage and the exit code is 0

#### Scenario: Help wins
- **WHEN** the command runs as `stackledger validate --help --fast a b`
- **THEN** stdout shows usage, stderr is empty and the exit code is 0

#### Scenario: Unknown option
- **WHEN** the command runs as `stackledger validate --fast`
- **THEN** the exit code is 2 and stderr names `--fast`

#### Scenario: Two folders
- **WHEN** the command runs as `stackledger validate a b`
- **THEN** the exit code is 2 and stderr says only one folder is accepted

#### Scenario: No command
- **WHEN** the command runs as `stackledger` with no argument
- **THEN** the exit code is 2 and stderr shows usage

### Requirement: Exit codes
The command SHALL exit 0 when there is no error (warnings allowed), 1 when there is at least one error, and 2 when it cannot check: usage errors, or the folder does not exist, is not a folder or cannot be read. With exit 2, stdout SHALL be empty, also with `--json`.

#### Scenario: Warnings only
- **WHEN** the catalogue has two warnings and no error
- **THEN** the exit code is 0

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** the exit code is 1

#### Scenario: Missing folder
- **WHEN** the folder does not exist and `--json` is given
- **THEN** the exit code is 2, stdout is empty and stderr says the folder was not found

### Requirement: Text output
By default each problem SHALL be one line on stdout: `<path>:<line>:<column> <error|warning> <field> <message>`, the path relative to the folder with `/` as separator. A last line SHALL give the counts `files`, `documents`, `ignored`, `errors` and `warnings`.

#### Scenario: Error line
- **WHEN** `apps/slack.yaml` has no `spec.owner` in the document starting at line 1
- **THEN** stdout has a line starting `apps/slack.yaml:1:1 error spec.owner `

#### Scenario: Clean catalogue
- **WHEN** the catalogue has no problem
- **THEN** stdout has only the counts line, with 0 errors and 0 warnings

### Requirement: Field paths
A field SHALL be written as keys joined by `.`, with list indexes as `[n]` from 0. A key holding anything but ASCII letters, digits, `-` and `_` SHALL be written as `[` + the key as a JSON string literal + `]`. A problem about a whole file or document SHALL use `-` as field in text and `null` in JSON.

#### Scenario: Annotation key with a slash
- **WHEN** the annotation `deploy/Token` is a secret key
- **THEN** the field is `metadata.annotations["deploy/Token"]`

#### Scenario: Key with a quote
- **WHEN** an unlisted field in a line is named `a"b`
- **THEN** the field is `spec["a\"b"]`

#### Scenario: Problem about a file
- **WHEN** a file exceeds 1 MiB
- **THEN** its problem line is `<path>:1:1 error - <message>`

### Requirement: Problem position
A problem SHALL point to the line and column, from 1, of the value of its field. A problem about a key itself (a station reference, a secret key name, an unlisted field) points to the key. A missing field points to the start of its document's mapping; a file not read, or a parse error without a position, to `1:1`.

#### Scenario: Error on a nested field
- **WHEN** `spec.licence.cost: -5` is on line 12 and its value starts at column 11
- **THEN** the problem line starts with `<path>:12:11`

#### Scenario: Error on a station key
- **WHEN** the station key `component:ghost` starts at line 7, column 5, and no such component exists
- **THEN** the problem line starts with `<path>:7:5`

### Requirement: Counts
`files` SHALL count the YAML files found, read or not. `ignored` SHALL count the ignored documents (ignored kinds and non-licence resources). `documents` SHALL count every other document that was read. Skipped empty documents SHALL count in none of them.

#### Scenario: Mixed folder
- **WHEN** the folder holds a valid component file, a file with a `System` and an empty document, and an oversized file
- **THEN** the counts are 3 files, 1 document, 1 ignored and 1 error

### Requirement: JSON output
With `--json`, the command SHALL print one JSON object on stdout with `problems` (each with `path`, `line`, `column`, `severity`, `field`, `message`) and `summary` (`files`, `documents`, `ignored`, `errors`, `warnings`), and nothing else on stdout.

#### Scenario: JSON for a pipeline
- **WHEN** the command runs with `--json` on a catalogue with one error
- **THEN** stdout parses as JSON, `summary.errors` is 1 and the exit code is 1

### Requirement: Deterministic order
Problems SHALL be sorted by path (Unicode code point), then line, column, field, severity (`error` first) and message. Running the command twice on unchanged files SHALL print the same output.

#### Scenario: Two runs
- **WHEN** the command runs twice on the same catalogue with five problems in three files
- **THEN** both outputs are identical and sorted as stated

### Requirement: No network and no telemetry
The command SHALL make no network connection.

#### Scenario: Offline run
- **WHEN** the command runs with network access blocked
- **THEN** it gives the same output and exit code as with network access
