# map-command Specification

## Purpose
Defines `stackledger map`, the command that prints the metro map of a catalogue as SVG, with its options, errors and the suggestions it reports.

## Requirements

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

### Requirement: Catalogue with errors
A catalogue with errors SHALL still be drawn from the documents the view serves, with exit 0. In the `full` view, when there is at least one error or warning, the command SHALL write one stderr line with both counts and a hint to run `stackledger validate`; in the `staff` view it SHALL NOT write counts.

#### Scenario: One error in full
- **WHEN** the catalogue has one error and the view is `full`
- **THEN** the SVG is printed, the exit code is 0 and stderr says there is 1 error

#### Scenario: Clean catalogue
- **WHEN** the catalogue has no error and no warning
- **THEN** stderr has no counts line

### Requirement: Layout not used
When the catalogue has a `MapLayout` that is not served, the command SHALL write one stderr line, in both views, saying stored positions are not used because the layout has errors.

#### Scenario: Broken layout
- **WHEN** the `MapLayout` has a fractional position
- **THEN** stderr says stored positions are not used and the map is drawn with suggestions

### Requirement: Suggestions on stderr
For each station that got a suggested position, the command SHALL write to stderr a YAML snippet the owner can copy into `spec.stations` of the `MapLayout`: one header line, then one line per station `    component:<name>: [<column>, <row>]` in reference order.

#### Scenario: Two unplaced stops
- **WHEN** two stops have no position
- **THEN** stderr has a header line and two lines in the `spec.stations` format

### Requirement: Unrouted hops reported
For each hop drawn straight because no route was found, the command SHALL write one stderr line naming the line and the two stations. stderr is for the person running the command and MAY contain catalogue names.

#### Scenario: Unroutable hop
- **WHEN** a hop cannot be routed
- **THEN** stderr names the line and both stations, and the exit code is 0

### Requirement: Clean stdout
stdout SHALL contain only the SVG document followed by one newline.

#### Scenario: Parseable output
- **WHEN** the command runs with suggestions and errors to report
- **THEN** stdout parses as one XML document and everything else is on stderr
