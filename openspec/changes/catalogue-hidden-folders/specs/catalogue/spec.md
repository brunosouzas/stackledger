## MODIFIED Requirements

### Requirement: Catalogue files
The catalogue SHALL be every regular file ending in `.yaml` or `.yml` under the given folder, searched recursively, skipping folders below it whose name starts with `.` or is `node_modules`, and files named exactly `stackledger-skills.yaml` (skills map files, read by `skill-source`). The given folder is read even when its name starts with `.`. A file MAY hold several YAML documents separated by `---`; each is read on its own. An empty or comment-only document SHALL be skipped without a problem.

#### Scenario: Nested and multi-document files
- **WHEN** the folder holds `a.yaml` with two documents and a trailing `---`, and `team/b.yml` with one document
- **THEN** three documents are read and there is no problem about the trailing `---`

#### Scenario: Skipped folders and other files
- **WHEN** the folder holds `.git/x.yaml`, `node_modules/y.yaml` and `notes.md`
- **THEN** none of them is read

#### Scenario: Pipeline folder in a catalogue repository
- **WHEN** the folder holds `.github/workflows/stackledger.yml` (a workflow, with no `kind`), `team/.config/z.yaml` and a valid `a.yaml`
- **THEN** only `a.yaml` is read, the file count is 1 and there is no problem

#### Scenario: Hidden file and hidden given folder
- **WHEN** the given folder is named `.catalogue` and holds `.extra.yaml` with a valid `Component`
- **THEN** that component is read

#### Scenario: Unreadable hidden folder
- **WHEN** the folder holds `.private/` that cannot be read
- **THEN** there is no "Folder cannot be read" problem for it

#### Scenario: Skills map file in the catalogue folder
- **WHEN** the catalogue folder holds `skills/stackledger-skills.yaml` with a `MapLayout` and a `Line` whose stops are `skill:writer` and `skill:editor`, and `map-layout.yaml` with the software `MapLayout`
- **THEN** the catalogue has no problem about those documents and the software map uses the positions of `map-layout.yaml`
