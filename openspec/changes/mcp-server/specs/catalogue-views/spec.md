## ADDED Requirements

### Requirement: Two views
stackledger SHALL offer exactly two views of a catalogue: `full`, which contains every field, and `staff`. Components, lines and the map layout are the same in both views. Only licences differ.

#### Scenario: Full view keeps the cost
- **WHEN** a licence has `cost: 120` and the view is `full`
- **THEN** the licence in the view has `cost: 120`

#### Scenario: Staff view keeps the vendor
- **WHEN** a licence has `vendor: Northwind Studio` and the view is `staff` with the default hidden fields
- **THEN** the licence in the view has `vendor: Northwind Studio`

### Requirement: Staff licence fields
In the `staff` view a licence SHALL contain only `apiVersion`, `kind`, the `metadata` fields the catalogue spec lists, `spec.type`, `spec.owner`, `spec.dependsOn`, and the `spec.licence` fields that are not hidden. Every other field SHALL be removed, so a field written in the wrong place cannot reach staff.

#### Scenario: Cost in the wrong place
- **WHEN** a licence has `spec.cost: 98765` next to `spec.licence` and the view is `staff`
- **THEN** the licence in the view has no `spec.cost`

### Requirement: Default hidden fields
When the catalogue has no `Settings` document, or its `Settings` has no `spec.views.staff.hide`, the `staff` view SHALL hide `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`. A valid `spec.views.staff.hide` SHALL replace the default list entirely, and an empty list hides nothing.

#### Scenario: Default list
- **WHEN** the catalogue has no `Settings` document and the view is `staff`
- **THEN** a licence in the view has none of `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`

#### Scenario: Custom list
- **WHEN** `spec.views.staff.hide` is `[cost]` and the view is `staff`
- **THEN** a licence in the view has no `cost` and keeps its `renewsOn`

#### Scenario: Empty list
- **WHEN** `spec.views.staff.hide` is `[]` and the view is `staff`
- **THEN** a licence in the view has the same `spec.licence` fields as in `full`

### Requirement: Invalid settings hide more
When the `Settings` document in use has any error, the `staff` view SHALL hide the default fields plus every allowed field name that appears as a string in its `spec.views.staff.hide`.

#### Scenario: Typo next to valid names
- **WHEN** `spec.views.staff.hide` is `[vendor, cosst]` and the view is `staff`
- **THEN** a licence in the view has neither `vendor` nor any default hidden field

### Requirement: Hidden values do not leak
In the `staff` view a hidden field SHALL be absent, not emptied or masked, and no value of a hidden field SHALL appear in, or change, any output of a consumer of that view: results, search matches, counts, sort order and error messages included.

#### Scenario: No trace of the cost
- **WHEN** a licence has `cost: 98765` and the view is `staff` with `cost` hidden
- **THEN** the text `98765` appears nowhere in any output produced from that view

#### Scenario: Order does not reveal the hidden field
- **WHEN** the view is `staff` with `renewsOn` hidden and a consumer lists licences
- **THEN** they are ordered by reference, not by renewal date
