# catalogue-views Specification

## Purpose
Defines the two views of a catalogue, `full` and `staff`: which fields each contains, how the hidden licence fields are configured, and the guarantee that a hidden value never reaches a `staff` consumer.

## Requirements

### Requirement: Two views
stackledger SHALL offer exactly two views of a catalogue: `full`, which contains every field, and `staff`. Lines and the map layout are the same in both views; in `staff`, components and licences are rebuilt from allow-lists.

#### Scenario: Full view keeps the cost
- **WHEN** a licence has `cost: 120` and the view is `full`
- **THEN** the licence in the view has `cost: 120`

#### Scenario: Staff view keeps the vendor
- **WHEN** a licence has `vendor: Northwind Studio` and the view is `staff` with the default hidden fields
- **THEN** the licence in the view has `vendor: Northwind Studio`

### Requirement: Staff licence fields
In the `staff` view a licence SHALL contain only `apiVersion`, `kind`, the `metadata` fields the catalogue spec lists, `spec.type`, `spec.owner`, and the `spec.licence` fields that are not hidden. Every other field SHALL be removed, so a field written in the wrong place cannot reach staff.

#### Scenario: Cost in the wrong place
- **WHEN** a licence has `spec.cost: 98765` next to `spec.licence` and the view is `staff`
- **THEN** the licence in the view has no `spec.cost`

#### Scenario: Dependencies on a licence
- **WHEN** a licence has `spec.dependsOn: ["98765 GBP"]` and the view is `staff`
- **THEN** the licence in the view has no `spec.dependsOn`

### Requirement: Staff component fields
In the `staff` view a component SHALL contain only `apiVersion`, `kind`, the `metadata` fields the catalogue spec lists, `spec.type`, `spec.lifecycle`, `spec.owner` and `spec.dependsOn`.

#### Scenario: Licence block on a component
- **WHEN** a component has `spec.licence.cost: 98765` and the view is `staff`
- **THEN** the component in the view has no `spec.licence`

### Requirement: Default hidden fields
When the catalogue has no `Settings` document, or the one in use has no error and no `spec.views.staff.hide`, the `staff` view SHALL hide `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`. When the `Settings` in use has no error, its `spec.views.staff.hide` SHALL replace the default list entirely, and an empty list hides nothing.

#### Scenario: Default list
- **WHEN** the catalogue has no `Settings` document and the view is `staff`
- **THEN** a licence in the view has none of `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`

#### Scenario: Custom list
- **WHEN** `spec.views.staff.hide` is `[cost]` and the view is `staff`
- **THEN** a licence in the view has no `cost` and keeps its `renewsOn`

#### Scenario: Empty list
- **WHEN** `spec.views.staff.hide` is `[]` and the view is `staff`
- **THEN** a licence in the view has the same `spec.licence` fields as in `full`

### Requirement: Broken settings hide everything
When any document whose `kind` is `Settings`, compared ignoring case, has an error, or a file named `stackledger.yaml` or `stackledger.yml` has an error, the `staff` view SHALL hide every licence field name the Settings requirement allows.

#### Scenario: Typo next to valid names
- **WHEN** `spec.views.staff.hide` is `[vendor, cosst]` and the view is `staff`
- **THEN** a licence in the view has no `spec.licence` field

#### Scenario: Typo in the path
- **WHEN** a `Settings` document has `spec.view.staff.hide: [vendor]` and the view is `staff`
- **THEN** a licence in the view has no `vendor`

#### Scenario: Real list in a second settings document
- **WHEN** `a.yaml` holds a `Settings` with `spec: {}` and `b.yaml` a `Settings` named `company` hiding `[vendor]`, and the view is `staff`
- **THEN** a licence in the view has no `vendor`

#### Scenario: Syntax error in stackledger.yaml
- **WHEN** `stackledger.yaml` cannot be parsed and the view is `staff`
- **THEN** a licence in the view has no `spec.licence` field

### Requirement: Hidden values do not leak
In the `staff` view a hidden field SHALL be absent, not emptied or masked, and no value of a hidden field SHALL appear in, or change, any output of a consumer of that view: results, search matches, counts, sort order and error messages included. A licence with an error in any field, hidden fields included, is not served in either view; that a licence is absent is the only effect a hidden field may have on `staff` output.

#### Scenario: No trace of the cost
- **WHEN** a licence has `cost: 98765` and the view is `staff` with `cost` hidden
- **THEN** the text `98765` appears nowhere in any output produced from that view

#### Scenario: Order does not reveal the hidden field
- **WHEN** the view is `staff` with `renewsOn` hidden and a consumer lists licences
- **THEN** they are ordered by reference, not by renewal date
