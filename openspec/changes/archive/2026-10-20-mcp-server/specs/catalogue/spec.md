## MODIFIED Requirements

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

## ADDED Requirements

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
