## MODIFIED Requirements

### Requirement: Inputs the map folder must not touch
After resolving links, the output folder SHALL be refused, with exit 2 and nothing written, when it is or contains a given folder, or the real path of any skill folder, agent file or file read (rejected ones included, the skills map file too); is inside such a skill folder; is or is inside a given folder's top-level `agents/`; or has a segment below the current folder or a given folder that starts with `.` or is `openspec`. Names SHALL be compared ignoring case.

#### Scenario: Output is the given folder
- **WHEN** the command runs as `stackledger skills map repo --out repo`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Output holds a linked source
- **WHEN** a given folder `tool` holds `skills/writer`, a link to `repo/map/skills/writer`, and `--out` is `repo/map`
- **THEN** the exit code is 2 and nothing is removed

#### Scenario: Output inside a skill folder
- **WHEN** `--out` is `repo/skills/writer/map` and `repo/skills/writer/SKILL.md` exists
- **THEN** the exit code is 2

#### Scenario: Output in the agents folder
- **WHEN** `--out` is `repo/agents` for the given folder `repo`
- **THEN** the exit code is 2

#### Scenario: Output in a tool folder
- **WHEN** `--out` is `.claude/commands/map`, `OpenSpec/specs/map`, or `../home/.claude/commands/map` with `../home/.claude` given
- **THEN** the exit code is 2

#### Scenario: Output holds a linked source file
- **WHEN** `repo/skills/writer/SKILL.md` is a link to `map/skills/input.md` and `--out` is `map`
- **THEN** the exit code is 2 and `map/skills/input.md` is untouched

#### Scenario: Output holds the linked skills map file
- **WHEN** `repo/stackledger-skills.yaml` is a link to `map/skills/lines.yaml` and `--out` is `map`
- **THEN** the exit code is 2 and `map/skills/lines.yaml` is untouched

#### Scenario: Output inside the given folder
- **WHEN** the command runs in `repo` as `stackledger skills map . --out docs/skills-map` and that folder does not exist
- **THEN** the folder is created with the marker, `.gitattributes`, the index and the pages, and the exit code is 0
