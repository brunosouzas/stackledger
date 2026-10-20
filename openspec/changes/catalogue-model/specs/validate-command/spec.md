# Spec Delta

## Purpose

Defines how `stackledger validate` checks a catalogue folder from the command line and reports the result to a person or a pipeline.

## ADDED Requirements

### Requirement: Command input
`stackledger validate [folder]` SHALL check the catalogue in `folder`, or in the current folder when none is given. It SHALL only read files.

#### Scenario: Default folder
- **WHEN** the command runs with no argument inside a catalogue folder
- **THEN** that folder is checked

#### Scenario: Read-only
- **WHEN** the command checks a folder
- **THEN** no file in or outside the folder is created, changed or deleted

### Requirement: Exit codes
The command SHALL exit 0 when there is no error (warnings allowed), 1 when there is at least one error, and 2 when it cannot check: the folder does not exist, is not a folder or cannot be read, or an option is unknown.

#### Scenario: Warnings only
- **WHEN** the catalogue has two warnings and no error
- **THEN** the exit code is 0

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** the exit code is 1

#### Scenario: Missing folder
- **WHEN** the folder does not exist
- **THEN** the exit code is 2 and stderr says the folder was not found

#### Scenario: Unknown option
- **WHEN** the command runs with `--fast`
- **THEN** the exit code is 2 and stderr names the unknown option

### Requirement: Text output
By default each problem SHALL be one line on stdout: `<path>:<line>:<column> <error|warning> <field> <message>`, with the path relative to the folder. A last line SHALL count files, documents read, documents ignored, errors and warnings.

#### Scenario: Error line
- **WHEN** `apps/slack.yaml` has no `spec.owner` in the document starting at line 1
- **THEN** stdout has a line starting `apps/slack.yaml:1:1 error spec.owner`

#### Scenario: Clean catalogue
- **WHEN** the catalogue has no problem
- **THEN** stdout has only the summary line, with 0 errors and 0 warnings

### Requirement: Problem position
A problem SHALL point to the line and column of the field it is about. When that field is missing, it SHALL point to the start of its document; when the file cannot be parsed, to the position the parser reports, or to `1:1` when there is none.

#### Scenario: Error on a nested field
- **WHEN** `spec.licence.cost` is `-5` on line 12, column 11
- **THEN** the problem line starts with `<path>:12:11`

### Requirement: JSON output
With `--json`, the command SHALL print one JSON object on stdout with `problems` (each with `path`, `line`, `column`, `severity`, `field`, `message`) and `summary` (`files`, `documents`, `ignored`, `errors`, `warnings`), and nothing else on stdout. Exit codes are the same as for text output.

#### Scenario: JSON for a pipeline
- **WHEN** the command runs with `--json` on a catalogue with one error
- **THEN** stdout parses as JSON, `summary.errors` is 1 and the exit code is 1

### Requirement: Deterministic order
Problems SHALL be sorted by path, then line, then column, then field. Running the command twice on unchanged files SHALL print the same output.

#### Scenario: Two runs
- **WHEN** the command runs twice on the same catalogue with five problems in three files
- **THEN** both outputs are identical and sorted by path, then line

### Requirement: No network and no telemetry
The command SHALL make no network connection.

#### Scenario: Offline run
- **WHEN** the command runs with network access blocked
- **THEN** it gives the same result as with network access
