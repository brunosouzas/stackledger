## ADDED Requirements

### Requirement: Skills map file
A given folder that is not itself a skill folder MAY hold, at its top, an entry named exactly `stackledger-skills.yaml`: the skills map file, YAML documents that place the set's items on a metro map. It SHALL be read as in "Files and links", is never tested by an ignore file, and does not count as a skill folder or agent file found. A file of that name anywhere else, or in a given folder that is a skill folder, SHALL have no effect.

#### Scenario: Map file at the top
- **WHEN** `repo/stackledger-skills.yaml` holds a `Line` named `publish` with the stops `skill:writer` and `skill:editor`, both in the set
- **THEN** the set has the line `publish` and there is no problem

#### Scenario: Map file below the top
- **WHEN** the given folder is `repo` and `repo/skills/stackledger-skills.yaml` holds invalid YAML
- **THEN** there is no problem and the set has no line

#### Scenario: Map file in a single skill
- **WHEN** the given folder is the skill folder `writer` and holds `stackledger-skills.yaml`
- **THEN** the file has no effect

#### Scenario: Ignore file cannot hide it
- **WHEN** `.stackledgerignore` holds `stackledger-skills.yaml` and the file holds a valid line
- **THEN** the line is read and the ignored count is 0

#### Scenario: Map file alone
- **WHEN** a given folder holds only `stackledger-skills.yaml`
- **THEN** there is the error saying no skill folder or agent file is found in it

### Requirement: Skills map file problems
A skills map file over 1 MiB, one that cannot be read, one that is neither a regular file nor a link to one, one whose YAML is malformed, and one that breaks the catalogue's secret rules (keys and values) SHALL be an error on it as `stackledger validate` reports such a catalogue file, with a message that never repeats a secret; the file then gives no line and no layout. Map problems SHALL never remove an item from the set.

#### Scenario: Malformed map file
- **WHEN** `stackledger-skills.yaml` has a YAML syntax error
- **THEN** there is one error on it, every skill is still in the set, and the set has no line

#### Scenario: Map file that is a folder
- **WHEN** `stackledger-skills.yaml` is a folder
- **THEN** there is one error on it and the command finishes

#### Scenario: Secret in the map file
- **WHEN** a line's `metadata.title` is `4111111111111111`
- **THEN** there is a secret error on the map file and no output line holds the number

### Requirement: Skills map documents
Each document of a skills map file SHALL be a `Line` or a `MapLayout` with `apiVersion: stackledger/v1alpha1`, checked with the catalogue spec's rules for those kinds ("Line fields", the repeat and colour rules of "Line stops", "Map layout", "Positions and lines agree", "Duplicate names"), except that references follow "Skill references" and a `MapLayout` with `spec.zones` SHALL be an error on it. Any other kind SHALL be an error on `kind`.

#### Scenario: Component in the map file
- **WHEN** a document of the map file has `kind: Component`
- **THEN** there is an error on its `kind`

#### Scenario: Zones in a skills layout
- **WHEN** the `MapLayout` of the map file has `spec.zones`
- **THEN** there is an error on `spec.zones` and its station positions are still used

#### Scenario: Line with one stop
- **WHEN** a line of the map file has one stop
- **THEN** there is an error on `spec.stops`

#### Scenario: Stop without a position
- **WHEN** `skill:writer` is a stop of two lines and the layout has no position for it
- **THEN** there is one warning, on its first stop, and no error

### Requirement: Skill references
In a skills map file, each stop and each `MapLayout` station key SHALL be `skill:<name>`, `playbook:<name>` or `agent:<name>`, the name being everything after the first `:`, compared by code point, and SHALL name an item of that kind in the set; otherwise it SHALL be an error at it, naming it and, when an item of another kind has that name, its kind.

#### Scenario: Missing stop
- **WHEN** a line's second stop is `skill:editr` and the set has no `editr`
- **THEN** there is one error with field `spec.stops[1]` naming `editr`

#### Scenario: Wrong kind
- **WHEN** a stop is `skill:release` and `release` is a playbook
- **THEN** there is an error on that stop saying `release` is a playbook

#### Scenario: Software reference
- **WHEN** a stop is `component:editor`
- **THEN** there is an error on that stop

#### Scenario: Agent station
- **WHEN** a line stops at `agent:reviewer` and the layout places `agent:reviewer` at `[2, 0]`, and the set has the agent `reviewer`
- **THEN** there is no problem

#### Scenario: Stop excluded by an error
- **WHEN** a line stops at `skill:editor` and `editor`'s `SKILL.md` has no frontmatter
- **THEN** there is an error on that stop, besides the error on `editor`'s file

### Requirement: Several skills map files
The skills map files of several given folders SHALL be read, in folder order, as the documents of one catalogue: a line name or code already used by an earlier line is an error on the later one, and only the earliest `MapLayout` is used, a later one being an error naming the earlier file.

#### Scenario: Second layout
- **WHEN** folders `repo` and `tool` are given and both map files hold a `MapLayout`
- **THEN** there is an error on `tool`'s naming `repo`'s file, and only `repo`'s positions are used

#### Scenario: One line name in two files
- **WHEN** both map files hold a line named `publish`
- **THEN** there is an error on the line in `tool`'s file
