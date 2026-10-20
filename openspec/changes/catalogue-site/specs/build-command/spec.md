## ADDED Requirements

### Requirement: Command
`stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` SHALL build the `full` site into `<dir>/full/` and the `staff` site into `<dir>/staff/`, and exit 0. `--date` sets the map date of the `full` site (default: the machine's local date). The command reads the catalogue folder only and SHALL NOT open network connections.

#### Scenario: Two sites
- **WHEN** the command runs as `stackledger build ./catalogue --out ./public`
- **THEN** `./public/full/index.html` and `./public/staff/index.html` exist and the exit code is 0

#### Scenario: Offline
- **WHEN** the command runs under the Node.js permission model with no network permission, where the Node.js version supports it
- **THEN** both sites are built

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder or `--out`, an unknown option, a `--date` that is not a real `YYYY-MM-DD` date, more than one folder, or a catalogue folder that cannot be read SHALL print the reason and usage on stderr and exit 2, without creating or changing anything.

#### Scenario: Missing out
- **WHEN** the command runs as `stackledger build ./catalogue`
- **THEN** the exit code is 2 and stderr says `--out` is required

### Requirement: Safe output folder
The output folder SHALL be refused, with exit 2 and no change, when it is the catalogue folder, inside it, contains it, or is a non-empty folder that was not written by `stackledger build`. A folder written by `stackledger build` carries a marker file `.stackledger-build` and is replaced on the next build.

#### Scenario: Output inside the catalogue
- **WHEN** `--out` is `./catalogue/site`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Unrelated non-empty folder
- **WHEN** `--out` is a folder holding `notes.txt` and no marker
- **THEN** the exit code is 2 and `notes.txt` is untouched

#### Scenario: Rebuild
- **WHEN** the command runs twice with the same `--out`
- **THEN** the second build replaces the first and no file of the first remains unless rebuilt

### Requirement: Writes
The command SHALL write only inside the output folder and inside one temporary folder under the system temporary directory, which it removes before exiting, also on failure. Both sites SHALL be built into the temporary folder first and moved into place only when both succeed.

#### Scenario: Failure leaves the old site
- **WHEN** a build fails after an earlier successful build into the same `--out`
- **THEN** the earlier site is still complete and the exit code is 1

#### Scenario: Nothing in the package or catalogue
- **WHEN** a build runs
- **THEN** no file is created or changed in the catalogue folder or in the installed stackledger package

### Requirement: Catalogue with errors
A catalogue with errors SHALL still be built from the documents the views serve, with exit 0. stderr SHALL report the catalogue error and warning counts once, then the two folders written and the number of pages in each.

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** both sites are built, the exit code is 0 and stderr says there is 1 error

### Requirement: Deterministic build
The same catalogue, `--date` and stackledger version SHALL produce byte-identical files in both sites, whatever the order of files and documents in the catalogue folder, as long as the same documents are served.

#### Scenario: Built twice
- **WHEN** the same catalogue is built twice with the same `--date`
- **THEN** every file of both builds is identical

### Requirement: Build time
Both sites for a catalogue of 300 items and 20 lines SHALL be built within 90 seconds.

#### Scenario: Large catalogue
- **WHEN** a generated catalogue of 300 items and 20 lines is built
- **THEN** the command finishes within 90 seconds
