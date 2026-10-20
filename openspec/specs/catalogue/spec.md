# catalogue Specification

## Purpose
Defines the catalogue stackledger reads: the YAML documents in one folder that describe software items, licences, journeys and the map layout, and the rules that make a catalogue valid.

## Requirements

### Requirement: Problem severity
Every rule in this spec that a catalogue breaks SHALL produce one problem with severity `error`, unless the rule says `warning`. A problem SHALL name the file, the position and the field it is about, as the `validate-command` spec defines.

#### Scenario: Unmarked rule is an error
- **WHEN** a line's `spec.code` is `ABCD`, four characters, and no rule calls that a warning
- **THEN** the problem has severity `error`

### Requirement: Document order
Documents SHALL be ordered by file path, relative to the folder and compared by Unicode code point, then by their place in the file. "Earlier", "later" and "first" in this spec refer to this order; entries of one mapping or list keep their order in the file.

#### Scenario: Case in paths
- **WHEN** `B.yaml` and `a.yaml` both define a `Component` named `x`
- **THEN** the one in `a.yaml` is the later one and gets the duplicate error, because `B` sorts before `a`

#### Scenario: Two documents in one file
- **WHEN** `a.yaml` holds two `MapLayout` documents
- **THEN** the second document in the file is the later one

### Requirement: Catalogue files
The catalogue SHALL be every regular file ending in `.yaml` or `.yml` under the given folder, searched recursively, skipping folders named `.git` and `node_modules`. A file MAY hold several YAML documents separated by `---`; each document is read on its own. A document that is empty or holds only comments SHALL be skipped without a problem.

#### Scenario: Nested and multi-document files
- **WHEN** the folder holds `a.yaml` with two documents and a trailing `---`, and `team/b.yml` with one document
- **THEN** three documents are read and there is no problem about the trailing `---`

#### Scenario: Skipped folders and other files
- **WHEN** the folder holds `.git/x.yaml`, `node_modules/y.yaml` and `notes.md`
- **THEN** none of them is read

### Requirement: Links are not followed
A symbolic link, to a file or a folder, inside or outside the catalogue folder, broken or not, SHALL NOT be followed and SHALL get a warning.

#### Scenario: Link that leaves the folder
- **WHEN** `outside.yaml` is a symbolic link to a file outside the folder
- **THEN** the file is not read and gets a warning

#### Scenario: Link to a folder inside
- **WHEN** `again` is a symbolic link to the catalogue folder itself
- **THEN** it gets one warning, nothing is read twice and the command finishes

### Requirement: Unreadable and oversized files
A file larger than 1 MiB SHALL get an error and not be read. A file or subfolder that cannot be read SHALL get an error. In both cases the other files SHALL still be read and checked.

#### Scenario: Oversized file
- **WHEN** a `.yaml` file is 1 MiB plus one byte
- **THEN** the file gets an error saying it exceeds 1 MiB and its contents are not read

#### Scenario: Unreadable file
- **WHEN** `locked.yaml` has no read permission and `ok.yaml` is valid
- **THEN** `locked.yaml` gets an error and `ok.yaml` is checked

### Requirement: Malformed YAML
A file with a YAML syntax error or a duplicate key SHALL get an error at the position the parser reports, and none of its documents SHALL be checked. A document that is not a mapping SHALL get an error. Other files SHALL still be checked.

#### Scenario: Broken file among good ones
- **WHEN** `bad.yaml` has an unclosed quote on line 4 and `good.yaml` is valid
- **THEN** `bad.yaml` gets an error at line 4 and the documents of `good.yaml` are checked

#### Scenario: Duplicate key
- **WHEN** a document has the key `metadata` twice
- **THEN** the file gets an error and none of its documents is checked

#### Scenario: Document that is a list
- **WHEN** a document is a YAML list
- **THEN** that document gets an error

### Requirement: Order of document checks
Each document SHALL be checked in this order, and SHALL stop at the first step that reports an error or says stop: `kind` present; ignored kind (stop); `apiVersion` and `kind` pair; name; non-licence `Resource` (stop); fields of its kind; secret scan. Cross-document rules run last and use only documents that passed the name step and are not later duplicates.

#### Scenario: Ignored kind without a name
- **WHEN** a `System` document has no `metadata.name`
- **THEN** it is counted as ignored and there is no problem

#### Scenario: Unsupported pair without a name
- **WHEN** a document has `apiVersion: example.com/v1`, `kind: Component` and no `metadata.name`
- **THEN** it gets one error, about the pair, and none about the name

#### Scenario: Nothing but a name
- **WHEN** a document has `metadata.name` and neither `apiVersion` nor `kind`
- **THEN** it gets exactly one error, on `kind`

#### Scenario: Invalid name stops the checks
- **WHEN** a component has the name `café` and no `spec.owner`
- **THEN** it gets one error, on `metadata.name`, and none on `spec.owner`

### Requirement: Document identity
Every checked document SHALL have `apiVersion`, `kind` and `metadata.name`. A name SHALL be 1 to 63 ASCII letters, digits, `-`, `_` and `.`, starting and ending with a letter or digit. `kind` is matched exactly, with its case.

#### Scenario: Missing kind
- **WHEN** a document has `apiVersion` and `metadata.name` but no `kind`
- **THEN** it gets an error naming the missing field `kind`

### Requirement: Duplicate names
Two documents of the same kind SHALL NOT share a name, ignoring case. The later one SHALL get an error naming the earlier one's file, and SHALL NOT be used by any cross-document rule; the earlier one stays in use.

#### Scenario: Duplicate name across files
- **WHEN** `a.yaml` and `b.yaml` both define a `Component` named `slack`, one written `Slack`
- **THEN** the one in `b.yaml` gets an error naming `a.yaml`

#### Scenario: References use the earlier duplicate
- **WHEN** two components are named `slack` and a line stops at `component:slack`
- **THEN** the stop matches the earlier component and gets no error

#### Scenario: Name too long
- **WHEN** a name has 64 characters
- **THEN** it gets an error on `metadata.name`

#### Scenario: Name with an accent
- **WHEN** a name is `café`
- **THEN** it gets an error on `metadata.name`

### Requirement: Supported kinds
A checked document SHALL be one of: `backstage.io/v1alpha1` `Component`; `backstage.io/v1alpha1` `Resource`; `stackledger/v1alpha1` `Line`; `stackledger/v1alpha1` `MapLayout`; `stackledger/v1alpha1` `Settings`. Any other `apiVersion` and `kind` pair SHALL be an error.

#### Scenario: Unsupported pair
- **WHEN** a document has `apiVersion: stackledger/v1alpha1` and `kind: Component`
- **THEN** it gets an error naming the supported pair for `Component`

#### Scenario: Kind in the wrong case
- **WHEN** a document has `kind: component`
- **THEN** it gets an error naming the supported kinds, `Settings` included

#### Scenario: Settings is a supported kind
- **WHEN** a document has `apiVersion: stackledger/v1alpha1`, `kind: Settings`, `metadata.name: settings` and `spec: {}`
- **THEN** it has no problem

### Requirement: Ignored Backstage kinds
A document whose `kind` is `System`, `API`, `Group`, `User`, `Domain`, `Location` or `Template` SHALL be counted as ignored, whatever its `apiVersion`, and SHALL NOT be checked further, secret scan included.

#### Scenario: Backstage catalogue with extra kinds
- **WHEN** the folder holds one `Component`, one `System`, and one `User` whose `spec.profile.email` is an e-mail address
- **THEN** one component is checked, two documents are counted as ignored, and there is no problem

### Requirement: Resources that are not licences
A `Resource` SHALL have `spec.type`. A `Resource` whose `spec.type` is not exactly `licence` SHALL be counted as ignored after the identity check, and it can still be the target of a reference. When `spec.type` is `license` or `Licence` in any case, it SHALL also get a warning that it is not read as a licence.

#### Scenario: Database resource
- **WHEN** a `Resource` has `spec.type: database`
- **THEN** it is counted as ignored and there is no problem

#### Scenario: US spelling
- **WHEN** a `Resource` has `spec.type: license`
- **THEN** it is counted as ignored and gets a warning on `spec.type`

#### Scenario: Resource without type
- **WHEN** a `Resource` has no `spec.type`
- **THEN** it gets an error on `spec.type`

### Requirement: Fields outside the format
In a `Component` and in a `Resource` outside `spec.licence`, fields this spec does not list SHALL be accepted and ignored, so Backstage files read as they are. In `spec.licence`, a `Line`, a `MapLayout` and a `Settings` document, an unlisted field SHALL be an error.

#### Scenario: Backstage fields on a component
- **WHEN** a component has `metadata.links`, `metadata.namespace: default`, `spec.system` and `spec.providesApis`
- **THEN** there is no problem

#### Scenario: Typo in a licence
- **WHEN** a licence has `spec.licence.renews_on`
- **THEN** it gets an error on `spec.licence.renews_on`

#### Scenario: Typo in a line
- **WHEN** a line has `spec.stop` instead of `spec.stops`
- **THEN** it gets an error on `spec.stop` and one saying `spec.stops` is missing

#### Scenario: Typo in settings
- **WHEN** a `Settings` document has `spec.view.staff.hide`
- **THEN** it gets an error on `spec.view`

### Requirement: Namespaces
A document whose `metadata.namespace` is set and is not `default` SHALL get a warning that namespaces are not supported, and SHALL be treated as if it were in `default`.

#### Scenario: Team namespace
- **WHEN** a component has `metadata.namespace: payments`
- **THEN** it gets a warning and is checked as any other component

### Requirement: Component fields
A `Component` SHALL have `spec.type`, `spec.lifecycle` and `spec.owner` as non-empty strings. It MAY have `metadata.title`, `metadata.description`, `metadata.labels`, `metadata.annotations`, `metadata.tags` and `spec.dependsOn` (a list of references). Values of `spec.type` and `spec.lifecycle` are free text, as in Backstage.

#### Scenario: Component without owner
- **WHEN** a `Component` has no `spec.owner`
- **THEN** it gets an error on `spec.owner`

#### Scenario: Minimal valid component
- **WHEN** a document has only `apiVersion: backstage.io/v1alpha1`, `kind: Component`, `metadata.name`, `spec.type: tool`, `spec.lifecycle: active` and `spec.owner: user:alex`
- **THEN** it has no problem

### Requirement: Metadata types
When present, `metadata.title` and `metadata.description` SHALL be non-empty strings, `metadata.labels` and `metadata.annotations` mappings from string keys to string values, and `metadata.tags` a list of strings. A licence's `spec.owner` SHALL be a non-empty string.

#### Scenario: Labels that are a number
- **WHEN** a component has `metadata.labels: 42`
- **THEN** it gets an error on `metadata.labels`

#### Scenario: Owner that is a list
- **WHEN** a licence has `spec.owner: []`
- **THEN** it gets an error on `spec.owner`

### Requirement: Entity reference syntax
An entity reference SHALL be written `<kind>:<name>` or `<kind>:<namespace>/<name>`, with the kind in any case. It matches a document of that kind whose name is equal, ignoring case. A reference without a kind SHALL be an error in `spec.dependsOn`, `spec.stops` and the keys of `spec.stations`. In stops and station keys, a namespace other than `default` SHALL be an error.

#### Scenario: Reference without kind
- **WHEN** a component lists `caddy` in `spec.dependsOn`
- **THEN** it gets an error saying the reference needs a kind

#### Scenario: Case and default namespace
- **WHEN** a component lists `Component:default/Caddy` and a component named `caddy` exists
- **THEN** there is no problem

#### Scenario: Stop in another namespace
- **WHEN** a line stop is `component:payments/caddy`
- **THEN** it gets an error on that stop

#### Scenario: Dependency in another namespace
- **WHEN** a component lists `component:payments/caddy` in `spec.dependsOn`
- **THEN** it gets a warning that the reference is not checked, and no error

### Requirement: Dependency targets
In `spec.dependsOn`, a reference to kind `component` or `resource` SHALL match a document that passed the name step, ignored non-licence resources included. A reference to any other kind, or to a namespace other than `default`, SHALL get a warning that it is not checked.

#### Scenario: Dangling dependency
- **WHEN** a component lists `component:caddy` in `spec.dependsOn` and no component `caddy` exists
- **THEN** it gets an error on `spec.dependsOn[0]`

#### Scenario: Dependency on a database
- **WHEN** a component lists `resource:orders-db` and `orders-db` is a `Resource` with `spec.type: database`
- **THEN** there is no problem

#### Scenario: Reference to an unchecked kind
- **WHEN** a component lists `system:payments` in `spec.dependsOn`
- **THEN** it gets a warning and no error

### Requirement: Licence fields
A licence SHALL have `spec.owner` and a `spec.licence` object with `vendor` (non-empty string), `status`, `cycle`, `cost`, `currency` and `renewsOn`. It MAY have `seats` (an integer of 1 or more), `paidBy`, `vaultItem` and `note` (non-empty strings). A component uses a licence by listing `resource:<name>` in `spec.dependsOn`.

#### Scenario: Licence without vendor
- **WHEN** a licence has no `spec.licence.vendor`
- **THEN** it gets an error on `spec.licence.vendor`

#### Scenario: Zero seats
- **WHEN** a licence has `seats: 0`
- **THEN** it gets an error on `spec.licence.seats`

#### Scenario: Fractional seats
- **WHEN** a licence has `seats: 2.5`
- **THEN** it gets an error on `spec.licence.seats`

### Requirement: Licence status and cycle
`status` SHALL be `active`, `to-confirm`, `to-buy`, `cancelled` or `expired`. `cycle` SHALL be `monthly`, `yearly`, `one-off`, `none` or `unknown`. Both are matched exactly, with their case.

#### Scenario: Unknown status
- **WHEN** `status` is `retired`
- **THEN** it gets an error on `spec.licence.status` listing the allowed values

### Requirement: Licence cost, currency and date
`cost` SHALL be a number of zero or more, or `unknown`. `currency` SHALL be three capital ASCII letters, or `unknown`. `renewsOn` SHALL be a real calendar date written `YYYY-MM-DD`, or `not-applicable`, or `unknown`.

#### Scenario: Impossible date
- **WHEN** `renewsOn` is `2027-02-30`
- **THEN** it gets an error on `spec.licence.renewsOn`

#### Scenario: Negative cost
- **WHEN** `cost` is `-5`
- **THEN** it gets an error on `spec.licence.cost`

#### Scenario: Lower-case currency
- **WHEN** `currency` is `gbp`
- **THEN** it gets an error on `spec.licence.currency`

#### Scenario: Unknown values are valid
- **WHEN** `cost`, `currency` and `renewsOn` are all `unknown`
- **THEN** the licence has no problem

### Requirement: Line fields
A `Line` SHALL have `spec.color` as `#` and six hexadecimal digits in any case, and `spec.stops`, a list of at least two references. It MAY have `metadata.title` and `spec.code`, one to three ASCII letters or digits, unique among lines ignoring case.

#### Scenario: Line with one stop
- **WHEN** a line has one stop
- **THEN** it gets an error on `spec.stops`

#### Scenario: Short colour
- **WHEN** `spec.color` is `#f00`
- **THEN** it gets an error on `spec.color`

#### Scenario: Shared code
- **WHEN** two lines have `spec.code` `1`
- **THEN** the later one gets an error naming the earlier one

### Requirement: Line stops
Each stop SHALL be a reference of kind `component` that matches a component, and SHALL appear at most once in its line. Two lines with the same colour, ignoring case, SHALL get a warning on the later one.

#### Scenario: Stop visited twice
- **WHEN** a line's stops are `component:a`, `component:b`, `component:a`
- **THEN** it gets an error on `spec.stops[2]`

#### Scenario: Stop that is a licence
- **WHEN** a stop is `resource:licence-slack`
- **THEN** it gets an error saying stops must be components

#### Scenario: Missing stop
- **WHEN** a stop is `component:ghost` and no such component exists
- **THEN** it gets an error on that stop

#### Scenario: Shared colour
- **WHEN** two lines have the colours `#FF0000` and `#ff0000`
- **THEN** the later one gets a warning on `spec.color`

### Requirement: Map layout
A catalogue SHALL have at most one `MapLayout`; only the earliest is used. Its `spec.stations` maps references to a position `[column, row]` of two integers of zero or more. Each reference SHALL match a component, and two references SHALL NOT share a position.

#### Scenario: Second layout
- **WHEN** two `MapLayout` documents exist
- **THEN** the later one gets an error and its stations are not used

#### Scenario: Two stations in one cell
- **WHEN** `component:a` and then `component:b` are both at `[3, 2]`
- **THEN** `component:b` gets an error naming `component:a`

#### Scenario: Fractional position
- **WHEN** a position is `[2.5, 1]`
- **THEN** it gets an error on that station

#### Scenario: Station for a missing component
- **WHEN** `spec.stations` has `component:ghost` and no such component exists
- **THEN** it gets an error on that station

### Requirement: Positions and lines agree
A component that is a stop of a line and has no position SHALL get one warning, at its first stop in document order, saying the map will place it. A component with a position that is a stop of no line SHALL get one warning, at its station entry, saying the map will not show it.

#### Scenario: Stop without position
- **WHEN** `component:a` is a stop of two lines and the layout has no position for it
- **THEN** there is one warning, on the first of those stops, and no error

#### Scenario: No layout at all
- **WHEN** the catalogue has lines and no `MapLayout`
- **THEN** each component that is a stop gets one warning, and there is no error

### Requirement: Zones
A `MapLayout` MAY declare `spec.zones`, a list of zones each with `name` (unique, ignoring case), `title` (non-empty) and `color` (as for lines). A component joins a zone with the label `stackledger/zone: <zone name>`, which SHALL name a declared zone, compared ignoring case.

#### Scenario: Zone name in another case
- **WHEN** a component has the label `stackledger/zone: Finance` and the zone `finance` is declared
- **THEN** there is no problem

#### Scenario: Undeclared zone
- **WHEN** a component has the label `stackledger/zone: finance` and no zone `finance` is declared
- **THEN** it gets an error on that label

#### Scenario: Duplicate zone
- **WHEN** two zones are named `finance` and `Finance`
- **THEN** the later one gets an error

### Requirement: No secret keys
In checked documents, a key at any depth whose name, or the part after its last `/`, is `password`, `secret`, `token`, `apikey` or `privatekey`, ignoring case, `-` and `_`, SHALL be an error. The message SHALL NOT repeat the value.

#### Scenario: Token key in an annotation
- **WHEN** a component has the annotation `deploy/Token: abc`
- **THEN** it gets an error on that annotation and the message does not contain `abc`

### Requirement: No secret values
In checked documents, a value whose text holds `-----BEGIN`, then `PRIVATE KEY-----` on the same line, SHALL be an error. So SHALL 13 to 19 digits, single spaces or hyphens allowed between them and no digit right before or after, that pass the Luhn check, whether quoted or not. The message SHALL NOT repeat the value.

#### Scenario: Card number in a note
- **WHEN** a licence note contains `4111 1111 1111 1111`
- **THEN** it gets an error on `spec.licence.note` and the message does not contain the number

#### Scenario: Unquoted card number
- **WHEN** a licence note is the unquoted number `4111111111111111`
- **THEN** it gets an error on `spec.licence.note`

#### Scenario: Private key
- **WHEN** a description contains `-----BEGIN OPENSSH PRIVATE KEY-----`
- **THEN** it gets an error on `metadata.description`

#### Scenario: Ordinary long number
- **WHEN** a note contains `1234567890123`, which fails the Luhn check
- **THEN** there is no problem

### Requirement: E-mail addresses
In checked documents, a value that contains an e-mail address SHALL get a warning. The message SHALL NOT repeat the address.

#### Scenario: E-mail address
- **WHEN** a description contains `alex@example.com`
- **THEN** it gets a warning and no error

### Requirement: Settings
A `Settings` document SHALL have `metadata.name` and MAY have `metadata.namespace` and `metadata.title`. It SHALL have `spec`, a mapping that MAY be empty. `spec.views.staff.hide`, when present, SHALL be a list of licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note`. It is kept by convention in `stackledger.yaml`; any file name works.

#### Scenario: Staff hide list
- **WHEN** a `Settings` document has `spec.views.staff.hide: [cost, renewsOn]`
- **THEN** it has no problem

#### Scenario: Unknown field name in the hide list
- **WHEN** `spec.views.staff.hide` lists `price`
- **THEN** it gets an error on `spec.views.staff.hide[0]` listing the allowed names

#### Scenario: Repeated field name
- **WHEN** `spec.views.staff.hide` is `[cost, cost]`
- **THEN** the second `cost` gets an error

### Requirement: One settings document
A catalogue SHALL have at most one `Settings` document; only the earliest in document order is used. A later one with a different name SHALL get an error naming the earlier one's file; a later one with the same name gets only the duplicate-name error.

#### Scenario: Second settings document
- **WHEN** `a.yaml` holds a `Settings` named `settings` and `b.yaml` one named `company`
- **THEN** the one in `b.yaml` gets one error naming `a.yaml`, and the one in `a.yaml` is used

#### Scenario: Two settings with the same name
- **WHEN** `a.yaml` and `b.yaml` both hold a `Settings` named `settings`
- **THEN** the one in `b.yaml` gets exactly one error, the duplicate-name error
