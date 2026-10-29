# mac-discovery Specification

## Purpose
Defines what stackledger reads from a Mac to learn what is installed, how each source is read without changing the machine, the machine name, and the content of the snapshot it produces.

## Requirements

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
A program SHALL be looked up in the absolute directories of `PATH` in order (relative and empty entries are skipped, so the current folder never decides which program runs), then in `/opt/homebrew/bin` and `/usr/local/bin`; the first executable regular file, or link to one, wins. A program that is not found makes its source `skipped` with reason `not found`.

#### Scenario: Homebrew outside PATH
- **WHEN** `PATH` holds no `brew` and `/opt/homebrew/bin/brew` exists
- **THEN** that program is run

#### Scenario: Relative PATH entry
- **WHEN** `PATH` is `bin:/usr/bin`, the current folder holds `bin/brew`, and neither `/usr/bin` nor the two Homebrew folders hold a `brew`
- **THEN** `brew` is `skipped` with reason `not found` and the program in `./bin` never runs

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
`app` SHALL look at the folders named `*.app` directly inside `/Applications` and `~/Applications`, and inside their subfolders one level down. It SHALL NOT look inside an `.app` beyond `Contents/Info.plist` and `Contents/_MASReceipt`. When neither folder exists the source is `skipped`.

#### Scenario: App in a subfolder
- **WHEN** `/Applications/Utilities/Northwind Monitor.app` exists
- **THEN** it is recorded

### Requirement: Applications not followed
`app` SHALL NOT follow a symbolic link: a linked `/Applications` or `~/Applications` (which still exists, so the source is not `skipped`), a linked subfolder and a linked `.app` are each counted as one ignored entry. An `.app` entry or other top-level entry that cannot be examined, and a subfolder that cannot be listed, are each counted as ignored.

#### Scenario: Linked Applications folder
- **WHEN** `/Applications` is a symbolic link to a folder holding `Northwind Hidden.app`, and `~/Applications` holds `Northwind Draw.app`
- **THEN** only `Northwind Draw.app` is recorded, `app` is `ok` and `ignored` counts the link once

#### Scenario: Linked subfolder
- **WHEN** `/Applications/Northwind Suite` is a symbolic link to a folder holding `Northwind Calc.app`
- **THEN** `Northwind Calc.app` is not recorded, `app` is `ok` and `ignored` counts the link once

#### Scenario: Linked app
- **WHEN** `/Applications/Northwind Viewer.app` is a symbolic link
- **THEN** it is not recorded and `ignored` counts it

#### Scenario: Unreadable app entry
- **WHEN** `/Applications/Northwind Vault.app` cannot be examined
- **THEN** `app` is `ok` and `ignored` counts it

#### Scenario: Unreadable subfolder
- **WHEN** the subfolder `/Applications/Northwind Suite` cannot be listed
- **THEN** `app` is `ok` and `ignored` counts it once

#### Scenario: Unexaminable entry in Applications
- **WHEN** the entry `/Applications/Northwind Tools`, not named `.app`, cannot be examined (lstat fails)
- **THEN** `app` is `ok` and `ignored` counts it once

### Requirement: Application fields
`app` SHALL read each bundle's `Contents/Info.plist` with `plutil`. The item has `id` = `CFBundleIdentifier`; `title` = `CFBundleDisplayName`, else `CFBundleName`, else the folder name without `.app`, else (all three empty) the `id`; `versions` = `CFBundleShortVersionString` when present; `path`; and `appStore` = whether `Contents/_MASReceipt` exists. A bundle without a readable identifier, or whose `Contents` or `Info.plist` is a link (never read), is counted as ignored.

#### Scenario: App Store receipt
- **WHEN** `Northwind Notes.app` has `Contents/_MASReceipt`
- **THEN** its item has `appStore` true

#### Scenario: App without identifier
- **WHEN** an `.app` has an `Info.plist` without `CFBundleIdentifier`
- **THEN** it is not recorded and `ignored` counts it

#### Scenario: Linked bundle contents
- **WHEN** `/Applications/Northwind Shadow.app` is a folder whose `Contents` is a symbolic link to a folder holding an `Info.plist`
- **THEN** that plist is not read, the bundle is not recorded and `ignored` counts it

#### Scenario: Linked Info.plist
- **WHEN** `/Applications/Northwind Mirror.app/Contents/Info.plist` is a symbolic link to a plist elsewhere
- **THEN** `plutil` never reads it, the bundle is not recorded and `ignored` counts it

#### Scenario: App with an empty name
- **WHEN** a bundle named `.app` has `CFBundleIdentifier` `com.northwind.blank` and no display or bundle name
- **THEN** its item's `title` is `com.northwind.blank`

### Requirement: launchd jobs
`launchd` SHALL read the `.plist` files directly inside `~/Library/LaunchAgents` (scope `user-agent`), `/Library/LaunchAgents` (scope `agent`) and `/Library/LaunchDaemons` (scope `daemon`), not following links: a linked folder or file counts as one ignored entry. The item has `id` = `Label`, `scope`, `path` of the file and `program` = `Program`, else the first entry of `ProgramArguments`, else null. A file that cannot be examined or read, or has no `Label`, is counted as ignored.

#### Scenario: Agent of the user
- **WHEN** `~/Library/LaunchAgents/com.northwind.sync.plist` has `Label` `com.northwind.sync` and `ProgramArguments` `["/Applications/Northwind Sync.app/Contents/MacOS/sync", "--quiet"]`
- **THEN** the item has scope `user-agent`, `program` `/Applications/Northwind Sync.app/Contents/MacOS/sync` and `script` null

#### Scenario: Unreadable daemon
- **WHEN** a file in `/Library/LaunchDaemons` cannot be read by the user
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Unexaminable launchd file
- **WHEN** a `.plist` listed in `/Library/LaunchDaemons` cannot be examined (lstat fails)
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Linked launchd folder
- **WHEN** `/Library/LaunchDaemons` is a symbolic link to a folder holding a job file
- **THEN** that job is not recorded, `launchd` is `ok` and `ignored` counts the link once

### Requirement: launchd privacy
Discovery SHALL read only the keys `Label`, `Program`, `ProgramArguments.0` and, in a helper plist, `BundleProgram` of a launchd file, plus `ProgramArguments.1` once when `program` is an interpreter ("launchd script"), and only `CFBundleIdentifier` and `CFBundleExecutable` of a login item's `Info.plist`, one `plutil -extract <key> raw` run per key, so no other argument, environment variable or key is read or reaches the snapshot.

#### Scenario: Arguments are not recorded
- **WHEN** a job's `ProgramArguments` is `["/usr/local/bin/northwind-agent", "--token", "nw-example-value"]` and it has `EnvironmentVariables`
- **THEN** the snapshot contains neither `nw-example-value` nor any environment variable, and every `plutil` run on that file extracts `Label`, `Program` or `ProgramArguments.0`

#### Scenario: Later arguments of an interpreter job
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "/Users/username/northwind/agent.py", "--token", "nw-example-value"]` and that script file exists
- **THEN** `script` is `/Users/username/northwind/agent.py`, the snapshot does not contain `nw-example-value`, every `plutil` run on that file extracts `Label`, `Program`, `ProgramArguments.0` or `ProgramArguments.1`, and `ProgramArguments.1` is extracted once

#### Scenario: Token as first argument
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "nw-example-value"]`
- **THEN** `script` is null and the snapshot does not contain `nw-example-value`

#### Scenario: Token that looks like a path
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "/nwExampleValue+9a/Q="]` and no such file exists
- **THEN** `script` is null and the snapshot does not contain `/nwExampleValue+9a/Q=`

#### Scenario: Helper arguments are not recorded
- **WHEN** a helper plist has `BundleProgram` `Contents/MacOS/agent`, `ProgramArguments` `["agent", "--token", "nw-example-value"]` and `EnvironmentVariables`
- **THEN** the snapshot contains neither `nw-example-value` nor any environment variable, and every `plutil` run on that file extracts `Label`, `Program`, `ProgramArguments.0` or `BundleProgram`

#### Scenario: Keys of a login item
- **WHEN** a login item's `Info.plist` also has `LSEnvironment` with `NORTHWIND_TOKEN`
- **THEN** every `plutil` run on that file extracts `CFBundleIdentifier` or `CFBundleExecutable`, and the snapshot does not contain `NORTHWIND_TOKEN`

### Requirement: mise
`mise` SHALL list the folders inside `installs` of the mise data folder (`$MISE_DATA_DIR`, else `$XDG_DATA_HOME/mise`, else `~/.local/share/mise`). Each tool folder is one item with `id` = the folder name and `versions` = the names of its version folders, leaving out symbolic links such as `latest`. It SHALL NOT run `mise`. Without that folder the source is `skipped`. A linked data folder, `installs` folder or tool folder is not followed and counts as one ignored entry.

#### Scenario: Tool with an alias link
- **WHEN** `installs/node` holds the folders `22.12.0` and `24.1.0` and a link `22`
- **THEN** the item `node` has `versions` `["22.12.0", "24.1.0"]`

#### Scenario: Linked mise data folder
- **WHEN** `$MISE_DATA_DIR` is a symbolic link to a folder whose `installs` holds a tool
- **THEN** `mise` is `ok` with no item and `ignored` counts the link once

#### Scenario: Linked mise installs folder
- **WHEN** `installs` is a symbolic link to a folder holding a tool
- **THEN** `mise` is `ok` with no item and `ignored` counts the link once

#### Scenario: Linked tool folder
- **WHEN** `installs/deno` is a symbolic link to a folder holding a version folder
- **THEN** no item `deno` is recorded and `ignored` counts the link once

### Requirement: npm
`npm` SHALL run `npm ls --global --depth=0 --json --offline` and record each top-level package as an item with `id` = its name and `versions`. A non-zero exit whose stdout is a JSON object with `dependencies` SHALL still be read; any other non-zero exit fails the source.

#### Scenario: npm reports a problem but lists packages
- **WHEN** `npm` exits with code 1 and prints JSON listing `northwind-cli` 3.0.0
- **THEN** the `npm` item `northwind-cli` is recorded and the source is `ok`

### Requirement: pipx
`pipx` SHALL read `pipx_metadata.json` in each folder of `venvs` in the pipx home (`$PIPX_HOME`, else `~/.local/pipx` when it exists, else `~/Library/Application Support/pipx`). The item has `id` = `main_package.package` and `versions` = `main_package.package_version`. It SHALL NOT run `pipx`. A metadata file that cannot be read, is not JSON, or lacks either field as a non-empty string, and a linked pipx home, `venvs` folder or venv (never followed), each count as one ignored entry.

#### Scenario: pipx package
- **WHEN** `venvs/northwind-docs/pipx_metadata.json` names the package `northwind-docs` at version `1.6.0`
- **THEN** the `pipx` item `northwind-docs` has `versions` `["1.6.0"]`

#### Scenario: Broken pipx metadata
- **WHEN** one venv's `pipx_metadata.json` has `main_package.package_version` as a number
- **THEN** that venv is counted as ignored and the other venvs are recorded

#### Scenario: Linked pipx home
- **WHEN** `~/.local/pipx` is a symbolic link to a folder whose `venvs` holds a package
- **THEN** `pipx` is `ok` with no item and `ignored` counts the link once

#### Scenario: Linked pipx venvs folder
- **WHEN** `venvs` in the pipx home is a symbolic link to a folder holding a package
- **THEN** `pipx` is `ok` with no item and `ignored` counts the link once

### Requirement: mise and pipx entries that cannot be examined
A mise tool folder or a pipx venv that is listed but cannot be examined SHALL count as one ignored entry, as in `app` and `launchd`, so `drift` marks a missing identifier of that source `incomplete`. A `~/.local/pipx` that exists but cannot be examined is still the pipx home: `pipx` fails with `cannot be read` instead of reading the other location.

#### Scenario: Unexaminable tool folder
- **WHEN** `installs/deno` is listed but `lstat` fails with a permission error
- **THEN** `mise` is `ok`, `ignored` counts it and the other tools are recorded

#### Scenario: Unexaminable venv
- **WHEN** `venvs/northwind-hidden` is listed but `lstat` fails with a permission error
- **THEN** `pipx` is `ok` and `ignored` counts it

#### Scenario: Unreadable pipx home
- **WHEN** `PIPX_HOME` is not set and `lstat` of `~/.local/pipx` fails with a permission error
- **THEN** `pipx` is `failed` with reason `cannot be read`

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

#### Scenario: Item without versions
- **WHEN** a `brew`, `cask`, `mas`, `mise`, `npm` or `pipx` item of an edited snapshot has `versions` `[]`
- **THEN** the snapshot fails its shape check, while an `app` item with no version still passes

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

### Requirement: launchd script
Each item SHALL also have `script`: `ProgramArguments.1` when the text of `program` after its last `/` (the whole value if it has none) equals, exactly and case-sensitively, `sh`, `bash`, `zsh`, `dash`, `ksh`, `python`, `python3`, `node`, `ruby`, `perl`, `osascript`, or `python3.` followed by one or more ASCII digits and nothing more, and that value starts with `/` and names an existing regular file, links followed; otherwise null.

#### Scenario: Interpreter job
- **WHEN** a job has `ProgramArguments` `["/Users/username/.venvs/northwind/bin/python3.12", "/Users/username/northwind/server.py", "--port", "8800"]` and `server.py` exists
- **THEN** the item has `program` `/Users/username/.venvs/northwind/bin/python3.12` and `script` `/Users/username/northwind/server.py`

#### Scenario: Interpreter set through Program
- **WHEN** a job has `Program` `/bin/zsh`, `ProgramArguments` `["zsh", "/Users/username/bin/northwind-backup.sh"]` and that file exists
- **THEN** the item has `program` `/bin/zsh` and `script` `/Users/username/bin/northwind-backup.sh`

#### Scenario: Interpreter with a flag first
- **WHEN** a job has `ProgramArguments` `["/bin/bash", "-c", "northwind-sync --all"]`
- **THEN** the item has `program` `/bin/bash` and `script` null

#### Scenario: Not an interpreter name
- **WHEN** jobs have `program` `/usr/local/bin/python3.12-intel64`, `/usr/bin/Python3` or `/usr/bin/perl5.34`, each followed by an existing script path
- **THEN** each item has `script` null

#### Scenario: Script is a folder
- **WHEN** an interpreter job's `ProgramArguments.1` is `/Users/username/northwind`, a folder
- **THEN** the item has `script` null

### Requirement: launchd script reading
A limit, a non-zero exit or a missing or non-string value on the `ProgramArguments.1` run, or an empty value, SHALL make `script` null and keep the item, and so SHALL a file check (`test -f`, sandboxed like every program) that cannot run, is stopped or fails; `plutil` not found keeps the rule of "Program limits". An item whose `script` breaks the snapshot secret guard SHALL be left out and counted as ignored, as "Snapshot secret guard" does for every item string.

#### Scenario: Interpreter with no argument
- **WHEN** a job has `ProgramArguments` `["/usr/bin/python3"]`
- **THEN** the item is recorded with `script` null

#### Scenario: Plist reader that hangs on the script key
- **WHEN** `plutil` hangs on `ProgramArguments.1` of an interpreter job
- **THEN** after the time limit the item is recorded with `script` null and the source is `ok`

#### Scenario: File check that hangs
- **WHEN** the file check of an interpreter job's script path hangs, as on a stale network mount
- **THEN** after the time limit the item is recorded with `script` null and the source is `ok`

#### Scenario: Script through a link
- **WHEN** an interpreter job's `ProgramArguments.1` is a symbolic link to an existing file
- **THEN** the item has that link as `script`

#### Scenario: Non-string script value
- **WHEN** an interpreter job's `ProgramArguments.1` is a dictionary
- **THEN** the item is recorded with `script` null

#### Scenario: Card number in a script path
- **WHEN** an interpreter job's `script` would be `/Users/username/4111111111111111.py`, an existing file
- **THEN** the item is left out and counted as ignored

### Requirement: App helpers
`launchd` SHALL also look inside each `.app` the `app` source looks at ("Applications found"): at the `.plist` files directly inside `Contents/Library/LaunchAgents` (scope `app-agent`) and `Contents/Library/LaunchDaemons` (scope `app-daemon`), read as launchd jobs, and at the `.app` folders directly inside `Contents/Library/LoginItems` (scope `app-login-item`). A helper folder that does not exist adds nothing. The Applications folders count among the source's folders for `skipped`.

#### Scenario: Agent inside an app
- **WHEN** `/Applications/Northwind Display.app/Contents/Library/LaunchAgents/com.northwind.display.agent.plist` has `Label` `com.northwind.display.agent`
- **THEN** the item has `id` `com.northwind.display.agent`, scope `app-agent` and `path` that file

#### Scenario: Daemon inside an app
- **WHEN** `/Applications/Northwind Utils.app/Contents/Library/LaunchDaemons/com.northwind.utils.fan.plist` has `Label` `com.northwind.utils.fan`
- **THEN** the item has scope `app-daemon` and `path` that file

#### Scenario: Login item
- **WHEN** `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app/Contents/Info.plist` has `CFBundleIdentifier` `com.northwind.vault.launcher`
- **THEN** the item has `id` `com.northwind.vault.launcher`, scope `app-login-item` and `path` `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app`

#### Scenario: Login item without identifier
- **WHEN** a login item's `Info.plist` has no `CFBundleIdentifier`
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Helper of an app in a subfolder
- **WHEN** `/Applications/Northwind Suite/Northwind Sync.app/Contents/Library/LaunchAgents/com.northwind.suite.sync.plist` has a `Label`
- **THEN** that job is recorded with scope `app-agent`

#### Scenario: Snapshot with helper scopes
- **WHEN** a `stackledger-snapshot/v1` snapshot holds a `launchd` item with scope `app-login-item`
- **THEN** it passes the snapshot shape check, and one with scope `app-service` does not

#### Scenario: Apps without job folders
- **WHEN** none of the three job folders exists and `/Applications` holds an app with one helper
- **THEN** `launchd` is `ok` with that helper

### Requirement: App helper programs
A helper plist's `program` SHALL be `Program`, else, when it has `BundleProgram`, `<app path>/<BundleProgram>` if that value does not start with `/` and has no empty, `.` or `..` part (null otherwise, and when it cannot be read), else `ProgramArguments.0`, else null. A login item's `program` SHALL be `<login item path>/Contents/MacOS/<CFBundleExecutable>` when that value is not empty, `.` or `..` and has no `/`, else null; its `script` SHALL be null.

#### Scenario: Program inside the bundle
- **WHEN** the plist of `com.northwind.display.agent` in `/Applications/Northwind Display.app` has only `BundleProgram` `Contents/MacOS/DisplayAgent`
- **THEN** its `program` is `/Applications/Northwind Display.app/Contents/MacOS/DisplayAgent`

#### Scenario: Bundle program before the arguments
- **WHEN** a helper plist in `/Applications/Northwind Display.app` has `BundleProgram` `Contents/MacOS/agent` and `ProgramArguments` `["agent", "--quiet"]`
- **THEN** its `program` is `/Applications/Northwind Display.app/Contents/MacOS/agent`

#### Scenario: Bundle program that leaves the bundle
- **WHEN** a helper plist has `BundleProgram` `../../../../usr/local/bin/northwind`, `/usr/local/bin/northwind` or `.`, and `ProgramArguments` `["northwind"]`
- **THEN** its `program` is null (not `northwind`) and the item is recorded

#### Scenario: Bundle program that hits a limit
- **WHEN** `plutil` hangs on a helper plist's `BundleProgram`, and `ProgramArguments` is `["agent"]`
- **THEN** after the time limit the item is recorded with `program` null

#### Scenario: Login item program
- **WHEN** the login item `Northwind Launcher.app` has `CFBundleExecutable` `Northwind Launcher`
- **THEN** its `program` is `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app/Contents/MacOS/Northwind Launcher` and its `script` is null

#### Scenario: Executable name with a slash
- **WHEN** a login item's `CFBundleExecutable` is `../northwind`, `..` or `.`
- **THEN** its `program` is null and the item is recorded

### Requirement: App helpers not followed
Every entry the `app` walk counts as ignored ("Applications not followed"), a linked `.app` included, SHALL count once in `launchd`'s `ignored` and not be looked into. A linked `Contents`, `Contents/Library`, helper folder, helper plist or login item, a login item whose `Contents` or `Contents/Info.plist` is a link, a folder that cannot be listed and an entry that cannot be examined or read SHALL count once and not be read.

#### Scenario: Linked helper folder
- **WHEN** `/Applications/Northwind Display.app/Contents/Library/LaunchAgents` is a symbolic link to a folder holding a job file
- **THEN** that job is not recorded and `ignored` counts the link once

#### Scenario: Linked app
- **WHEN** `/Applications/Northwind Link.app` is a symbolic link to an app with a helper
- **THEN** `launchd` records no helper of it and `ignored` counts the link once

#### Scenario: Unreadable Applications folder
- **WHEN** `/Applications` exists but cannot be listed and `~/Library/LaunchAgents` holds a job
- **THEN** `launchd` is `ok` with that job and `ignored` counts `/Applications` once

#### Scenario: Linked Applications folder
- **WHEN** `~/Applications` is a symbolic link
- **THEN** `launchd` does not follow it and `ignored` counts it once

#### Scenario: Linked Info.plist of a login item
- **WHEN** a login item's `Contents/Info.plist` is a symbolic link to a file outside the bundle
- **THEN** that file is never read and the login item counts as ignored

#### Scenario: Unreadable helper folder
- **WHEN** an app's `Contents/Library/LaunchDaemons` cannot be listed
- **THEN** it counts as one ignored entry and the source is `ok`
