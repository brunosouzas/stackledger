## MODIFIED Requirements

### Requirement: Catalogue files
The catalogue SHALL be every regular file ending in `.yaml` or `.yml` under the given folder, searched recursively, skipping folders named `.git` and `node_modules` and files named exactly `stackledger-skills.yaml` (skills map files, read by `skill-source`). A file MAY hold several YAML documents separated by `---`; each document is read on its own. A document that is empty or holds only comments SHALL be skipped without a problem.

#### Scenario: Nested and multi-document files
- **WHEN** the folder holds `a.yaml` with two documents and a trailing `---`, and `team/b.yml` with one document
- **THEN** three documents are read and there is no problem about the trailing `---`

#### Scenario: Skipped folders and other files
- **WHEN** the folder holds `.git/x.yaml`, `node_modules/y.yaml` and `notes.md`
- **THEN** none of them is read

#### Scenario: Skills map file in the catalogue folder
- **WHEN** the catalogue folder holds `skills/stackledger-skills.yaml` with a `MapLayout` and a `Line` whose stops are `skill:writer` and `skill:editor`, and `map-layout.yaml` with the software `MapLayout`
- **THEN** the catalogue has no problem about those documents and the software map uses the positions of `map-layout.yaml`

### Requirement: Settings
A `Settings` document SHALL have `metadata.name` and MAY have `metadata.namespace` and `metadata.title`. It SHALL have `spec`, a mapping that MAY be empty. `spec.views.staff.hide`, when present, SHALL be a list of licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note`. It MAY have `spec.site`, described in "Site settings", and `spec.skills`, described in "Skills settings". It is kept by convention in `stackledger.yaml`; any file name works.

#### Scenario: Staff hide list
- **WHEN** a `Settings` document has `spec.views.staff.hide: [cost, renewsOn]`
- **THEN** it has no problem

#### Scenario: Unknown field name in the hide list
- **WHEN** `spec.views.staff.hide` lists `price`
- **THEN** it gets an error on `spec.views.staff.hide[0]` listing the allowed names

#### Scenario: Repeated field name
- **WHEN** `spec.views.staff.hide` is `[cost, cost]`
- **THEN** the second `cost` gets an error

## ADDED Requirements

### Requirement: Skills settings
`spec.skills` MAY have `folders`: a list of 1 to 20 paths without repeats, where `stackledger build` reads a skill set, each a non-empty string relative to the catalogue folder: not starting with `/`, `\` or `~`, and not starting with a letter and `:` (a drive such as `C:`). `..` is allowed. Any other field under `spec.skills` SHALL be an error.

#### Scenario: Two skills folders
- **WHEN** a `Settings` document has `spec.skills.folders: [../kit, ../openspec]`
- **THEN** it has no problem

#### Scenario: Absolute path
- **WHEN** `spec.skills.folders` is `[/home/northwind/kit]`
- **THEN** it gets an error on `spec.skills.folders[0]` saying the path must be relative to the catalogue folder

#### Scenario: Home folder shortcut
- **WHEN** `spec.skills.folders` is `[~/kit]`
- **THEN** it gets an error on `spec.skills.folders[0]`

#### Scenario: Drive letter
- **WHEN** `spec.skills.folders` is `["C:kit"]`
- **THEN** it gets an error on `spec.skills.folders[0]`

#### Scenario: Empty list
- **WHEN** `spec.skills.folders` is `[]`
- **THEN** it gets an error on `spec.skills.folders`

#### Scenario: Too many folders
- **WHEN** `spec.skills.folders` lists 21 different paths
- **THEN** it gets an error on `spec.skills.folders`

#### Scenario: Repeated folder
- **WHEN** `spec.skills.folders` is `[../kit, ../kit]`
- **THEN** the second entry gets an error

#### Scenario: Unknown skills field
- **WHEN** `spec.skills` has `folder`
- **THEN** it gets an error on `spec.skills.folder`
