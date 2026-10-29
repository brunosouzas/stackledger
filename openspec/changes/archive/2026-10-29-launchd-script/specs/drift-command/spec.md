## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Scaffold content
Each file SHALL hold one `Component` with `metadata.name`, `metadata.title` (the item's title without control characters, else its `id`), the discovery annotations, `spec.type` (`service` for `launchd`, else `tool`), `lifecycle: active`, `owner: unknown` and any `dependsOn` from the rule below, after a comment saying it is a draft. No `path`, `program`, `script`, version or `machine` field is copied; identifiers and titles are.

#### Scenario: Scaffold of a cask
- **WHEN** the cask `northwind-editor` is not declared
- **THEN** its file holds a component with the annotation `stackledger/cask: northwind-editor`, `owner: unknown` and no version or path

#### Scenario: Title of control characters only
- **WHEN** an undeclared app's title is only control characters
- **THEN** its file's title is the app's `id`
