## Why

A skills repository often holds things that look like skills but are not: a template for new skills (`templates/skill/SKILL.md`), examples, and test fixtures that are broken on purpose. `stackledger skills validate` reads them as real skills, so a team's CI fails on fixtures, and a template shows up as a skill with a placeholder name. The owner asked at the `skills-source` gate 1 for a way to exclude them that works like `.gitignore`, which every developer already knows.

## What Changes

- A `.stackledgerignore` file at the top of a given folder lists, in `.gitignore` syntax, the entries the walk skips there: a skipped folder is not entered, a skipped skill folder or agent file is not read.
- The counts line and the JSON summary gain an `ignored` count, so excluding too much is visible.
- A problem with the ignore file itself (too large, unreadable, a secret) is an error, and that folder is then read with no patterns.
- New dependency: `ignore` (MIT, no dependencies of its own), the `.gitignore` matcher used by ESLint and Prettier, pinned to an exact version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-source`: adds the ignore file, its syntax and where it applies.
- `skills-validate-command`: the text counts line and the JSON summary gain `ignored`.

## Out of scope

- `.stackledgerignore` files below the top of a given folder (nested ignore files, as `.gitignore` allows), and global or per-user ignore files.
- An option to bypass the file (`--no-ignore`).
- Ignoring files inside a skill folder (a skill is read whole or not at all) and the software catalogue (`stackledger validate`).
- Reading `.gitignore` itself: what Git ignores is not always what a skill set should skip.

## Decisions to confirm at gate 1

1. **Only one file, at the top of each given folder.** Recommended: it covers templates, examples and fixtures, and keeps the rule easy to explain; nested files can come later without breaking anything.
2. **An `ignored` count in the output.** Recommended: without it, a pattern that hides real skills passes silently. The counts line changes before the skills commands are first released, so no released format breaks.
3. **The `ignore` package instead of our own matcher.** Recommended: `.gitignore` semantics have many edge cases (negation, anchoring, `**`, escapes, a folder that cannot be re-included); a small, widely used library with no dependencies is safer than new code.

## Gate 1

The owner approved the three decisions above as recommended (2026-10-22).

## Implicit requirements

- **Errors and invalid input:** requirement. An ignore file that cannot be used is an error on that file, and its folder is read with no patterns, so nothing is hidden by a broken file. A line that is not a valid pattern matches nothing, as in Git (the `ignore` package drops such lines without telling, so a warning would need our own parser).
- **Limits:** requirement. The ignore file follows the 1 MiB limit of every file read.
- **Repetition and idempotency:** requirement. The same files give the same output.
- **Concurrency:** n/a: one read-only process.
- **Security:** requirement. The file is checked with the secret rules like every file read, and messages about it never repeat a line's text, only its number.
- **Logs and observability:** requirement. The `ignored` count; no other logging.

## Dependencies

ADR 10 and the v2 roadmap (PR #12, merged), where this change is row 2.

## Documentation

- `docs/skills.md`: the ignore file, its syntax, an example for templates and fixtures, the `ignored` count.
- `README.md`: one sentence in "Agent skills".
- `docs/roadmap.md`: the row of `skills-ignore`, after PR #12.
- Brain vault: the stackledger architecture, roadmap and changelog.
