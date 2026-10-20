# mcp-server Specification

## Purpose
TBD - created by archiving change mcp-server. Update Purpose after archive.

## Requirements

### Requirement: Command
`stackledger mcp <folder> [--view full|staff]` SHALL serve the catalogue in `folder` as a Model Context Protocol server over stdio, in the view given by `--view` (default `full`). The folder is required and is resolved to an absolute path at start. The server SHALL stop with exit 0 when its input closes.

#### Scenario: Default view
- **WHEN** the command runs as `stackledger mcp ./catalogue`
- **THEN** it serves that folder in the `full` view

#### Scenario: Input closes
- **WHEN** the client closes the server's input
- **THEN** the server exits with code 0

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder argument, an unknown option, a `--view` other than `full` or `staff`, more than one folder, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2 without serving.

#### Scenario: No folder
- **WHEN** the command runs as `stackledger mcp`
- **THEN** the exit code is 2, stdout is empty and stderr says a folder is required

#### Scenario: Unknown view
- **WHEN** the command runs as `stackledger mcp ./catalogue --view finance`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed views

#### Scenario: Missing folder
- **WHEN** the folder does not exist
- **THEN** the exit code is 2, stdout is empty and stderr says the folder was not found

#### Scenario: Help
- **WHEN** the command runs as `stackledger mcp --help --view finance`
- **THEN** stdout shows usage and the exit code is 0

#### Scenario: Global help lists both commands
- **WHEN** the command runs as `stackledger --help`
- **THEN** stdout shows usage for both `validate` and `mcp`

### Requirement: Tools per view
In the `full` view the server SHALL offer the tools `find_items`, `get_item`, `impact`, `gaps`, `renewals` and `validate`. In the `staff` view it SHALL offer only `find_items`, `get_item`, `impact` and `gaps`. Every tool SHALL be marked read-only and SHALL declare an output schema.

#### Scenario: Staff tool list
- **WHEN** a client lists the tools of a server started with `--view staff`
- **THEN** it gets exactly `find_items`, `get_item`, `impact` and `gaps`

#### Scenario: Read-only hint
- **WHEN** a client lists the tools
- **THEN** every tool has the read-only annotation set and an output schema

### Requirement: Served documents
Each tool call SHALL read and check the folder again. It SHALL serve only documents that passed every document check, the secret scan included, and are not later duplicates. A document whose only errors come from cross-document rules other than the duplicate-name rule SHALL still be served. A secret-scan warning does not stop a document from being served.

#### Scenario: Licence with an invalid cost
- **WHEN** a licence has `cost: -5` and a component lists it
- **THEN** `find_items` does not return the licence in either view, and `get_item` for the component has it in `unresolved`

#### Scenario: Edit between calls
- **WHEN** a component is added to the folder between two `find_items` calls
- **THEN** the second call finds it

#### Scenario: Component with a field error
- **WHEN** one of three components has no `spec.owner`
- **THEN** `find_items` returns the other two

#### Scenario: Component holding a private key
- **WHEN** a component's `metadata.description` contains `-----BEGIN OPENSSH PRIVATE KEY-----`
- **THEN** neither `find_items` nor `get_item` returns that component

#### Scenario: Later duplicate
- **WHEN** two components are named `slack`
- **THEN** `find_items` returns one `component:slack`, the earlier one

#### Scenario: Dangling dependency
- **WHEN** a component lists `component:ghost` and no such component exists
- **THEN** the component is still returned, with `component:ghost` in `unresolved`

### Requirement: Items
The items a tool can return SHALL be components, licences, lines and resources that are not licences. A resource that is not a licence is served once it passes the name step, and SHALL be returned only as `ref`, `kind: resource` and `type`, where `type` is given only when it is 1 to 63 ASCII letters, digits, `-`, `_` and `.`. `MapLayout` and `Settings` documents are not items. Only a component's `spec.dependsOn` creates a dependency.

#### Scenario: Database resource
- **WHEN** a `Resource` named `orders-db` has `spec.type: database` and `spec.owner: group:data`
- **THEN** `get_item` for `resource:orders-db` returns its `ref`, `kind: resource`, `type: database` and its dependants, and no `owner`

### Requirement: Results
A successful result SHALL be one JSON object, returned as text content and as structured content matching the tool's output schema. It SHALL include `catalogue`: in the `full` view `view`, `errors` and `warnings` (the counts `stackledger validate` gives for the folder); in the `staff` view only `view`. The same call on unchanged files SHALL return the same result.

#### Scenario: Counts in the full view
- **WHEN** the catalogue has one error and the view is `full`
- **THEN** every result has `catalogue.errors` equal to 1

#### Scenario: No counts in the staff view
- **WHEN** the view is `staff`
- **THEN** `catalogue` has only `view`

#### Scenario: Same call twice
- **WHEN** `impact` is called twice with the same reference and no file changed
- **THEN** both results are byte for byte equal

### Requirement: Tool errors
A tool error SHALL be a result marked as an error, with one text content giving the reason and no structured content. Arguments of the wrong type, out of range or missing SHALL be tool errors, not protocol errors. A tool error SHALL NOT contain a catalogue value other than the arguments of the call, and the server SHALL keep running after it.

#### Scenario: Folder removed while serving
- **WHEN** the folder is deleted after the server started and a tool is called
- **THEN** the call returns a tool error saying the folder was not found, and the next call is answered

#### Scenario: Missing argument
- **WHEN** `get_item` is called without `ref`
- **THEN** the call returns a tool error naming `ref`

### Requirement: References
A tool argument that names an item SHALL accept `component:<name>`, `resource:<name>` or `line:<name>`, kind and name in any case, with an optional `default/` namespace. Another kind or namespace, or a reference to no item, SHALL be a tool error naming the reference given.

#### Scenario: Reference in another case
- **WHEN** `get_item` is called with `Component:default/Editor` and a component `editor` exists
- **THEN** it returns `component:editor`

#### Scenario: Unknown item
- **WHEN** `get_item` is called with `component:ghost` and no such component exists
- **THEN** the call returns a tool error that names `component:ghost`

#### Scenario: Other namespace
- **WHEN** `get_item` is called with `component:payments/editor`
- **THEN** the call returns a tool error

### Requirement: References in results
Results SHALL write references with the kind in lower case and the name as written in the catalogue. Lists of references, and lists of objects with a `ref`, SHALL be sorted by name by Unicode code point, ties by kind in the order component, resource, line, unless a requirement says otherwise. "By reference" in these specs means this order.

#### Scenario: Sorted dependants
- **WHEN** components `Zed`, `alpha` and `beta` list `resource:licence-editor`
- **THEN** `get_item` for it has `dependants` `component:Zed`, `component:alpha`, `component:beta`

### Requirement: find_items
`find_items` SHALL accept optional `query`, `kind` (`component`, `licence`, `resource` or `line`), `zone` and `limit` (1 to 200, default 50) and return the items matching every given filter. `query` matches, ignoring case, part of the name, title, description, a tag, or a visible licence string field; for a resource that is not a licence, only the name. `zone` matches the `stackledger/zone` label, ignoring case. Items are sorted by reference before the limit applies.

#### Scenario: Search by vendor
- **WHEN** a licence has `vendor: Northwind Studio` and `find_items` is called with `query: northwind`
- **THEN** that licence is returned as `resource:<name>` with `kind: licence`

#### Scenario: Search does not match hidden fields
- **WHEN** the view is `staff` with `note` hidden, a licence has `note: renegotiate in March`, and `find_items` is called with `query: renegotiate`
- **THEN** no item is returned

#### Scenario: Limit reached
- **WHEN** 60 components match and `limit` is 50
- **THEN** the first 50 by reference are returned, `total` is 60 and `truncated` is true

#### Scenario: Description of a database is not searched
- **WHEN** resource `orders-db` has `spec.type: database` and `metadata.description: nightly backup`, and `find_items` is called with `query: backup`
- **THEN** no item is returned

#### Scenario: Limit out of range
- **WHEN** `find_items` is called with `limit: 500`
- **THEN** the call returns a tool error naming the allowed range

### Requirement: find_items result
Each item SHALL have `ref`, `kind` and, when present and visible, `title`, `type`, `lifecycle`, `owner` and `zone`. The result SHALL have `items`, `total` (matches before the limit) and `truncated`.

#### Scenario: Item fields
- **WHEN** a component has a title, `spec.type: tool`, `spec.lifecycle: active`, `spec.owner: user:alex` and zone `finance`
- **THEN** its item has those five values

### Requirement: get_item
`get_item` SHALL accept `ref`. For a component or licence it SHALL return the document as it is in the view (`metadata` and `spec`), `dependants` and `lines` (lines that stop at it). For a component it SHALL also return `zone`, `dependsOn` (matching items, in file order) and `unresolved` (the other references in `spec.dependsOn`, as written, in file order). Every list SHALL be present, empty when there is nothing.

#### Scenario: Licence used by two components
- **WHEN** components `editor` and `forge` list `resource:licence-editor`
- **THEN** `get_item` for `resource:licence-editor` has `dependants` `component:editor` and `component:forge`

#### Scenario: Staff view hides the cost
- **WHEN** the view is `staff` and `get_item` is called for a licence
- **THEN** its `spec.licence` has no hidden field

### Requirement: get_item for a line or other resource
For a line, `get_item` SHALL return the document and `stops`, its references in file order. For a resource that is not a licence it SHALL return `ref`, `kind`, `type` when given, and `dependants`.

#### Scenario: Line stops
- **WHEN** line `ship` stops at `forge` and then `editor`
- **THEN** `get_item` for `line:ship` has `stops` `component:forge`, `component:editor` in that order

### Requirement: impact
`impact` SHALL accept the reference of a component or resource; a line is a tool error. It SHALL return `dependants`: every item that depends on it directly or through other items, each once with its smallest `depth` (1 for direct), sorted by depth and then reference, without the item itself; and `lines`: every line that stops at the item or at any dependant.

#### Scenario: Chain of dependants
- **WHEN** `forge` depends on `vault` and `editor` depends on `forge`
- **THEN** `impact` for `component:vault` returns `component:forge` at depth 1 and `component:editor` at depth 2

#### Scenario: Cycle
- **WHEN** `a` depends on `b` and `b` depends on `a`
- **THEN** `impact` for `component:a` returns only `component:b` at depth 1

#### Scenario: Journeys affected
- **WHEN** line `ship` stops at `editor` and `editor` depends on `vault`
- **THEN** `impact` for `component:vault` lists `line:ship`

#### Scenario: Impact of a line
- **WHEN** `impact` is called with `line:ship`
- **THEN** the call returns a tool error

### Requirement: impact limit
`impact` SHALL list at most 500 dependants, the first in result order, and set `truncated` to true when it stops; otherwise `truncated` is false. `lines` SHALL still cover every dependant.

#### Scenario: More than 500 dependants
- **WHEN** 501 components depend on `vault`
- **THEN** `impact` for `component:vault` returns 500 dependants and `truncated` true

### Requirement: gaps
`gaps` SHALL take no argument and return `isolated` (components whose `spec.dependsOn` matches no item and that appear in no `spec.dependsOn`; line stops do not count), `offMap` (components that are a stop of no line) and `unusedLicences` (licences that appear in no `spec.dependsOn`).

#### Scenario: Licence nobody uses
- **WHEN** a licence `licence-old` is listed by no component
- **THEN** `gaps` lists `resource:licence-old` in `unusedLicences`

#### Scenario: Component on no journey
- **WHEN** component `scanner` is a stop of no line
- **THEN** `gaps` lists `component:scanner` in `offMap`

#### Scenario: Isolated despite being on a line
- **WHEN** component `notes` is a stop of a line, lists nothing and nobody lists it
- **THEN** `gaps` lists `component:notes` in `isolated`

### Requirement: renewals
`renewals` SHALL accept optional `days` (0 to 366, default 30) and `from` (a real `YYYY-MM-DD` date, default the machine's local date) and return `from`, `to` (`from` plus `days` calendar days), `licences`, `overdue` and `unknown`. Only licences with `status` `active` or `to-confirm` count. `licences` lists those renewing from `from` to `to`, both included; `overdue` those renewing before `from`; `unknown` the references of those whose `renewsOn` is `unknown`.

#### Scenario: Renewal inside the window
- **WHEN** `from` is `2027-06-01`, `days` is 30 and an active licence renews on `2027-07-01`
- **THEN** it is listed in `licences` and `to` is `2027-07-01`

#### Scenario: Overdue renewal
- **WHEN** `from` is `2027-06-01` and an active licence renews on `2027-05-20`
- **THEN** it is listed in `overdue`

#### Scenario: Cancelled licence
- **WHEN** a cancelled licence renews inside the window
- **THEN** it is not listed

#### Scenario: Renewal date unknown
- **WHEN** an active licence has `renewsOn: unknown`
- **THEN** its reference is in `unknown`

#### Scenario: Days out of range
- **WHEN** `renewals` is called with `days: 400`
- **THEN** the call returns a tool error naming the allowed range

#### Scenario: Impossible start date
- **WHEN** `renewals` is called with `from: 2027-02-30`
- **THEN** the call returns a tool error

### Requirement: renewals result
Each entry of `licences` and `overdue` SHALL have `ref`, `vendor`, `status`, `renewsOn`, `cycle`, `cost` and `currency`, sorted by `renewsOn` and then reference.

#### Scenario: Same date
- **WHEN** licences `b-tool` and `a-tool` both renew on `2027-06-10`
- **THEN** `resource:a-tool` comes first

### Requirement: validate tool
`validate` SHALL take no argument and return the same `problems` and `summary` that `stackledger validate --json` prints for the folder, with `catalogue` added.

#### Scenario: Same result as the command
- **WHEN** `validate` is called on a folder with one error
- **THEN** its `problems` and `summary` equal the output of `stackledger validate --json` on that folder

### Requirement: Read-only and offline
The server SHALL NOT create, change or delete any file and SHALL NOT open network connections. Every line it writes on stdout SHALL be a protocol message.

#### Scenario: Sandboxed session
- **WHEN** the server runs under the Node.js permission model with read access to the folder and the program's own files only, no write permission and, where the Node.js version supports it, no network permission, and a client calls every tool
- **THEN** every call succeeds and no file in the folder changes

#### Scenario: Clean stdout
- **WHEN** a client calls every tool once
- **THEN** every line the server wrote on stdout parses as a JSON-RPC message

### Requirement: Logs
The server SHALL write to stderr one line when it starts, with the absolute folder, the view and the number of tools, and one line for each tool error, with the tool name and the reason. No log line SHALL contain a catalogue value other than the arguments of the call.

#### Scenario: Start line
- **WHEN** the server starts with `--view staff`
- **THEN** stderr has one line naming the folder, `staff` and 4 tools

#### Scenario: Failed call line
- **WHEN** `get_item` is called with `component:ghost`
- **THEN** stderr gets one line naming `get_item` and the reason
