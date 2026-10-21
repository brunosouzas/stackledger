## ADDED Requirements

### Requirement: Site modes
A `Settings` document MAY have `spec.sites`, the list of sites `stackledger build` writes: `[full]` is the personal mode and `[full, staff]`, in any order, the corporate mode. Without `spec.sites` the corporate mode applies. A value other than `full` or `staff`, a repeated value, a list without `full` (`[staff]` alone or an empty list) or a value that is not a list SHALL be an error with the file, line and field. While the Settings in use has an error, the corporate mode applies.

#### Scenario: Personal mode
- **WHEN** a `Settings` document has `spec.sites: [full]`
- **THEN** it has no problem and the sites to build are `full` only

#### Scenario: Corporate mode in any order
- **WHEN** a `Settings` document has `spec.sites: [full, staff]` or `[staff, full]`
- **THEN** it has no problem and the sites to build are `full` and `staff`

#### Scenario: Corporate mode by default
- **WHEN** the catalogue has no `Settings` document, or one without `spec.sites`
- **THEN** the sites to build are `full` and `staff`

#### Scenario: Staff site alone
- **WHEN** `stackledger.yaml` has `spec.sites: [staff]` on line 6
- **THEN** it gets an error at `stackledger.yaml` line 6 on `spec.sites` saying `full` is required, and an empty list gets the same error

#### Scenario: Unknown site
- **WHEN** `spec.sites` lists `full` and, on line 8, `finance`
- **THEN** it gets an error at line 8 on `spec.sites[1]` listing `full` and `staff`

#### Scenario: Repeated site
- **WHEN** `spec.sites` is `[full, full]`
- **THEN** the second `full` gets exactly one error

#### Scenario: Broken settings build both sites
- **WHEN** the Settings document has `spec.sites: [full]` and an error elsewhere, or `spec.sites: [staff]`
- **THEN** the sites to build are `full` and `staff`
