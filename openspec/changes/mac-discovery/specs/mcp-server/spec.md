## MODIFIED Requirements

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder argument, an unknown option, a `--view` other than `full` or `staff`, more than one folder, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2 without serving.

#### Scenario: No folder
- **WHEN** the command runs as `stackledger mcp`
- **THEN** the exit code is 2, stdout is empty and stderr says a folder is required

#### Scenario: Unknown view
- **WHEN** the command runs as `stackledger mcp ./catalogue --view finance`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed views

#### Scenario: Missing folder
- **WHEN** the folder does not exist
- **THEN** the exit code is 2, stdout is empty and stderr says the folder was not found

#### Scenario: Help
- **WHEN** the command runs as `stackledger mcp --help --view finance`
- **THEN** stdout shows usage and the exit code is 0

#### Scenario: Global help lists both commands
- **WHEN** the command runs as `stackledger --help`
- **THEN** stdout shows usage for `validate`, `mcp`, `map`, `build`, `report`, `discover` and `drift`, and an unknown command's error lists all seven
