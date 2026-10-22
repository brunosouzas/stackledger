## MODIFIED Requirements

### Requirement: Skills text output
By default each problem SHALL be one line on stdout, `<path>:<line>:<column> <error|warning> <field> <message>`, with control characters removed as in `stackledger validate`. A last line SHALL give the counts `skills`, `playbooks`, `agents`, `rules`, `ignored`, `errors` and `warnings`, where the first four count what joined the set and `ignored` counts the entries skipped by ignore files.

#### Scenario: Problem line
- **WHEN** `repo/skills/writer/SKILL.md` has a description of 1025 code points at line 3, column 14
- **THEN** stdout starts with the line `repo/skills/writer/SKILL.md:3:14 warning description ` followed by the message

#### Scenario: Control characters in a file name
- **WHEN** a skill folder's name holds ESC and U+009B and its skill has a problem
- **THEN** no text output line holds either character, and the JSON output writes U+009B as `\u009b`

#### Scenario: Clean set
- **WHEN** a set has 3 skills, 1 playbook, 2 agents, 10 rules, nothing ignored and no problem
- **THEN** stdout is exactly `skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 0, warnings: 0` and a newline

### Requirement: Skills JSON output
With `--json`, stdout SHALL be one JSON object and a newline with, in this order: `problems` (objects with `path`, `line`, `column`, `severity`, `field` and `message`), `ignored` (the sorted paths of the entries skipped by ignore files) and `summary` (the counts in the text output's order, `ignored` after `rules`). U+007F to U+009F SHALL be written as `\u` escapes as in `stackledger validate`.

#### Scenario: JSON with one error
- **WHEN** the set has one error and `--json` is given
- **THEN** stdout parses as JSON with one problem, `summary.errors` is 1 and the exit code is 1

#### Scenario: JSON ignored list
- **WHEN** the ignore file of `repo` skips `fixtures/` and `templates/`, and `--json` is given
- **THEN** `ignored` is `["repo/fixtures", "repo/templates"]` and `summary.ignored` is 2
