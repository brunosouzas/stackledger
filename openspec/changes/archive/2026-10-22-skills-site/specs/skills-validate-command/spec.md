## ADDED Requirements

### Requirement: Skills map file problems in the output
Problems of a skills map file SHALL be reported like every other problem of the set: one line each with the map file's path, line, column and field, counted in `errors` and `warnings`, deciding the exit code. No count is added to the counts line or to `summary`.

#### Scenario: Broken map file fails a pipeline
- **WHEN** `repo/stackledger-skills.yaml` has a line whose second stop, at line 9 column 7, is `skill:editr`, and the set has no `editr`
- **THEN** stdout has a line starting `repo/stackledger-skills.yaml:9:7 error spec.stops[1]`, the counts line has `errors: 1`, and the exit code is 1

#### Scenario: Counts line unchanged
- **WHEN** a set with a valid map file of two lines has 3 skills, 1 playbook, 2 agents, 10 rules and no problem
- **THEN** stdout is exactly `skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 0, warnings: 0` and a newline
