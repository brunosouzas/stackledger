## MODIFIED Requirements

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
`spec.skills` MAY have `folders`: a list of 1 to 20 paths without repeats, where `stackledger build` reads a skill set, each a non-empty string relative to the catalogue folder, so not starting with `/`, `\` or `~` and not starting with a drive letter and `:` (such as `C:`). Any other field under `spec.skills` SHALL be an error.

#### Scenario: Two skills folders
- **WHEN** a `Settings` document has `spec.skills.folders: [../kit, ../openspec]`
- **THEN** it has no problem

#### Scenario: Absolute path
- **WHEN** `spec.skills.folders` is `[/home/northwind/kit]`
- **THEN** it gets an error on `spec.skills.folders[0]` saying the path must be relative to the catalogue folder

#### Scenario: Home folder shortcut
- **WHEN** `spec.skills.folders` is `[~/kit]`
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
