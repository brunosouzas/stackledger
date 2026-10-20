# Spec Delta

## Purpose

Defines the catalogue softwaremetro reads: the YAML documents in one folder that describe software items, licences, journeys and the map layout, and the rules that make a catalogue valid.

## ADDED Requirements

### Requirement: Catalogue files
The catalogue SHALL be every file ending in `.yaml` or `.yml` under the given folder, searched recursively, skipping folders named `.git` and `node_modules`. A file MAY hold several YAML documents separated by `---`; each document is read on its own.

#### Scenario: Nested and multi-document files
- **WHEN** the folder holds `a.yaml` with two documents and `team/b.yml` with one document
- **THEN** three documents are read

#### Scenario: Skipped folders and other files
- **WHEN** the folder holds `.git/x.yaml`, `node_modules/y.yaml` and `notes.md`
- **THEN** none of them is read

### Requirement: Catalogue file limits
A file larger than 1 MiB SHALL be reported as an error and not parsed. A symbolic link whose target is outside the folder SHALL NOT be followed and SHALL be reported as a warning.

#### Scenario: Oversized file
- **WHEN** a `.yaml` file is 1 MiB plus one byte
- **THEN** the file gets an error saying it exceeds 1 MiB and its contents are not read

#### Scenario: Link that leaves the folder
- **WHEN** `outside.yaml` is a symbolic link to a file outside the folder
- **THEN** the file is not read and gets a warning

### Requirement: Malformed YAML
A file that is not valid YAML SHALL get an error with the line and column the parser reports. The other files SHALL still be read and checked.

#### Scenario: Broken file among good ones
- **WHEN** `bad.yaml` has an unclosed quote on line 4 and `good.yaml` is valid
- **THEN** `bad.yaml` gets an error at line 4 and the documents of `good.yaml` are checked

### Requirement: Document identity
Every document SHALL have `apiVersion`, `kind` and `metadata.name`. A name SHALL be 1 to 63 characters of letters, digits, `-`, `_` and `.`, starting and ending with a letter or digit. Two documents of the same kind SHALL NOT share a name, compared without regard to case.

#### Scenario: Missing kind
- **WHEN** a document has `apiVersion` and `metadata.name` but no `kind`
- **THEN** it gets an error naming the missing field `kind`

#### Scenario: Duplicate name across files
- **WHEN** `a.yaml` and `b.yaml` both define a `Component` named `slack`, one written `Slack`
- **THEN** the second one in path order gets an error naming the first file

#### Scenario: Name too long
- **WHEN** a name has 64 characters
- **THEN** it gets an error on `metadata.name`

### Requirement: Supported kinds
A document SHALL be one of: `backstage.io/v1alpha1` `Component`; `backstage.io/v1alpha1` `Resource`; `softwaremetro/v1alpha1` `Line`; `softwaremetro/v1alpha1` `MapLayout`. Any other `apiVersion` and `kind` pair SHALL be an error, except the kinds of the next requirement.

#### Scenario: Unsupported pair
- **WHEN** a document has `apiVersion: softwaremetro/v1alpha1` and `kind: Component`
- **THEN** it gets an error naming the supported pairs for `Component`

### Requirement: Ignored Backstage kinds
A document whose kind is `System`, `API`, `Group`, `User`, `Domain`, `Location` or `Template` SHALL be counted as ignored, whatever its `apiVersion`, and SHALL NOT be checked further. A `Resource` whose `spec.type` is not `licence` SHALL also be counted as ignored.

#### Scenario: Backstage catalogue with extra kinds
- **WHEN** the folder holds one `Component`, one `System` and one `Resource` with `spec.type: database`
- **THEN** one component is read, two documents are counted as ignored, and there is no problem

### Requirement: Component fields
A `Component` SHALL have `spec.type`, `spec.lifecycle` and `spec.owner` as non-empty strings. It MAY have `metadata.title`, `metadata.description`, `metadata.labels`, `metadata.annotations`, `metadata.tags` and `spec.dependsOn`. Values of `spec.type` and `spec.lifecycle` are free text, as in Backstage.

#### Scenario: Component without owner
- **WHEN** a `Component` has no `spec.owner`
- **THEN** it gets an error on `spec.owner`

#### Scenario: Minimal valid component
- **WHEN** a `Component` has only `metadata.name`, `spec.type: tool`, `spec.lifecycle: active` and `spec.owner: user:alex`
- **THEN** it has no problem

### Requirement: Entity references
An entity reference SHALL be written `<kind>:<name>`, with the kind in any case. In `spec.dependsOn`, a reference to kind `component` or `resource` SHALL point to an entity in the catalogue, or it is an error. A reference to any other kind SHALL be a warning saying it is not checked.

#### Scenario: Dangling dependency
- **WHEN** a component lists `component:caddy` in `spec.dependsOn` and no component `caddy` exists
- **THEN** it gets an error on `spec.dependsOn[0]`

#### Scenario: Reference to an unchecked kind
- **WHEN** a component lists `system:payments` in `spec.dependsOn`
- **THEN** it gets a warning and no error

#### Scenario: Reference without kind
- **WHEN** a component lists `caddy` in `spec.dependsOn`
- **THEN** it gets an error saying the reference needs a kind

### Requirement: Licence fields
A `Resource` with `spec.type: licence` SHALL have `spec.owner` and a `spec.licence` object with `vendor` (non-empty string), `status`, `cycle`, `cost`, `currency` and `renewsOn`. It MAY have `seats` (positive integer), `vaultItem` and `note` (strings). A component uses a licence by listing `resource:<name>` in `spec.dependsOn`.

#### Scenario: Licence without vendor
- **WHEN** a licence has no `spec.licence.vendor`
- **THEN** it gets an error on `spec.licence.vendor`

#### Scenario: Zero seats
- **WHEN** a licence has `seats: 0`
- **THEN** it gets an error on `spec.licence.seats`

### Requirement: Licence values
`status` SHALL be `active`, `to-confirm`, `to-buy`, `cancelled` or `expired`. `cycle` SHALL be `monthly`, `yearly`, `one-off`, `none` or `unknown`. `cost` SHALL be a number of zero or more, or `unknown`. `currency` SHALL be three capital letters or `unknown`. `renewsOn` SHALL be a real calendar date as `YYYY-MM-DD`, `not-applicable` or `unknown`.

#### Scenario: Impossible date
- **WHEN** `renewsOn` is `2027-02-30`
- **THEN** it gets an error on `spec.licence.renewsOn`

#### Scenario: Negative cost
- **WHEN** `cost` is `-5`
- **THEN** it gets an error on `spec.licence.cost`

#### Scenario: Unknown values are valid
- **WHEN** `cost`, `currency` and `renewsOn` are all `unknown`
- **THEN** the licence has no problem

### Requirement: Line fields
A `Line` SHALL have `spec.color` as `#RRGGBB` and `spec.stops` as a list of at least two component references, each to a component in the catalogue and each at most once. It MAY have `metadata.title` and `spec.code`, one to three letters or digits, unique among lines.

#### Scenario: Line with one stop
- **WHEN** a line has one stop
- **THEN** it gets an error on `spec.stops`

#### Scenario: Stop visited twice
- **WHEN** a line's stops are `component:a`, `component:b`, `component:a`
- **THEN** it gets an error on `spec.stops[2]`

#### Scenario: Stop that is a licence
- **WHEN** a stop is `resource:licence-slack`
- **THEN** it gets an error saying stops must be components

#### Scenario: Shared colour
- **WHEN** two lines have the same `spec.color`
- **THEN** the second one in path order gets a warning

### Requirement: Map layout
A catalogue SHALL have at most one `MapLayout`. Its `spec.stations` maps component references to a position `[column, row]` of two integers of zero or more. A reference SHALL point to a component in the catalogue, and two references SHALL NOT share a position.

#### Scenario: Second layout
- **WHEN** two `MapLayout` documents exist
- **THEN** the second one in path order gets an error

#### Scenario: Two stations in one cell
- **WHEN** `component:a` and `component:b` are both at `[3, 2]`
- **THEN** the second one gets an error naming the first

#### Scenario: Fractional position
- **WHEN** a position is `[2.5, 1]`
- **THEN** it gets an error on that station

### Requirement: Positions and lines agree
A component that is a stop of a line but has no position SHALL get a warning saying the map will place it. A component that has a position but is a stop of no line SHALL get a warning saying the map will not show it.

#### Scenario: Stop without position
- **WHEN** `component:a` is a stop of a line and the layout has no position for it
- **THEN** there is a warning and no error

#### Scenario: No layout at all
- **WHEN** the catalogue has lines and no `MapLayout`
- **THEN** every stop gets the warning, and there is no error

### Requirement: Zones
A `MapLayout` MAY declare `spec.zones`, each with a unique `name`, a `title` and a `color` as `#RRGGBB`. A component joins a zone with the label `softwaremetro/zone: <zone name>`. A zone label SHALL name a declared zone.

#### Scenario: Undeclared zone
- **WHEN** a component has the label `softwaremetro/zone: finance` and no zone `finance` is declared
- **THEN** it gets an error on that label

### Requirement: No secrets in the catalogue
A key at any depth whose name, or the part after its last `/`, is `password`, `secret`, `token`, `apikey` or `privatekey`, ignoring case, `-` and `_`, SHALL be an error. A string value containing a PEM private-key header or a run of 13 to 19 digits that passes the Luhn check SHALL be an error. A value containing an e-mail address SHALL be a warning.

#### Scenario: Token key in an annotation
- **WHEN** a component has the annotation `deploy/Token: abc`
- **THEN** it gets an error on that annotation and the message does not repeat the value

#### Scenario: Card number in a note
- **WHEN** a licence note contains `4111 1111 1111 1111`
- **THEN** it gets an error on `spec.licence.note` and the message does not repeat the value

#### Scenario: Ordinary long number
- **WHEN** a note contains `1234567890123` and that number fails the Luhn check
- **THEN** there is no problem

#### Scenario: E-mail address
- **WHEN** a description contains `alex@example.com`
- **THEN** it gets a warning and no error
