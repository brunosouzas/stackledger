## MODIFIED Requirements

### Requirement: Command
`stackledger map <folder> [--view full|staff] [--theme light|dark] [--backdrop neutral|london] [--date YYYY-MM-DD]` SHALL print the map of the catalogue in `folder` as SVG on stdout and exit 0. The defaults are `--view full`, `--theme light`, `--backdrop` the catalogue's `spec.map.backdrop` ("Map settings") and `--date` the machine's local date. The command SHALL only read files and SHALL NOT open network connections.

#### Scenario: Default options
- **WHEN** the command runs as `stackledger map ./catalogue`
- **THEN** stdout is the SVG of the `full` view in the `light` theme and the exit code is 0

#### Scenario: Read-only
- **WHEN** the command draws a map under the Node.js permission model with read access only
- **THEN** it succeeds and no file in the folder changes

#### Scenario: Backdrop option overrides the settings
- **WHEN** the catalogue has `spec.map.backdrop: london` and the command runs with `--backdrop neutral`
- **THEN** the SVG has no backdrop layer

#### Scenario: Backdrop from the settings
- **WHEN** the catalogue has `spec.map.backdrop: london` and the command runs without `--backdrop`
- **THEN** the SVG has the `london` backdrop layer

#### Scenario: London backdrop offline
- **WHEN** the command runs with `--backdrop london` under the Node.js permission model with read access only and no network
- **THEN** it succeeds and the SVG has the `london` backdrop layer

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder, an unknown option, a `--view`, `--theme` or `--backdrop` outside the allowed values, a `--date` that is not a real `YYYY-MM-DD` date, more than one folder, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2.

#### Scenario: Unknown theme
- **WHEN** the command runs as `stackledger map ./catalogue --theme blue`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed themes

#### Scenario: Impossible date
- **WHEN** the command runs with `--date 2027-02-30`
- **THEN** the exit code is 2 and stdout is empty

#### Scenario: Unknown backdrop option
- **WHEN** the command runs as `stackledger map ./catalogue --backdrop paris`
- **THEN** the exit code is 2, stdout is empty and stderr names `neutral` and `london`
