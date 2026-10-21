# mac-discovery

## Purpose
Defines what stackledger reads from a Mac to learn what is installed, how each source is read without changing the machine, the machine name, and the content of the snapshot it produces.

## ADDED Requirements

### Requirement: Sources
Discovery SHALL read these sources, in this order: `brew` (Homebrew formulae), `cask` (Homebrew casks), `mas` (App Store), `app` (application bundles), `launchd`, `mise`, `npm` (global packages) and `pipx`. Each source SHALL end with one status: `ok`; `skipped`, when its program or every folder it reads is absent; or `failed`, when it could not be read. A skipped or failed source SHALL NOT stop the others and SHALL contribute no item.

#### Scenario: Missing source
- **WHEN** no `mas` program is found and every other source is present
- **THEN** `mas` is `skipped` and the other seven sources are `ok`

#### Scenario: Failing source
- **WHEN** `brew` exits with code 1
- **THEN** `brew` and `cask` are `failed`, have no items, and the other sources are still read

### Requirement: Source reasons and counts
Each source SHALL record `items` (the number of items it contributed) and `ignored` (the entries it found but could not record, such as an unreadable file). A `skipped` or `failed` source SHALL record a reason chosen from fixed texts: `not found`, `exited with code <n>`, `time limit`, `output limit`, `unreadable output` (a program's output) and `cannot be read` (a folder the source needs). No program output, file content or path SHALL be part of a reason.

#### Scenario: Reason without program output
- **WHEN** `brew` prints an error holding a line break and a terminal escape on stderr and exits with code 1
- **THEN** the reason of `brew` is exactly `exited with code 1`

### Requirement: Programs found
A program SHALL be looked up in the directories of `PATH` in order, then in `/opt/homebrew/bin` and `/usr/local/bin`; the first executable regular file, or link to one, wins. A program that is not found makes its source `skipped` with reason `not found`.

#### Scenario: Homebrew outside PATH
- **WHEN** `PATH` holds no `brew` and `/opt/homebrew/bin/brew` exists
- **THEN** that program is run

### Requirement: Sandbox
Every program discovery starts, `scutil` included, SHALL run through `/usr/bin/sandbox-exec` with a profile that denies all network access and every file write except to `/dev/null`. When `/usr/bin/sandbox-exec` does not exist, discovery SHALL NOT start: no program runs, no source is read and nothing is written.

#### Scenario: Write denied
- **WHEN** a source program tries to create a file in a temporary folder before printing its output
- **THEN** the file does not exist afterwards

#### Scenario: Network denied
- **WHEN** a source program tries to open a TCP connection to a listening local port
- **THEN** the connection is refused by the sandbox and the listener never sees it

#### Scenario: No sandbox
- **WHEN** `/usr/bin/sandbox-exec` does not exist
- **THEN** discovery refuses to start, no program runs and no file is written

### Requirement: Program limits
Each program run SHALL be stopped after 60 seconds or once its stdout passes 64 MiB. When a program runs once for its source (`brew`, `mas`, `npm`), a non-zero exit, a limit or unreadable output makes the source `failed` with that reason. When it runs per file (`plutil`), a limit or failing to read a required key (`CFBundleIdentifier`, `Label`) only counts that file as ignored and the source goes on; an optional key that cannot be read is absent.

#### Scenario: Program that hangs
- **WHEN** a source program does not finish within the time limit
- **THEN** it is stopped and its source is `failed` with reason `time limit`

#### Scenario: Plist reader that hangs
- **WHEN** `plutil` does not finish within the time limit for one application bundle
- **THEN** that bundle is counted as ignored, the other bundles are recorded and `app` is `ok`

### Requirement: Program environment
Programs SHALL get only `PATH`, `HOME`, `USER` and `TMPDIR` from the caller's environment, plus settings that turn off Homebrew's automatic update, analytics and hints, npm's update check and colour output.

#### Scenario: Caller environment not passed
- **WHEN** the caller's environment holds `NORTHWIND_TOKEN`
- **THEN** a source program does not see it

### Requirement: Homebrew
`brew` and `cask` SHALL come from one run of `brew info --json=v2 --installed`. A formula item has `id` = its full name, `versions` = its installed versions, `onRequest` = whether any installed version was installed on request, and `dependsOn` = the full names of runtime dependencies declared directly. A cask item has `id` = its full token, `versions` and `apps` = the names of the `.app` bundles it installs.

#### Scenario: Formula with a dependency
- **WHEN** `forge` 2.1.0 is installed on request and declares `libnorth` directly
- **THEN** the `brew` item `forge` has `versions` `["2.1.0"]`, `onRequest` true and `dependsOn` `["libnorth"]`

#### Scenario: Formula from a tap
- **WHEN** the formula `northwind/tools/ledger` is installed
- **THEN** its item `id` is `northwind/tools/ledger`

#### Scenario: Cask with an app
- **WHEN** the cask `northwind-editor` installs `Northwind Editor.app`
- **THEN** its item has `apps` `["Northwind Editor.app"]`

#### Scenario: Unreadable Homebrew output
- **WHEN** `brew` exits with code 0 and prints text that is not JSON
- **THEN** `brew` and `cask` are `failed` with reason `unreadable output`

### Requirement: Malformed entries
Program output that is not the expected top-level JSON (an object with `formulae` and `casks` lists for Homebrew, an object for npm) SHALL fail the source with `unreadable output`. Inside it, an entry whose name or installed version is missing, empty or not a string SHALL be counted as ignored, and the source stays `ok`. Optional fields of the wrong type are treated as absent.

#### Scenario: Formula with a numeric version
- **WHEN** one formula in otherwise valid `brew info` output has an installed version that is a number
- **THEN** that formula is counted as ignored and the other formulae are recorded

### Requirement: App Store
`mas` SHALL run `mas list` and read each non-empty line as an App Store identifier (digits), a name, and a version in parentheses at the end. The item has `id` = the identifier, `title` = the name and `versions`. A non-empty line in another shape SHALL be counted as ignored.

#### Scenario: App Store list
- **WHEN** `mas list` prints `1234567890  Northwind Notes  (4.2)`
- **THEN** the `mas` item has `id` `1234567890`, `title` `Northwind Notes` and `versions` `["4.2"]`

#### Scenario: Line in another shape
- **WHEN** `mas list` prints a line without a version in parentheses
- **THEN** that line is counted as ignored and the source is `ok`

### Requirement: Applications found
`app` SHALL look at the folders named `*.app` directly inside `/Applications` and `~/Applications`, and inside their subfolders one level down. It SHALL NOT follow symbolic links, which are counted as ignored, and SHALL NOT look inside an `.app`. An `.app` entry that cannot be examined, and a subfolder that cannot be listed, are each counted as ignored. When neither folder exists the source is `skipped`.

#### Scenario: App in a subfolder
- **WHEN** `/Applications/Utilities/Northwind Monitor.app` exists
- **THEN** it is recorded

#### Scenario: Linked app
- **WHEN** `/Applications/Northwind Viewer.app` is a symbolic link
- **THEN** it is not recorded and `ignored` counts it

#### Scenario: Unreadable app entry
- **WHEN** `/Applications/Northwind Vault.app` cannot be examined
- **THEN** `app` is `ok` and `ignored` counts it

#### Scenario: Unreadable subfolder
- **WHEN** the subfolder `/Applications/Northwind Suite` cannot be listed
- **THEN** `app` is `ok` and `ignored` counts it once

### Requirement: Application fields
`app` SHALL read each bundle's `Contents/Info.plist` with `plutil`. The item has `id` = `CFBundleIdentifier`; `title` = `CFBundleDisplayName`, else `CFBundleName`, else the folder name without `.app`, else (all three empty) the `id`; `versions` = `CFBundleShortVersionString` when present; `path`; and `appStore` = whether `Contents/_MASReceipt` exists. A bundle without a readable identifier is counted as ignored.

#### Scenario: App Store receipt
- **WHEN** `Northwind Notes.app` has `Contents/_MASReceipt`
- **THEN** its item has `appStore` true

#### Scenario: App without identifier
- **WHEN** an `.app` has an `Info.plist` without `CFBundleIdentifier`
- **THEN** it is not recorded and `ignored` counts it

#### Scenario: App with an empty name
- **WHEN** a bundle named `.app` has `CFBundleIdentifier` `com.northwind.blank` and no display or bundle name
- **THEN** its item's `title` is `com.northwind.blank`

### Requirement: launchd jobs
`launchd` SHALL read the `.plist` files directly inside `~/Library/LaunchAgents` (scope `user-agent`), `/Library/LaunchAgents` (scope `agent`) and `/Library/LaunchDaemons` (scope `daemon`), not following links. The item has `id` = `Label`, `scope`, `path` of the file and `program` = `Program`, else the first entry of `ProgramArguments`, else null. A file that cannot be read or has no `Label` is counted as ignored.

#### Scenario: Agent of the user
- **WHEN** `~/Library/LaunchAgents/com.northwind.sync.plist` has `Label` `com.northwind.sync` and `ProgramArguments` `["/Applications/Northwind Sync.app/Contents/MacOS/sync", "--quiet"]`
- **THEN** the item has scope `user-agent` and `program` `/Applications/Northwind Sync.app/Contents/MacOS/sync`

#### Scenario: Unreadable daemon
- **WHEN** a file in `/Library/LaunchDaemons` cannot be read by the user
- **THEN** it is counted as ignored and the source is `ok`

### Requirement: launchd privacy
Discovery SHALL read only the keys `Label`, `Program` and `ProgramArguments.0` of a launchd file, one `plutil -extract <key> raw` run per key, so no other argument, environment variable or key is read or reaches the snapshot.

#### Scenario: Arguments are not recorded
- **WHEN** a job's `ProgramArguments` is `["/usr/local/bin/northwind-agent", "--token", "nw-example-value"]` and it has `EnvironmentVariables`
- **THEN** the snapshot contains neither `nw-example-value` nor any environment variable, and every `plutil` run on that file extracts one of the three keys

### Requirement: mise
`mise` SHALL list the folders inside `installs` of the mise data folder (`$MISE_DATA_DIR`, else `$XDG_DATA_HOME/mise`, else `~/.local/share/mise`). Each tool folder is one item with `id` = the folder name and `versions` = the names of its version folders, leaving out symbolic links such as `latest`. It SHALL NOT run `mise`. Without that folder the source is `skipped`.

#### Scenario: Tool with an alias link
- **WHEN** `installs/node` holds the folders `22.12.0` and `24.1.0` and a link `22`
- **THEN** the item `node` has `versions` `["22.12.0", "24.1.0"]`

### Requirement: npm
`npm` SHALL run `npm ls --global --depth=0 --json --offline` and record each top-level package as an item with `id` = its name and `versions`. A non-zero exit whose stdout is a JSON object with `dependencies` SHALL still be read; any other non-zero exit fails the source.

#### Scenario: npm reports a problem but lists packages
- **WHEN** `npm` exits with code 1 and prints JSON listing `northwind-cli` 3.0.0
- **THEN** the `npm` item `northwind-cli` is recorded and the source is `ok`

### Requirement: pipx
`pipx` SHALL read `pipx_metadata.json` in each folder of `venvs` in the pipx home (`$PIPX_HOME`, else `~/.local/pipx` when it exists, else `~/Library/Application Support/pipx`). The item has `id` = `main_package.package` and `versions` = `main_package.package_version`. It SHALL NOT run `pipx`, which writes a log on every run. A metadata file that cannot be read, is not JSON, or lacks either field as a non-empty string is counted as ignored.

#### Scenario: pipx package
- **WHEN** `venvs/northwind-docs/pipx_metadata.json` names the package `northwind-docs` at version `1.6.0`
- **THEN** the `pipx` item `northwind-docs` has `versions` `["1.6.0"]`

#### Scenario: Broken pipx metadata
- **WHEN** one venv's `pipx_metadata.json` has `main_package.package_version` as a number
- **THEN** that venv is counted as ignored and the other venvs are recorded

### Requirement: Machine name
The machine name SHALL be the output of `scutil --get ComputerName` folded to a path segment: Unicode NFKD, combining marks removed, lower case, each run of characters other than `a`–`z` and `0`–`9` replaced by one `-`, `-` trimmed from both ends, then cut to 63 characters and trimmed again. When the result is empty, `scutil --get LocalHostName` is folded the same way; when that is empty too, the name is `mac`.

#### Scenario: Name with spaces
- **WHEN** the computer name is `username - MacBook Air`
- **THEN** the machine name is `username-macbook-air`

#### Scenario: Name with accents
- **WHEN** the computer name is `MacBook de João`
- **THEN** the machine name is `macbook-de-joao`

#### Scenario: Name with nothing usable
- **WHEN** the computer name is `☕☕` and the local host name is `Northwind-Mac`
- **THEN** the machine name is `northwind-mac`

#### Scenario: No usable name at all
- **WHEN** both names fold to an empty text
- **THEN** the machine name is `mac`

### Requirement: Snapshot content
The snapshot SHALL be one JSON object with `format` = `stackledger-snapshot/v1`, `takenAt` (UTC, to the second), `machine` (`name`, the macOS `user` and the `macos` version or null), `sources` (exactly the eight sources in source order, each with `source`, `status`, `reason`, `items` and `ignored`) and `items` (each with `source`, `id`, `versions` and its source's fields), in the shape of design D3, which `docs/discovery.md` documents.

#### Scenario: Snapshot shape
- **WHEN** discovery runs with the fictitious Northwind sources
- **THEN** the snapshot parses as the shape of design D3, with eight entries in `sources`

### Requirement: Snapshot consistency
In a snapshot, every item's source SHALL have status `ok`; each source's `items` SHALL equal its number of items; `reason` SHALL be null exactly when the status is `ok`; `id` values SHALL be non-empty; and no two items SHALL share `source`, `id` and `path`.

#### Scenario: Consistent counts
- **WHEN** discovery records two casks and ignores one app bundle
- **THEN** `cask` has `items` 2 and `app` has `ignored` 1

### Requirement: Snapshot secret guard
An item any of whose strings holds private-key material or a payment-card number, as the catalogue's secret guard defines them, SHALL be left out and counted as ignored. When a `machine` field holds one, discovery SHALL write nothing and fail. E-mail addresses are not checked: like the user name and paths, they stay in a file private to the user.

#### Scenario: Card number in a title
- **WHEN** an app's display name holds a 16-digit number that passes the Luhn check
- **THEN** that app is not recorded and `ignored` counts it

#### Scenario: Secret in the user name
- **WHEN** the macOS user name holds a 16-digit number that passes the Luhn check
- **THEN** discovery fails and writes nothing

#### Scenario: Private key in a version
- **WHEN** an npm package's version text holds `-----BEGIN RSA PRIVATE KEY-----`
- **THEN** that package is not recorded and `ignored` counts it

### Requirement: Merged items
Items of one source that have no `path` and the same `id` SHALL be merged into one item: every list field (`versions`, `dependsOn`, `apps`) is the union of theirs, `onRequest` is true when any is, and `title` is the first of their titles by Unicode code points. Items with a `path` are never merged. The result does not depend on input order.

#### Scenario: Same package in two pipx folders
- **WHEN** `venvs/northwind-docs` and `venvs/northwind-docs-next` both name the package `northwind-docs`, at `1.6.0` and `2.0.0`
- **THEN** there is one `pipx` item `northwind-docs` with `versions` `["1.6.0", "2.0.0"]`

#### Scenario: Two App Store lines for one app
- **WHEN** `mas list` prints `1234567890` once as `Northwind Notes` and once as `Northwind Notes Pro`, in either order
- **THEN** there is one item with `title` `Northwind Notes`

### Requirement: Deterministic snapshot
Items SHALL be sorted by source order, then `id`, then `path`, comparing Unicode code points; every list inside an item SHALL be sorted the same way, without repeats. Characters U+007F to U+009F SHALL be written as `\u` escapes. The same machine state SHALL give a byte-identical snapshot apart from `takenAt`.

#### Scenario: Same state twice
- **WHEN** discovery runs twice on an unchanged fictitious machine
- **THEN** the two files differ only in `takenAt`

### Requirement: User in paths
Paths SHALL be recorded as found, including the macOS user name inside `/Users/<user>/`, and `machine.user` SHALL be the current macOS user name. Examples, fixtures and documentation in this repository SHALL use `username` for that name.

#### Scenario: App in the home folder
- **WHEN** the home folder is `/Users/username` and `~/Applications/Northwind Draw.app` exists
- **THEN** the item's `path` is `/Users/username/Applications/Northwind Draw.app`

#### Scenario: Fictitious user in the repository
- **WHEN** the repository's documentation, examples and test fixtures are searched for `/Users/<name>/`
- **THEN** every match uses `username`

### Requirement: Read-only towards the machine
Discovery SHALL NOT use `sudo`, open network connections, send telemetry or call an AI model, and SHALL write nothing except the snapshot file and its folders.

#### Scenario: Writes only the snapshot
- **WHEN** discovery runs under the Node.js permission model with write access only to the snapshot folder
- **THEN** it succeeds
