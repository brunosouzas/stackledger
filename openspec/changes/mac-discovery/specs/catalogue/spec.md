## ADDED Requirements

### Requirement: Discovery annotations
A component annotation whose key starts with `stackledger/` SHALL be one of `stackledger/brew`, `stackledger/cask`, `stackledger/mas`, `stackledger/app`, `stackledger/launchd`, `stackledger/mise`, `stackledger/npm` and `stackledger/pipx`; any other such key gets a warning on the key. Its value is a list of identifiers separated by commas, with spaces around each identifier ignored. An empty identifier gets a warning on the annotation.

#### Scenario: Valid discovery annotations
- **WHEN** a component has `stackledger/brew: git, gh` and `stackledger/app: com.northwind.editor`
- **THEN** it has no problem

#### Scenario: Unknown discovery source
- **WHEN** a component has the annotation `stackledger/brews: git`
- **THEN** it gets a warning on `metadata.annotations["stackledger/brews"]` naming the allowed keys

#### Scenario: Empty identifier
- **WHEN** a component has `stackledger/brew: git,,gh`
- **THEN** it gets a warning on `metadata.annotations["stackledger/brew"]` and both `git` and `gh` are still read

#### Scenario: Other annotations untouched
- **WHEN** a component has the annotation `backstage.io/source-location: url:https://example.com/editor`
- **THEN** it has no problem

### Requirement: One component per identifier
An identifier that an earlier component (in document order) already lists for the same source SHALL get a warning on the later component's annotation naming the earlier component. Identifiers are compared as `stackledger drift` compares them. Annotations on documents other than components are not read for discovery.

#### Scenario: Identifier claimed twice
- **WHEN** components `editor` and `editor-beta` both have `stackledger/cask: northwind-editor`
- **THEN** `editor-beta` gets a warning naming `component:editor`

#### Scenario: Same identifier for two sources
- **WHEN** one component has `stackledger/brew: forge` and another has `stackledger/npm: forge`
- **THEN** neither gets a warning
