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

Point the command at folders that hold real skills. Templates, examples and deliberately broken test fixtures inside them are read like any skill unless an [ignore file](#ignore-file) skips them.

## Ignore file

A `.stackledgerignore` file lists, in `.gitignore` syntax, the entries the walk skips: a skipped folder is not entered, a skipped link is not followed, and a skipped skill folder or agent file is not read.

```gitignore
# The template for new skills, and fixtures that are broken on purpose.
templates/
fixtures/*/SKILL.md
# Keep one example as a real skill.
examples/*
!examples/northwind
```

**Where it is read.** Only at the top of each given folder that is not itself a skill folder (with no folder given: the current folder). It is never read from a parent or a sub-folder, so running at the repository root and running on `skills/` can give different sets: put the file in the folder your pipeline points the command at. The patterns of one given folder never apply to another given folder, even when the two overlap: an entry skipped through `repo` can still be read through `repo/skills`. A `.stackledgerignore` that is a link to a regular file is read.

**Syntax.** Each line means what it means to Git, as implemented by the [`ignore`](https://www.npmjs.com/package/ignore) package (version 7.0.13): blank lines and `#` comments, `\#` and `\!` for a literal first character, trailing spaces dropped, `!` to re-include (the last matching line wins), a leading or middle `/` to anchor a pattern to the given folder, a trailing `/` for folders only, and the wildcards `*`, `?`, `[...]` and `**`. A folder that is skipped is not entered, so nothing below it can be re-included, as with Git. Matching is case-sensitive on every platform and compares names as stored, without Unicode normalisation. Line endings may be LF or CRLF, and a byte-order mark is dropped. A line Git cannot match (such as `a[`) matches nothing and gives no problem.

**What is tested.** Paths are relative to the given folder, separated by `/`. The walk tests only the entries that can add to the set: each folder (with a trailing `/`), each symbolic link (always without `/`, whatever it points to, as Git does: `shared/` does not skip a link named `shared`, `shared` does), each skill folder's `SKILL.md` (so `fixtures/*/SKILL.md` skips those skills, but not a linked skill, whose inside Git does not look at), and each `.md` file directly in the top-level `agents/` folder. Other files are never tested: `*.md` does not skip a skill, and files inside a skill folder, `rules.md` included, are never skipped (a skill is read whole or not at all). Hidden entries and `node_modules` are skipped before the ignore file is looked at, so a pattern such as `!.claude/` has no effect.

**The `ignored` count and list.** The counts line gives `ignored`, the number of entries the ignore files skipped: each entry once per run (a folder given twice counts once), a skipped folder as one whatever it holds (`fixtures/` counts one, `fixtures/*` counts each entry below it). Hidden entries and `node_modules` are not counted. The JSON output lists the skipped paths, so you can see what a pattern hid. A given folder where everything was skipped still fails with "No skill folder or agent file found", and the message says how many entries `.stackledgerignore` skipped.

**Limits.** The file can be changed by any pull request, so its cost is bounded: at most 64 KiB, 100 pattern lines (not blank, not comments), 200 characters and 16 wildcard characters (`*`, `?`, `[`) per line. Every line is compiled when the file is read.

**A file that cannot be used reads everything.** An ignore file over a limit, with a line the matcher cannot compile, unreadable, holding a secret, or not a regular file (a folder, a FIFO, a broken or looping link) is an error on `.stackledgerignore`, reported once, and that folder is read with no patterns. Hiding too much would be silent; reading too much is loud, and the error says why. Messages name at most a line number, never the file's text.

**`.gitignore` is not read.** What Git ignores is not always what a skill set should skip. A local build copy that Git ignores (for example a `dist/` folder holding copied skills) is read on a laptop and gives duplicate-name errors there, not in CI: add such folders to `.stackledgerignore` as well.

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
| A sub-folder or linked skill folder that cannot be read; a `.stackledgerignore` that cannot be used (see [Ignore file](#ignore-file)) | A symbolic link to a folder without `SKILL.md`, a broken or looping link, or a link to neither a file nor a folder (a link to a file is read where that file is expected and otherwise ignored) |

Each file is checked on its own first, and an error stops its later checks: size, secrets in the raw text, frontmatter, secrets in the decoded values (YAML escapes can hide a number), `name` and `description`, then the other fields. Only files without an error join the set. Relations, preloads and rule IDs are then checked against that fixed set; their problems never remove anything, so one missing skill gives one message, not a cascade. A secret is reported with a fixed message that never repeats the value. File and folder names are not scanned: they appear in paths, as in `stackledger validate`, so do not name a folder after a secret.

A skill whose `rules.md` is too large, unreadable or holds a secret still joins the set, with no rules.

## Output and exit codes

Each problem is one line, `<path>:<line>:<column> <error|warning> <field> <message>` (`-` when there is no field), sorted by path, position, field, severity and message; the last line gives seven counts: `skills`, `playbooks`, `agents` and `rules` count what joined the set, `ignored` counts the entries skipped by ignore files, then `errors` and `warnings`. With the `release` playbook above written as `stackledger-skills: writer editr` in `skills/release/SKILL.md`:

```text
skills/release/SKILL.md:6:23 error metadata.stackledger-skills Skill editr is not in the set
skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 1, warnings: 0
```

Paths start with the folder argument as given (without trailing `/`), or with nothing when no folder is given. With `--json`, stdout is one object with, in this order, `problems` (`path`, `line`, `column`, `severity`, `field`, `message`), `ignored` (the paths skipped by ignore files, as problems display them, sorted by code point) and `summary` (the seven counts, in the counts line's order):

```json
{"problems":[],"ignored":["skills/fixtures","templates"],"summary":{"skills":3,"playbooks":1,"agents":2,"rules":10,"ignored":2,"errors":0,"warnings":0}}
```
 Control characters in file names are removed from text lines and written as `\u` escapes in JSON.

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

A pull request can also change `.stackledgerignore` to hide a real skill. To refuse any skip you have not approved, replace the last step with one that compares the JSON `ignored` list with a trusted one (`jq` is installed on GitHub's Ubuntu runners; the exit code of `skills validate` is replaced by the `errors` check, and a usage error leaves no JSON, so `jq` fails):

```yaml
      - run: |
          npx --yes stackledger@0.1.0 skills validate --json > skills.json || true
          jq -e '.summary.errors == 0 and .ignored == ["skills/fixtures","templates"]' skills.json
```

Compare the list, not only the count: a fork could swap an approved exclusion for a real skill and keep the number.
