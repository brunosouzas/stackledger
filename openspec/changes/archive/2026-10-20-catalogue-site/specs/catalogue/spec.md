## MODIFIED Requirements

### Requirement: Settings
A `Settings` document SHALL have `metadata.name` and MAY have `metadata.namespace` and `metadata.title`. It SHALL have `spec`, a mapping that MAY be empty. `spec.views.staff.hide`, when present, SHALL be a list of licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note`. It MAY have `spec.site`, described in "Site settings". It is kept by convention in `stackledger.yaml`; any file name works.

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

### Requirement: Site settings
`spec.site` MAY have `title`, a non-empty string of at most 60 characters, and `colors`, a mapping whose keys are among `primary`, `accent`, `body` and `text`, each `#` followed by six hexadecimal digits in either case. Any other field under `spec.site` SHALL be an error.

#### Scenario: Title and accent
- **WHEN** a `Settings` document has `spec.site.title: Northwind software` and `spec.site.colors.accent: "#e4002b"`
- **THEN** it has no problem

#### Scenario: Title too long
- **WHEN** `spec.site.title` has 61 characters
- **THEN** it gets an error on `spec.site.title`

#### Scenario: Colour name
- **WHEN** `spec.site.colors.primary` is `red`
- **THEN** it gets an error on `spec.site.colors.primary`

#### Scenario: Logo not supported
- **WHEN** `spec.site` has `logo`
- **THEN** it gets an error on `spec.site.logo`
