## Purpose

Defines `stackledger build`, the command that turns a catalogue folder into the `full` and `staff` static sites: its options, the output folder it writes, what else it may write, and what it reports.

## ADDED Requirements

### Requirement: Command
`stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` SHALL build the `full` site into `<dir>/full/` and the `staff` site into `<dir>/staff/`, and exit 0. `--date` sets the map date of the `full` site (default: the machine's local date). A missing `<dir>` is created. The command reads the catalogue folder only and SHALL NOT open network connections.

#### Scenario: Two sites
- **WHEN** the command runs as `stackledger build ./catalogue --out ./public`
- **THEN** `./public/full/index.html` and `./public/staff/index.html` exist and the exit code is 0

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder or `--out`, an unknown option, a `--date` that is not a real `YYYY-MM-DD` date, more than one folder, a catalogue folder that does not exist, is not a folder or cannot be read, or an `--out` that is a file SHALL print the reason and usage on stderr and exit 2, without creating or changing anything.

#### Scenario: Missing out
- **WHEN** the command runs as `stackledger build ./catalogue`
- **THEN** the exit code is 2 and stderr says `--out` is required

#### Scenario: Impossible date
- **WHEN** the command runs with `--date 2027-02-30`
- **THEN** the exit code is 2 and nothing is written

### Requirement: Safe output folder
After resolving symbolic links, the output folder SHALL be refused, with exit 2 and no change, when it is the catalogue folder, inside it, contains it, or is a non-empty folder without the marker file `.stackledger-build` written by an earlier build. The marker has fixed content, with no date or version.

#### Scenario: Output inside the catalogue
- **WHEN** `--out` is `./catalogue/site`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Unrelated non-empty folder
- **WHEN** `--out` is a folder holding `notes.txt` and no marker
- **THEN** the exit code is 2 and `notes.txt` is untouched

### Requirement: Atomic replace
Both sites SHALL be built into a temporary folder `.stackledger-tmp-*` inside the output folder. Only when both succeed are the previous `full/` and `staff/` renamed aside, the new ones renamed into place, and the old ones removed. On any failure the temporary folder is removed and the previous sites stay as they were.

#### Scenario: Rebuild
- **WHEN** the command runs twice with the same `--out`
- **THEN** the second build replaces the first and no file of the first remains unless rebuilt

#### Scenario: Failure leaves the old site
- **WHEN** a build fails after an earlier successful build into the same `--out`
- **THEN** the earlier sites are still complete, no `.stackledger-tmp-*` folder remains and the exit code is 1

### Requirement: Writes
The command SHALL write only inside the output folder and inside one folder under the system temporary directory (for Astro's working copy and cache), which it removes before exiting, also on failure. It SHALL NOT write in the catalogue folder, the installed stackledger package or the user's home folder.

#### Scenario: Sandboxed build
- **WHEN** the command runs under the Node.js permission model with read access to the catalogue folder, the package and the system temporary directory, write access only to `--out` and the system temporary directory, and `--allow-addons --allow-child-process --allow-worker`
- **THEN** both sites are built, and child processes, which the model does not restrict, are outside this check

### Requirement: Build report
stderr SHALL show, in order: when the catalogue has at least one error or warning, one line with both counts and a hint to run `stackledger validate`; the map's lines for suggestions, unrouted hops and an unused layout, as `stackledger map` writes them for the `full` view; one line per site with its folder and page count; and a last line saying both folders must be served behind an identity-aware proxy. A catalogue with errors SHALL still be built, with exit 0.

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** both sites are built, the exit code is 0 and stderr says there is 1 error

#### Scenario: Proxy reminder
- **WHEN** a build succeeds
- **THEN** the last stderr line says the folders must be served behind an identity-aware proxy

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
