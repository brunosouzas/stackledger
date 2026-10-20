## MODIFIED Requirements

### Requirement: Supported kinds
A checked document SHALL be one of: `backstage.io/v1alpha1` `Component`; `backstage.io/v1alpha1` `Resource`; `stackledger/v1alpha1` `Line`; `stackledger/v1alpha1` `MapLayout`; `stackledger/v1alpha1` `Settings`. Any other `apiVersion` and `kind` pair SHALL be an error.

#### Scenario: Unsupported pair
- **WHEN** a document has `apiVersion: stackledger/v1alpha1` and `kind: Component`
- **THEN** it gets an error naming the supported pair for `Component`

#### Scenario: Kind in the wrong case
- **WHEN** a document has `kind: component`
- **THEN** it gets an error naming the supported kinds

#### Scenario: Settings is a supported kind
- **WHEN** a document has `apiVersion: stackledger/v1alpha1`, `kind: Settings`, `metadata.name: settings` and `spec: {}`
- **THEN** it has no problem

## ADDED Requirements

### Requirement: Settings
A catalogue SHALL have at most one `Settings` document; the earliest in document order is used and each later one gets an error. It MAY have `spec.views.staff.hide`: licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note`. Any unlisted field in it SHALL be an error. It is kept by convention in `stackledger.yaml`; any file name works.

#### Scenario: Staff hide list
- **WHEN** a `Settings` document has `spec.views.staff.hide: [cost, renewsOn]`
- **THEN** it has no problem

#### Scenario: Unknown field name in the hide list
- **WHEN** `spec.views.staff.hide` lists `price`
- **THEN** it gets an error on `spec.views.staff.hide[0]` listing the allowed names

#### Scenario: Repeated field name
- **WHEN** `spec.views.staff.hide` is `[cost, cost]`
- **THEN** the second `cost` gets an error

#### Scenario: Second settings document
- **WHEN** two files each hold a `Settings` document
- **THEN** the later one in document order gets an error and the earlier one is used

#### Scenario: Typo in a settings field
- **WHEN** a `Settings` document has `spec.view.staff.hide`
- **THEN** it gets an error on `spec.view`
