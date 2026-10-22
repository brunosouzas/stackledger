# Agent skills

`stackledger skills validate` checks a set of agent skills, playbooks, agents and rules kept in folders: what one agent would see. It reports problems in the same line format as `stackledger validate`, so a person can run it on their own folders and a team can run it in CI on every pull request. It only reads files: it writes nothing, makes no network call and fixes nothing.

```sh
stackledger skills validate [folder...] [--json]
```

With no folder it checks the current folder. Several folders are read as one set, in the order given.

## What it reads

- **Skills.** Any folder holding a file named exactly `SKILL.md`, in the [Agent Skills format](https://agentskills.io/specification): a YAML frontmatter between two `---` lines, with `name` and `description`. Each given folder is walked at most five levels deep, entries in code-point order; the walk does not enter a skill folder (its sub-folders are the skill's resources), and skips folders whose name starts with `.` and `node_modules`. A given folder that is itself a skill folder gives that one skill.
- **Playbooks.** Skills with `stackledger-kind: playbook` in their `metadata`: a skill that orchestrates other skills and agents.
- **Agents.** Each `.md` file directly in an `agents/` folder at the top of a given folder, in the Claude Code subagent format (frontmatter with `name`, `description`, and optionally `skills`, `tools`, `model`…). A file there without frontmatter, such as a `README.md`, gets a warning and is not an agent.
- **Rules.** An optional `rules.md` next to a `SKILL.md`. A rule is a line starting at column 1 with `- **ID** text`, the ID like `DOC-1`; indented `Why:` and `Check:` lines after it are its reason and check, and the nearest earlier `## ` heading is its group. Lines inside fenced code blocks are never rules.

```markdown
## Documentation (DOC)

- **DOC-1** Update the README in the same change.
  Why: documentation updated later is wrong in between.
  Check: the diff touches the docs whenever it changes usage.
```

### Symbolic links

Tool folders are often made of links into a repository (`/Users/username/.claude/skills/writer -> /Users/username/skills/writer`). A link to a folder holding a `SKILL.md` is read as a skill at the link's path, and never walked into; any other folder link, or a broken link, gets one warning and is not followed, so the walk cannot loop. Links to files (`SKILL.md`, `rules.md`, agent files) are read, and a given folder that is a link is followed.

A skill folder or agent file reached twice (through a link and directly, or from two given folders) is read once, at the first path. Copies are different: two separate files with the same `name` are a duplicate.

### One set is what one agent sees

Give the folders one agent loads together, for example a repository and the tool folder that links into it. Check each tool folder on its own: a repository and a tool folder holding copies (not links) of its skills fail with duplicate names, which is right for one agent but not what you want to compare. Comparing tool folders with a repository is a later command (`skills drift`).

Point the command at folders that hold real skills. Templates and deliberately broken test fixtures inside them are read like any skill: rename a template file (for example `SKILL.md.template`).

## Relation keys

Relations are declared in each skill's `metadata`, which the Agent Skills specification allows and which holds only strings, so `SKILL.md` stays valid for every tool that reads it:

```yaml
---
name: release
description: Use when shipping a Northwind release. Runs the writer, editor and reviewer in order.
metadata:
  stackledger-kind: playbook
  stackledger-skills: writer editor
  stackledger-agents: reviewer
---
```

| Key | Value |
|---|---|
| `stackledger-kind` | `skill` (the default when absent) or `playbook` |
| `stackledger-skills` | The skills and playbooks this one uses, names separated by spaces (or line breaks) |
| `stackledger-agents` | The agents this one uses, names separated by spaces (or line breaks) |

Any other `metadata` key starting with `stackledger-` in any letter case is an error, so a typo such as `stackledger-skill` is caught. Agents keep their tool's own format: Claude Code lists the skills an agent preloads under `skills`.

```yaml
---
name: reviewer
description: Reviews Northwind pull requests.
skills:
  - code-review
tools: Read, Grep
---
```

## Checks

Errors are what a pipeline should stop on; warnings are what a person should know but tools tolerate. The Agent Skills specification's own constraints are warnings, so sets you do not own (skills bundled with a tool) can still pass.

| Error | Warning |
|---|---|
| No frontmatter, frontmatter never closed, invalid YAML or duplicate keys, not a mapping | `name` over 64 characters, with an upper-case letter, with anything but letters, digits and hyphens, starting or ending with `-`, or holding `--` (after NFKC normalisation) |
| `name` or `description` missing, empty or not a string | `name` different from the folder or link name where the skill was found |
| A file over 1 MiB or one that cannot be read | `description` over 1024 characters; `compatibility` not a 1–500 character string; `license` or `allowed-tools` not a string |
| A second skill (or agent) with a name already in the set | Top-level fields outside the specification (one warning per skill, naming them) |
| An unknown `stackledger-*` key, a `stackledger-*` value that is not a string, a `stackledger-kind` other than `skill` or `playbook` | A `metadata` that is not a mapping, a key that is not a string, or a non-string value under another key |
| A name in `stackledger-skills` or `stackledger-agents` that is not in the set | A name listed twice in one relation; a skill listing itself |
| A rule ID twice in one `rules.md` | A rule ID also used by an earlier skill |
| A private key or a payment-card number in any file read, code blocks included | An agent's `skills` that is not a list of strings, or names a skill not in the set |
| A given folder in which no skill folder or agent file is found | A file in `agents/` with no frontmatter |
| A sub-folder or linked skill folder that cannot be read | A symbolic link that does not lead to a skill folder, or is broken |

Each file is checked on its own first, and an error stops its later checks: size, secrets in the raw text, frontmatter, secrets in the decoded values (YAML escapes can hide a number), `name` and `description`, then the other fields. Only files without an error join the set. Relations, preloads and rule IDs are then checked against that fixed set; their problems never remove anything, so one missing skill gives one message, not a cascade. A secret is reported with a fixed message that never repeats the value.

A skill whose `rules.md` is too large, unreadable or holds a secret still joins the set, with no rules.

## Output and exit codes

Each problem is one line, `<path>:<line>:<column> <error|warning> <field> <message>` (`-` when there is no field), sorted by path, position, field, severity and message; the last line gives the counts of what joined the set:

```text
skills/release/SKILL.md:5:23 error metadata.stackledger-skills Skill editr is not in the set
skills: 3, playbooks: 1, agents: 2, rules: 10, errors: 1, warnings: 0
```

Paths start with the folder argument as given (without trailing `/`), or with nothing when no folder is given. With `--json`, stdout is one object with `problems` (`path`, `line`, `column`, `severity`, `field`, `message`) and `summary` (the six counts). Control characters in file names are removed from text lines and written as `\u` escapes in JSON.

| Exit | Meaning |
|---|---|
| 0 | No error (warnings allowed) |
| 1 | At least one error |
| 2 | Usage error, or a given folder that does not exist, is not a folder or cannot be listed; stdout is empty and stderr names the folder |

## In CI

A workflow for a skills repository (skills in sub-folders, agents in `agents/` at the top) that checks every pull request in three steps: check out, set up Node.js, validate. stackledger is not on npm yet: until 0.1.0 is released, build it from source instead of the `npx` line.

```yaml
name: Skills
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 22
      - run: npx --yes stackledger@0.1.0 skills validate
```

With no folder the repository root is checked, so problem paths are relative to it. The job fails on any error and passes with warnings. Name folders on the last line (for example `skills validate skills vendor`) to check only those, together.
