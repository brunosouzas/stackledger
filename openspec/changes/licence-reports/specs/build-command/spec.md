## MODIFIED Requirements

### Requirement: Command
`stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` SHALL build the `full` site into `<dir>/full/` and the `staff` site into `<dir>/staff/`, and exit 0. `--date` sets the map date and the report date of the `full` site (default: the machine's local date, captured once). A missing `<dir>` is created. The command reads the catalogue folder only and SHALL NOT open network connections.

#### Scenario: Two sites
- **WHEN** the command runs as `stackledger build ./catalogue --out ./public`
- **THEN** `./public/full/index.html` and `./public/staff/index.html` exist and the exit code is 0
