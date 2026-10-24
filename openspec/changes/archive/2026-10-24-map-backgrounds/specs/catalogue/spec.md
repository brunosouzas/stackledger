## ADDED Requirements

### Requirement: Map settings
`spec.map` MAY have `backdrop`, one of `neutral` and `london`; without it the backdrop is `neutral`. Any other value, and any other field under `spec.map`, SHALL be an error. When the `Settings` in use has an error, `stackledger map` without `--backdrop` draws with `neutral`, and so does `stackledger build` whenever it goes on building (build-command "Skills settings with problems" still stops it first); a `--backdrop` option still wins ("Command" of map-command).

#### Scenario: Invalid backdrop falls back to neutral
- **WHEN** the catalogue's `Settings` has `spec.map.backdrop: paris` and no `spec.skills`, and `stackledger map` runs without `--backdrop`, and `stackledger build` runs on the same catalogue
- **THEN** the map SVG and the site's map SVGs have no backdrop group

#### Scenario: Option wins over invalid settings
- **WHEN** the catalogue's `Settings` has `spec.map.backdrop: paris` and `stackledger map` runs with `--backdrop london`
- **THEN** the SVG has the `london` backdrop layer

#### Scenario: London backdrop
- **WHEN** a `Settings` document has `spec.map.backdrop: london`
- **THEN** it has no problem

#### Scenario: Unknown backdrop
- **WHEN** a `Settings` document has `spec.map.backdrop: paris`
- **THEN** it gets an error on `spec.map.backdrop` listing `neutral` and `london`

#### Scenario: Typo under map
- **WHEN** a `Settings` document has `spec.map.background: london`
- **THEN** it gets an error on `spec.map.background`

## MODIFIED Requirements

### Requirement: Settings
A `Settings` document SHALL have `metadata.name` and MAY have `metadata.namespace` and `metadata.title`. It SHALL have `spec`, a mapping, possibly empty. `spec.views.staff.hide` MAY be a list of licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note`. It MAY have `spec.site`, `spec.skills` and `spec.map`, each with its own requirement. By convention it is in `stackledger.yaml`; any file name works.

#### Scenario: Staff hide list
- **WHEN** a `Settings` document has `spec.views.staff.hide: [cost, renewsOn]`
- **THEN** it has no problem

#### Scenario: Unknown field name in the hide list
- **WHEN** `spec.views.staff.hide` lists `price`
- **THEN** it gets an error on `spec.views.staff.hide[0]` listing the allowed names

#### Scenario: Repeated field name
- **WHEN** `spec.views.staff.hide` is `[cost, cost]`
- **THEN** the second `cost` gets an error
