## ADDED Requirements

### Requirement: Command
`stackledger mcp [folder] [--view full|staff]` SHALL serve the catalogue in `folder`, or in the current folder when none is given, as a Model Context Protocol server over stdio, in the view given by `--view` (default `full`). It SHALL stop with exit 0 when its input closes.

#### Scenario: Default folder and view
- **WHEN** the command runs as `stackledger mcp` inside a catalogue folder
- **THEN** it serves that folder in the `full` view

#### Scenario: Input closes
- **WHEN** the client closes the server's input
- **THEN** the server exits with code 0

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise an unknown option, a `--view` other than `full` or `staff`, more than one folder, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason on stderr, print nothing on stdout, and exit 2 without serving.

#### Scenario: Unknown view
- **WHEN** the command runs as `stackledger mcp --view finance`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed views

#### Scenario: Missing folder
- **WHEN** the folder does not exist
- **THEN** the exit code is 2, stdout is empty and stderr says the folder was not found

#### Scenario: Help
- **WHEN** the command runs as `stackledger mcp --help --view finance`
- **THEN** stdout shows usage and the exit code is 0

### Requirement: Tools per view
In the `full` view the server SHALL offer the tools `find_items`, `get_item`, `impact`, `gaps`, `renewals` and `validate`. In the `staff` view it SHALL offer only `find_items`, `get_item`, `impact` and `gaps`. Every tool SHALL be marked read-only.

#### Scenario: Staff tool list
- **WHEN** a client lists the tools of a server started with `--view staff`
- **THEN** it gets exactly `find_items`, `get_item`, `impact` and `gaps`

#### Scenario: Read-only hint
- **WHEN** a client lists the tools
- **THEN** every tool has the read-only annotation set

### Requirement: Fresh read on every call
Each tool call SHALL read and check the folder again and SHALL use only the documents that passed their checks. Every result SHALL include `catalogue` with the `view` and the catalogue's `errors` and `warnings` counts.

#### Scenario: Edit between calls
- **WHEN** a component is added to the folder between two `find_items` calls
- **THEN** the second call finds it

#### Scenario: Catalogue with errors
- **WHEN** one of three components has an error
- **THEN** `find_items` returns the two valid components and `catalogue.errors` is 1

#### Scenario: Folder removed while serving
- **WHEN** the folder is deleted after the server started and a tool is called
- **THEN** the call returns a tool error saying the folder was not found, and the server keeps running

### Requirement: References
A tool argument that names an item SHALL accept the catalogue's reference syntax (`component:<name>`, `resource:<name>`, `line:<name>`, kind and name in any case, optional `default/` namespace). Results SHALL write references as `component:<name>`, `resource:<name>` or `line:<name>`, with the name as written in the catalogue, and SHALL sort lists by reference unless a requirement says otherwise. A reference to no item SHALL return a tool error naming the reference given.

#### Scenario: Reference in another case
- **WHEN** `get_item` is called with `Component:default/Editor` and a component `editor` exists
- **THEN** it returns `component:editor`

#### Scenario: Unknown item
- **WHEN** `get_item` is called with `component:ghost` and no such component exists
- **THEN** the call returns a tool error that names `component:ghost`

### Requirement: find_items
`find_items` SHALL accept optional `query`, `kind` (`component`, `licence` or `line`), `zone` and `limit` (1 to 200, default 50), and return the items matching every given filter. `query` matches, ignoring case, part of the name, title, description, a tag, or a licence string field visible in the view. `zone` matches a component's `stackledger/zone` label, ignoring case. Each item has `ref`, `kind` and, when present, `title`, `type`, `lifecycle`, `owner` and `zone`. The result has `items`, `total` (before the limit) and `truncated`.

#### Scenario: Search by vendor
- **WHEN** a licence has `vendor: Northwind Studio` and `find_items` is called with `query: northwind`
- **THEN** that licence is returned

#### Scenario: Search does not match hidden fields
- **WHEN** the view is `staff` with `note` hidden, a licence has `note: renegotiate in March`, and `find_items` is called with `query: renegotiate`
- **THEN** no item is returned

#### Scenario: Limit reached
- **WHEN** 60 components match and `limit` is 50
- **THEN** 50 items are returned, `total` is 60 and `truncated` is true

#### Scenario: Limit out of range
- **WHEN** `find_items` is called with `limit: 500`
- **THEN** the call returns a tool error naming the allowed range

### Requirement: get_item
`get_item` SHALL accept `ref` and return the item as it is in the view (`metadata` and `spec`), plus `dependsOn` (references it lists that match an item), `dependants` (items that list it in `spec.dependsOn`), `lines` (lines that stop at it) and, for a component, `zone`. For a line it SHALL return its stops in order.

#### Scenario: Licence used by two components
- **WHEN** components `editor` and `forge` list `resource:licence-editor`
- **THEN** `get_item` for `resource:licence-editor` has `dependants` `component:editor` and `component:forge`

#### Scenario: Staff view hides the cost
- **WHEN** the view is `staff` and `get_item` is called for a licence
- **THEN** its `spec.licence` has no hidden field

### Requirement: impact
`impact` SHALL accept `ref` and return every item that depends on it directly or through other items, each with its `depth` (1 for direct), sorted by depth and then reference, and `lines`: every line that stops at the item or at one of those items. Each item SHALL appear once, at its smallest depth, and a cycle SHALL NOT repeat items. The item itself SHALL NOT be listed. The result SHALL stop at 500 items and then set `truncated`.

#### Scenario: Chain of dependants
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** `impact` for `component:vault` returns `component:forge` at depth 1 and `component:editor` at depth 2

#### Scenario: Cycle
- **WHEN** `a` depends on `b` and `b` depends on `a`
- **THEN** `impact` for `component:a` returns only `component:b` at depth 1

#### Scenario: Journeys affected
- **WHEN** line `ship` stops at `editor` and `editor` depends on `vault`
- **THEN** `impact` for `component:vault` lists `line:ship`

### Requirement: gaps
`gaps` SHALL take no argument and return `isolated` (components that list no matching item and that no item lists), `offMap` (components on no line) and `unusedLicences` (licences no component lists).

#### Scenario: Licence nobody uses
- **WHEN** a licence `licence-old` is listed by no component
- **THEN** `gaps` lists `resource:licence-old` in `unusedLicences`

#### Scenario: Component on no journey
- **WHEN** component `scanner` is a stop of no line
- **THEN** `gaps` lists `component:scanner` in `offMap`

### Requirement: renewals
`renewals` SHALL accept optional `days` (0 to 366, default 30) and `from` (`YYYY-MM-DD`, default the machine's local date), and return `from`, `to` (`from` plus `days`), `licences` and `unknown`. Only licences with `status` `active` or `to-confirm` count. `licences` lists those with `renewsOn` from `from` to `to`, both included, each with `ref`, `vendor`, `status`, `renewsOn`, `cycle`, `cost` and `currency`, sorted by date. `unknown` lists those whose `renewsOn` is `unknown`.

#### Scenario: Renewal inside the window
- **WHEN** `from` is `2027-06-01`, `days` is 30 and an active licence renews on `2027-07-01`
- **THEN** it is listed

#### Scenario: Cancelled licence
- **WHEN** a cancelled licence renews inside the window
- **THEN** it is not listed

#### Scenario: Renewal date unknown
- **WHEN** an active licence has `renewsOn: unknown`
- **THEN** its reference is in `unknown`

#### Scenario: Days out of range
- **WHEN** `renewals` is called with `days: 400`
- **THEN** the call returns a tool error naming the allowed range

### Requirement: validate tool
`validate` SHALL take no argument and return the same object that `stackledger validate --json` prints for the folder, with `catalogue` added.

#### Scenario: Same result as the command
- **WHEN** `validate` is called on a folder with one error
- **THEN** its `problems` and `summary` equal the output of `stackledger validate --json` on that folder

### Requirement: Read-only and offline
The server SHALL NOT create, change or delete any file and SHALL NOT open network connections. stdout SHALL carry only protocol messages.

#### Scenario: Sandboxed session
- **WHEN** the server runs under the Node.js permission model with read access to the folder only and no write or network permission, and a client calls every tool
- **THEN** every call succeeds and no file in the folder changes

### Requirement: Logs
The server SHALL write to stderr one line when it starts, with the folder, the view and the number of tools, and one line for each failed call, with the tool name and the reason. No log line SHALL contain a catalogue value.

#### Scenario: Start line
- **WHEN** the server starts with `--view staff`
- **THEN** stderr has one line naming the folder, `staff` and 4 tools
