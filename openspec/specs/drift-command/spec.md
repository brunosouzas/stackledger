# drift-command Specification

## Purpose
Defines `stackledger drift`, the command that compares a machine snapshot with the components of a catalogue through their discovery annotations, and prints what to declare, what is missing and which relations to confirm.

## Requirements

### Requirement: Command
`stackledger drift <folder> [--snapshot <file>] [--format text|json] [--scaffold <dir>]` SHALL compare a snapshot with the components of the catalogue's `full` view, print the result on stdout and exit 0, whether or not anything differs. The default snapshot is this machine's `~/.stackledger/<machine>/snapshot.json`; the default format is `text`. Without `--scaffold` it SHALL only read files; it SHALL never edit the catalogue.

#### Scenario: Explicit snapshot
- **WHEN** the command runs as `stackledger drift examples/northwind --snapshot examples/northwind-machine/snapshot.json`
- **THEN** stdout is the text result and the exit code is 0

#### Scenario: Default snapshot
- **WHEN** the command runs on a fictitious machine named `username - MacBook Air` without `--snapshot`
- **THEN** it reads `~/.stackledger/username-macbook-air/snapshot.json`

#### Scenario: Drift read-only
- **WHEN** the command runs under the Node.js permission model with read access only
- **THEN** it succeeds and no file in the catalogue folder changes

### Requirement: Drift usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder, more than one folder, an unknown option, a `--format` other than `text` or `json`, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2.

#### Scenario: Unknown drift format
- **WHEN** the command runs with `--format csv`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed formats

#### Scenario: No catalogue folder
- **WHEN** the command runs as `stackledger drift`
- **THEN** the exit code is 2, stdout is empty and stderr says a folder is required

### Requirement: Snapshot input
A missing snapshot SHALL exit 2 with stdout empty and a reason telling to run `stackledger discover`. One that is not a regular file, is over 32 MiB, is not JSON, breaks the `stackledger-snapshot/v1` shape or its consistency rules, or fails the snapshot secret guard SHALL exit 2 with a fixed reason naming the problem, never a path or the file's content. Without `--snapshot`, a machine name that cannot be found (no macOS, no sandbox) SHALL exit 2 asking for `--snapshot`.

#### Scenario: No snapshot yet
- **WHEN** the default snapshot does not exist
- **THEN** the exit code is 2, stdout is empty and stderr says to run `stackledger discover`

#### Scenario: Snapshot in another format
- **WHEN** the snapshot's `format` is `stackledger-snapshot/v9`
- **THEN** the exit code is 2 and stderr says the snapshot format is not supported

#### Scenario: Inconsistent snapshot
- **WHEN** the snapshot holds an item of a source whose status is `skipped`
- **THEN** the exit code is 2, stdout is empty and stderr says the snapshot is not consistent

#### Scenario: Secret in a snapshot
- **WHEN** an edited snapshot holds a private key in an item's `title`
- **THEN** the exit code is 2 and stderr names the rule but not the value

#### Scenario: Default snapshot on Linux
- **WHEN** the command runs on Linux without `--snapshot`
- **THEN** the exit code is 2 and stderr asks for `--snapshot`

### Requirement: Catalogue with errors
A catalogue with errors SHALL still be compared, using the components the `full` view serves. When the catalogue has errors or warnings, the command SHALL write the same counts line as `stackledger report` on stderr.

#### Scenario: Catalogue error
- **WHEN** one component file has an error and another component matches an installed item
- **THEN** stderr has the counts line, the match is in the result and the exit code is 0

### Requirement: Matching through annotations
A component SHALL match an item when its annotation `stackledger/<source>` lists the item's `id` for the item's source. Identifiers are compared exactly, except `app`, which ignores ASCII case, and `pipx`, which compares names in lower case with each run of `-`, `_` and `.` read as one `-`. A component's name, title or any other field SHALL never be used to match.

#### Scenario: Name is not enough
- **WHEN** a component is named `git` without annotations and the formula `git` is installed
- **THEN** `git` is listed as not declared

#### Scenario: Bundle identifier in another case
- **WHEN** a component has `stackledger/app: COM.Northwind.Editor` and the app `com.northwind.editor` is installed
- **THEN** they match

#### Scenario: Python package spelling
- **WHEN** a component has `stackledger/pipx: Northwind_Docs` and the pipx item is `northwind-docs`
- **THEN** they match

### Requirement: Not declared
Each item no component matches SHALL be listed as not declared, with the annotation it would need (`stackledger/<source>: <id>`). A `brew` item with `onRequest` false, an `app` whose `id` starts with `com.apple.` and has no App Store receipt, and a `launchd` item whose `id` starts with `com.apple.` SHALL instead be counted (as dependencies and as macOS items), not listed; they still match when annotated.

#### Scenario: Undeclared cask
- **WHEN** the cask `northwind-editor` is installed and no component lists it
- **THEN** it is listed as not declared with `stackledger/cask: northwind-editor`

#### Scenario: Formula installed as a dependency
- **WHEN** `libnorth` is installed only as a dependency and no component lists it
- **THEN** it is not listed and the dependency count is 1

#### Scenario: Apple app
- **WHEN** `com.apple.northwindsample` is installed in `/Applications` without an App Store receipt and no component lists it
- **THEN** it is not listed and the macOS item count is 1

### Requirement: Declared but missing
Each identifier a component lists for a source whose status is `ok` that matches no item SHALL be listed as missing, with the component, and marked `incomplete` when that source's `ignored` count is not zero (the identifier may be in an entry that could not be read). An identifier for a `skipped` or `failed` source SHALL be listed as not checked with that source's status, never as missing.

#### Scenario: Missing app
- **WHEN** a component has `stackledger/app: com.northwind.legacy` and the `app` source is `ok` without that item
- **THEN** it is listed as missing for that component

#### Scenario: Source skipped
- **WHEN** a component has `stackledger/mas: 1234567890` and the `mas` source is `skipped`
- **THEN** it is listed as not checked with status `skipped`, and not as missing

#### Scenario: Missing from an incomplete source
- **WHEN** a component has `stackledger/launchd: com.northwind.backup`, `launchd` is `ok` with `ignored` 1, and no item has that label
- **THEN** it is listed as missing and marked `incomplete`

### Requirement: Shared items
An item matched by two or more components SHALL be listed as shared, with every matching component in reference order, and SHALL count once as matched.

#### Scenario: Two components for one item
- **WHEN** `component:editor` and `component:editor-beta` both list the cask `northwind-editor`
- **THEN** the item is listed as shared by both, in that order

### Requirement: Inferred needs
An item SHALL need another when: it is a `brew` item whose `dependsOn` holds that formula; or it is a `launchd` item whose `program` starts with that `app` item's `path` and `/`; or its `program` starts with `<prefix>/Cellar/<name>/` or `<prefix>/opt/<name>/`, `<prefix>` being `/opt/homebrew` or `/usr/local` and `<name>` the part of that `brew` item's `id` after its last `/`, and no other `brew` item has that `<name>`.

#### Scenario: Job inside an app
- **WHEN** the job `com.northwind.sync` runs `/Applications/Northwind Sync.app/Contents/MacOS/sync`
- **THEN** it needs the app whose path is `/Applications/Northwind Sync.app`

#### Scenario: Job of a formula
- **WHEN** a job runs `/opt/homebrew/opt/forge/bin/forge`
- **THEN** it needs the formula `forge`

#### Scenario: Job of a tap formula
- **WHEN** a job runs `/opt/homebrew/opt/ledger/bin/ledger` and the only formula named `ledger` is `northwind/tools/ledger`
- **THEN** it needs `northwind/tools/ledger`

#### Scenario: Two formulae with one short name
- **WHEN** a job runs `/opt/homebrew/opt/ledger/bin/ledger` and both `ledger` and `northwind/tools/ledger` are installed
- **THEN** the job needs neither

#### Scenario: Prefix that only looks alike
- **WHEN** a job runs `/Applications/Northwind Sync Helper.app/Contents/MacOS/helper` and only `/Applications/Northwind Sync.app` is installed
- **THEN** the job needs nothing

### Requirement: Proposed relations
When component A matches an item that needs an item matched by component B, A and B differ, and A's `spec.dependsOn` does not reference B (ignoring case), the command SHALL propose `A dependsOn B` with the item pair that suggests it. Each pair of components is proposed once, with its reasons in order.

#### Scenario: Formula dependency proposed
- **WHEN** `component:forge` lists `forge`, `component:libnorth` lists `libnorth`, and `forge` depends on `libnorth`
- **THEN** `component:forge dependsOn component:libnorth` is proposed

#### Scenario: Relation already declared
- **WHEN** `component:forge` already has `dependsOn: [Component:LibNorth]`
- **THEN** nothing is proposed for that pair

### Requirement: Annotations proposed for a cask
When components match a cask whose `apps` holds the folder name of an installed `app` item that no component matches, the not-declared entry of that app SHALL list every such component, without repeats and in reference order, as the ones that probably need its `stackledger/app` annotation.

#### Scenario: App installed by a cask
- **WHEN** `component:editor` lists the cask `northwind-editor`, which installs `Northwind Editor.app`, and the app `com.northwind.editor` is not declared
- **THEN** that app's entry suggests `component:editor`

#### Scenario: App installed by a shared cask
- **WHEN** `component:editor` and `component:editor-beta` both list that cask
- **THEN** the app's entry suggests both components, in that order

### Requirement: Identifiers that cannot be annotated
An item whose `id` holds a comma or a control character, or starts or ends with white space, cannot be written in an annotation and never matches a component. Unless the rules of "Not declared" count it as a dependency or a macOS item (they come first), it SHALL be listed as not declared with no annotation and a note saying so.

#### Scenario: Label with a comma
- **WHEN** a launchd item's `id` is `com.northwind.sync,helper`
- **THEN** it is listed as not declared, with no annotation and the note that it cannot be annotated

#### Scenario: Dependency that cannot be annotated
- **WHEN** a formula `forge,helper` is installed only as a dependency
- **THEN** it is counted as a dependency and not listed

### Requirement: Drift text output
The text output SHALL list, in this order: the snapshot's machine and `takenAt`; counts; not declared, grouped by source; missing; not checked; shared; proposed relations. Empty sections are left out, and with nothing to report the output says so. Every text taken from the catalogue or the snapshot SHALL have C0 and C1 control characters removed before it is written to stdout or stderr; the output's own line feeds stay.

#### Scenario: Nothing differs
- **WHEN** every listed item matches and every identifier is installed
- **THEN** the output has the machine, the counts and a line saying there is no drift

#### Scenario: Control characters removed
- **WHEN** an installed app's title holds a line break and a terminal escape, and a component title holds a C1 character
- **THEN** no line of the text output contains a control character, and the app is on one line

### Requirement: Drift JSON output
With `--format json`, stdout SHALL be one JSON object in the shape of design D9 (`snapshot`, `counts`, `notDeclared`, `missing`, `notChecked`, `shared`, `matched`, `proposedRelations`), which `docs/discovery.md` documents. Strings keep their values, but characters U+007F to U+009F SHALL be written as `\u` escapes, so no raw control character reaches a terminal.

#### Scenario: JSON lists
- **WHEN** the format is `json` and one cask is not declared
- **THEN** `notDeclared` has one entry with `source` `cask`, its `id` and its `annotation`

#### Scenario: C1 character in JSON
- **WHEN** an app title holds U+009B and the format is `json`
- **THEN** stdout holds `\u009b` in its place and parses back to the same title

### Requirement: Deterministic drift
The same snapshot and catalogue SHALL give byte-identical output. Items SHALL be sorted by source order, then `id`, then `path` (an item without path first); entries naming a component by that component's reference first; components within an entry by reference; relations by the two references. References compare by name in Unicode code points, as the tool's other results do; other text by code points.

#### Scenario: Same input twice
- **WHEN** the command runs twice with the same snapshot and catalogue
- **THEN** both outputs are byte-identical

#### Scenario: Names in mixed case
- **WHEN** components `Zed` and `alpha` both list one cask
- **THEN** the shared entry lists `component:Zed` before `component:alpha`

### Requirement: Scaffold folder
With `--scaffold <dir>`, the command SHALL also write catalogue files for the items it lists as not declared into `dir`, nothing else and never in the catalogue folder; stdout is the same as without the option. `dir` SHALL NOT exist yet, be inside the catalogue folder or contain it; each folder on its parent's real path, from `/` down, SHALL be owned by the user or root and not writable by group or others unless it has the sticky bit. Otherwise it is a usage error (exit 2, nothing written).

#### Scenario: Scaffold written
- **WHEN** the command runs with `--scaffold ./new-items` and two casks are not declared
- **THEN** `./new-items` holds two `.yaml` files, stdout is the same as without `--scaffold`, and the catalogue folder is unchanged

#### Scenario: Scaffold folder exists
- **WHEN** `--scaffold` names a folder that already exists
- **THEN** the exit code is 2, stdout is empty and nothing is written

#### Scenario: Scaffold inside the catalogue
- **WHEN** `--scaffold` names a folder inside the catalogue folder
- **THEN** the exit code is 2, stdout is empty and nothing is written

#### Scenario: Scaffold parent writable by others
- **WHEN** `--scaffold` names a new folder whose parent has mode 0777 without the sticky bit
- **THEN** the exit code is 2, stdout is empty and nothing is written

#### Scenario: Scaffold ancestor writable by others
- **WHEN** `--scaffold` names a new folder in a private parent, and a folder above that parent has mode 0777 without the sticky bit
- **THEN** the exit code is 2, stdout is empty and nothing is written

### Requirement: Scaffold content
Each file SHALL hold one `Component` with `metadata.name`, `metadata.title` (the item's title without control characters, else its `id`), the discovery annotations, `spec.type` (`service` for `launchd`, else `tool`), `lifecycle: active`, `owner: unknown` and any `dependsOn` from the rule below, after a comment saying it is a draft. No `path`, `program`, `script`, version or `machine` field is copied; identifiers and titles are.

#### Scenario: Scaffold of a cask
- **WHEN** the cask `northwind-editor` is not declared
- **THEN** its file holds a component with the annotation `stackledger/cask: northwind-editor`, `owner: unknown` and no version or path

#### Scenario: Title of control characters only
- **WHEN** an undeclared app's title is only control characters
- **THEN** its file's title is the app's `id`

### Requirement: Scaffold files pass validation
Before anything is written, each file SHALL be checked as a one-file catalogue with the rules of `stackledger validate`, secret guard and 1 MiB limit included. A file with any error SHALL be left out, and stderr SHALL say how many were left out, without their content.

#### Scenario: Card number built by removing controls
- **WHEN** an undeclared app's title is `4111`, tab, `1111`, tab, `1111`, tab, `1111`
- **THEN** no file is written for it and stderr says one file was left out

### Requirement: Scaffold grouping and relations
Undeclared items with the same source and identifier (as matching compares them) SHALL share one file. An undeclared app whose folder name is in the `apps` of undeclared casks SHALL go into the file of the first such cask in the not-declared order. Items with suggested components, without annotation, or only counted get no file. `spec.dependsOn` lists, in reference order, each catalogue or scaffold component that matches an item the file's items need.

#### Scenario: Cask and its app in one file
- **WHEN** the cask `northwind-editor` and its app `com.northwind.editor` are both not declared
- **THEN** one file holds both `stackledger/cask` and `stackledger/app` annotations, and no other file names that app

#### Scenario: One app in two places
- **WHEN** `com.northwind.draw` is installed in `/Applications` and in `~/Applications` and is not declared
- **THEN** one file holds `stackledger/app: com.northwind.draw`

#### Scenario: Two casks install one app
- **WHEN** the undeclared casks `northwind-draw` and `northwind-draw-beta` both install `Northwind Draw.app`, also undeclared
- **THEN** the app's annotation is only in the file of `northwind-draw`

#### Scenario: Scaffold relation
- **WHEN** the formula `forge` is not declared, needs `libnorth`, and `component:libnorth` lists `libnorth`
- **THEN** the file for `forge` has `dependsOn: [component:libnorth]`

### Requirement: Scaffold names
`metadata.name` SHALL be the item's title, else the part of its `id` after the last `/`, folded as the machine name is folded; an empty result is `item`. When that name, ignoring case, is used by a catalogue `Component` or an earlier file, `-2`, `-3` and so on are added, the base cut so the name stays at most 63 characters. Files are named `<name>.yaml` and get names in the order of the not-declared list.

#### Scenario: Name already in the catalogue
- **WHEN** the catalogue has `component:northwind-editor` without annotations and the cask `northwind-editor` is not declared
- **THEN** the scaffold file is `northwind-editor-2.yaml` with that name

#### Scenario: Scaffold passes validate
- **WHEN** the scaffold files are copied into the Northwind catalogue
- **THEN** `stackledger validate` reports no more errors or warnings than before

### Requirement: Scaffold write
The command SHALL create `dir` itself with mode 0700 and an exclusive create that fails when it already exists (exit 2), write only inside it, and write the files before stdout. Before each file and before stdout, `dir` SHALL still be that folder (same device and inode, no link), else exit 1 with one error line. Text in the files SHALL be YAML-escaped so any title stays one scalar.

#### Scenario: Scaffold folder created meanwhile
- **WHEN** `dir` is created by another process after the checks and before the command creates it
- **THEN** the exit code is 2, stdout is empty, and nothing is written in `dir`

#### Scenario: Scaffold folder replaced during the write
- **WHEN** after the first file is written, `dir` is moved away and a link to another folder takes its place
- **THEN** the exit code is 1, stdout is empty, and nothing is written in the link's target

#### Scenario: Title that looks like YAML
- **WHEN** an app title is `Northwind: Editor # beta` and holds a line break
- **THEN** its file parses back to one component whose title is that text on one line

### Requirement: Scaffold folder where checked
After creating `dir`, the command SHALL check that the real path of `dir` is the real path of the parent it checked joined with the folder's name, and that it is neither inside the catalogue folder nor contains it. Otherwise it SHALL remove the folder it created, only while that folder is empty and has the same device and inode, write no file, and exit 1 with one error line.

#### Scenario: Scaffold parent replaced before the folder is created
- **WHEN** after the checks and before `dir` is created, its parent is replaced by a link to the catalogue folder
- **THEN** the exit code is 1, stdout is empty, and nothing is left in the catalogue folder

### Requirement: Scaffold rollback
A write failure SHALL exit 1 with one error line and write nothing on stdout. It SHALL remove each file whose exclusive create succeeded while it is still that file (same device and inode), then `dir` while it is still the folder created and empty; anything else SHALL be kept.

#### Scenario: Scaffold write fails
- **WHEN** writing the second file fails
- **THEN** the exit code is 1, stdout is empty, and `dir` does not exist

#### Scenario: Scaffold rollback keeps a replaced file
- **WHEN** another process replaces the first file after it is written, and creating the second file fails
- **THEN** the exit code is 1, stdout is empty, and the replacement file is still in `dir`

#### Scenario: Scaffold rollback keeps a replaced folder
- **WHEN** writing the second file fails and, after the rollback removes the files, another process moves `dir` away and creates an empty folder at its path
- **THEN** the exit code is 1, stdout is empty, the error line says the scaffold folder could not be removed, and the new folder still exists

### Requirement: Drift failures
A failure while comparing or serialising SHALL exit 1 with stdout empty and one error line on stderr, without usage. A failure while writing stdout SHALL exit 1 with one error line on stderr.

#### Scenario: Drift closed pipe
- **WHEN** stdout is closed after the first bytes
- **THEN** the exit code is 1 and stderr has one error line without usage

### Requirement: Drift performance
Comparing a snapshot of 2,000 items with a catalogue of 500 components SHALL take under 2 seconds.

#### Scenario: Large drift
- **WHEN** the command compares 2,000 items with 500 annotated components
- **THEN** it finishes in under 2 seconds

### Requirement: What a launchd job runs
In the text output, a not-declared `launchd` line SHALL have, right after ` (<path>)`, `  runs <program>` and, when `script` is not null, ` <script>`; nothing when `program` is null. In the JSON output every `notDeclared` entry SHALL have `program` and `script` right after `path`: the item's values for `launchd`, null for other sources. Control characters are removed in the text output.

#### Scenario: Interpreter job not declared
- **WHEN** the user agent `com.northwind.indexer` at `/Users/username/Library/LaunchAgents/com.northwind.indexer.plist`, with `program` `/usr/bin/python3` and `script` `/Users/username/northwind/indexer.py`, is not declared
- **THEN** its text line is `launchd  com.northwind.indexer (/Users/username/Library/LaunchAgents/com.northwind.indexer.plist)  runs /usr/bin/python3 /Users/username/northwind/indexer.py  -> stackledger/launchd: com.northwind.indexer`, and its JSON entry has that `program` and `script` after `path`

#### Scenario: Job without a program
- **WHEN** a not-declared launchd item has `program` null
- **THEN** its text line has no `runs` part, and its JSON entry has `program` null and `script` null

#### Scenario: Other sources
- **WHEN** a cask is not declared and the format is `json`
- **THEN** its `notDeclared` entry has `program` null and `script` null

### Requirement: Snapshot without script
A `stackledger-snapshot/v1` snapshot whose launchd items have no `script` field, as written before that field existed, SHALL be read as if each had `script` null. A launchd item with a `script` that is neither a string nor null breaks the snapshot shape.

#### Scenario: Snapshot from before the script field
- **WHEN** a `stackledger-snapshot/v1` snapshot's launchd items have no `script` field
- **THEN** drift reads it, and each such item not declared shows its program and no script

#### Scenario: Script of the wrong type
- **WHEN** an edited snapshot has a launchd item with `script` `42`
- **THEN** the exit code is 2 and stderr says the snapshot shape is not valid

### Requirement: Helpers suggest their app's components
The not-declared entry of a `launchd` item whose scope is `app-agent`, `app-daemon` or `app-login-item` SHALL list every component that matches the `app` item whose `path` followed by `/` starts the item's `path`, without repeats and in reference order, as the ones that probably need its `stackledger/launchd` annotation; when none does, it SHALL list what that app's entry suggests ("Annotations proposed for a cask"). A helper never matches through its app.

#### Scenario: Helper of a declared app
- **WHEN** `component:utils` lists the app whose path is `/Applications/Northwind Utils.app`, and its daemon `com.northwind.utils.fan` is not declared
- **THEN** the daemon is listed as not declared with `stackledger/launchd: com.northwind.utils.fan` and suggests `component:utils`

#### Scenario: Helper of an undeclared app
- **WHEN** neither the app `/Applications/Northwind Utils.app` nor its daemon is declared
- **THEN** both are listed as not declared and the daemon suggests nothing

#### Scenario: Helper of an app a cask installs
- **WHEN** `component:display` lists the cask that installs `Northwind Display.app`, the app is not declared, and neither is its agent
- **THEN** the app's entry and the agent's entry both suggest `component:display`

#### Scenario: App path that only looks alike
- **WHEN** `component:sync` lists the app `/Applications/Northwind Sync.app` and a helper's path is inside `/Applications/Northwind Sync Helper.app`
- **THEN** that helper suggests nothing from `component:sync`

#### Scenario: Job outside an app
- **WHEN** a `user-agent` job's program is inside a declared app
- **THEN** its entry suggests nothing (it still needs that app, "Inferred needs")

### Requirement: Scaffold of app helpers
An undeclared helper (scope `app-agent`, `app-daemon` or `app-login-item`) with no suggested components, whose app is not declared either, SHALL go into the scaffold file that holds that app's annotation (the app's own file, or the cask file it joined), not into a file of its own. Entries sharing its identifier go with it; when any of them has suggested components, none gets a file.

#### Scenario: App and its helper in one file
- **WHEN** the app `com.northwind.utils` and its daemon `com.northwind.utils.fan` are both not declared
- **THEN** one file holds `stackledger/app: com.northwind.utils` and `stackledger/launchd: com.northwind.utils.fan`, and no other file names the daemon

#### Scenario: Helper of an app with a suggestion
- **WHEN** the daemon's app is not declared but its entry suggests `component:utils`
- **THEN** the daemon gets no file, like its app

#### Scenario: Old agent with the helper's label
- **WHEN** `~/Library/LaunchAgents` holds a job labelled `com.northwind.utils.fan`, the same label as a daemon `Northwind Utils.app` declares, and only the app's component is declared
- **THEN** no scaffold file holds `stackledger/launchd: com.northwind.utils.fan`
