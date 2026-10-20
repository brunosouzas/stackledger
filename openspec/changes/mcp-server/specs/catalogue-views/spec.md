## ADDED Requirements

### Requirement: Two views
stackledger SHALL offer exactly two views of a catalogue: `full`, which contains every field, and `staff`, which contains every field except the hidden licence fields. Only fields of `spec.licence` can be hidden; components, lines, the map layout and every other licence field are the same in both views.

#### Scenario: Full view keeps the cost
- **WHEN** a licence has `cost: 120` and the view is `full`
- **THEN** the licence in the view has `cost: 120`

#### Scenario: Staff view keeps the vendor
- **WHEN** a licence has `vendor: Northwind Studio` and the view is `staff` with the default hidden fields
- **THEN** the licence in the view has `vendor: Northwind Studio`

### Requirement: Default hidden fields
When the catalogue has no `Settings` document, or its `Settings` has no `spec.views.staff.hide`, the `staff` view SHALL hide `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`. When `spec.views.staff.hide` is present, it SHALL replace the default list entirely, and an empty list hides nothing.

#### Scenario: Default list
- **WHEN** the catalogue has no `Settings` document and the view is `staff`
- **THEN** a licence in the view has none of `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`

#### Scenario: Custom list
- **WHEN** `spec.views.staff.hide` is `[cost]` and the view is `staff`
- **THEN** a licence in the view has no `cost` and keeps its `renewsOn`

#### Scenario: Empty list
- **WHEN** `spec.views.staff.hide` is `[]` and the view is `staff`
- **THEN** a licence in the view has the same fields as in `full`

#### Scenario: Invalid settings
- **WHEN** the `Settings` document has an error in `spec.views.staff.hide`
- **THEN** the `staff` view uses the default list

### Requirement: Hidden values do not leak
In the `staff` view a hidden field SHALL be absent, not emptied or masked, and no value of a hidden field SHALL appear anywhere in the output of a consumer of that view, including search matches, counts, sort order and error messages.

#### Scenario: No trace of the cost
- **WHEN** a licence has `cost: 98765` and the view is `staff` with `cost` hidden
- **THEN** the text `98765` appears nowhere in any output produced from that view

#### Scenario: Order does not reveal the hidden field
- **WHEN** the view is `staff` with `renewsOn` hidden and a consumer lists licences
- **THEN** they are ordered by reference, not by renewal date
