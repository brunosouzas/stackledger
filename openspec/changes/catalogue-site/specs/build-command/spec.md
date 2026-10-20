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
After resolving symbolic links, the output folder SHALL be refused, with exit 2 and no change, when it is the catalogue folder, inside it, contains it, or is a non-empty folder without the marker `.stackledger-build`: a regular file with fixed content, no date or version. It SHALL also be refused when `full`, `staff`, `_headers`, `robots.txt` or the marker is a symbolic link.

#### Scenario: Output inside the catalogue
- **WHEN** `--out` is `./catalogue/site`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Unrelated non-empty folder
- **WHEN** `--out` is a folder holding `notes.txt` and no marker
- **THEN** the exit code is 2 and `notes.txt` is untouched

#### Scenario: Marker that is not a file
- **WHEN** `.stackledger-build` in `--out` is a folder, a symbolic link or has other content
- **THEN** the exit code is 2 and nothing changes

#### Scenario: Linked published entry
- **WHEN** `full` in a marked `--out` is a symbolic link to another folder
- **THEN** the exit code is 2 and the link's target is untouched

### Requirement: Interrupted publication
Publication SHALL create the staging folder's `old/` before its first rename. When a failure before the commit cannot be undone, the command exits 1, keeps the staging folder and says how to restore by hand. A later build SHALL exit 1, naming it and changing nothing, while any staging folder with `old/` exists; staging folders without `old/` are removed, never following links.

#### Scenario: Undo failed
- **WHEN** an undo fails
- **THEN** the exit code is 1, the staging folder is kept and stderr names it and the manual steps in `docs/site.md`

#### Scenario: Next build after a failed undo
- **WHEN** the command runs again while that staging folder exists
- **THEN** the exit code is 1, stderr names the staging folder and nothing changes

#### Scenario: Stale staging before publication
- **WHEN** a staging folder without `old/` was left by a crashed build
- **THEN** the next build removes it and succeeds

### Requirement: Output folder identity
The command SHALL record the output folder's real path and file identity after validation and check them again immediately before creating staging, before every publication or undo rename and before every removal; a mismatch SHALL stop the command with exit 1 and no further change, also after the commit.

#### Scenario: Folder swapped during a build
- **WHEN** the output folder is replaced by a symbolic link to another folder during the build
- **THEN** the exit code is 1 and the other folder is untouched

### Requirement: Atomic replace
Both sites and the root files SHALL be fully prepared in a staging folder `.stackledger-tmp-*` inside the output folder before anything published changes, then published by renames whose last one is the commit point. A failure before the commit SHALL restore every previous entry byte for byte and exit 1. After the commit, a failure to remove the staging folder is a warning, with exit 0.

#### Scenario: Rebuild
- **WHEN** the command runs twice with the same `--out`
- **THEN** the second build replaces the first and no file of the first remains unless rebuilt

#### Scenario: Failure leaves the old site
- **WHEN** a build fails, at any step before the commit, after an earlier successful build into the same `--out`
- **THEN** the earlier sites and root files are unchanged, no `.stackledger-tmp-*` folder remains and the exit code is 1

### Requirement: Publishing the output
The output folder SHALL NOT be served while a build runs. Only `full/`, `staff/`, `_headers` and `robots.txt` SHALL be published, after an exit code 0; `docs/site.md` SHALL say so, because staging folders hold `full` view files outside the protected `/full/` path.

#### Scenario: Documented
- **WHEN** a reader opens `docs/site.md`
- **THEN** it says not to serve the output folder during a build and which four entries to publish

### Requirement: Writes
The command SHALL write only inside the output folder. Astro's working copy, generated files and every cache (Astro `cacheDir` and Vite `cacheDir`) SHALL be under the staging folder. It SHALL NOT write in the catalogue folder, the installed stackledger package, the system temporary directory or the user's home folder.

#### Scenario: Sandboxed build
- **WHEN** the command runs under the Node.js permission model with read access to the catalogue folder and the package, write access only to `--out`, and `--allow-addons --allow-child-process --allow-worker`
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
