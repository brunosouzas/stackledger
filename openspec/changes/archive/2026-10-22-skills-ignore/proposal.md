## Why

A skills repository often holds things that look like skills but are not: a template for new skills (`templates/skill/SKILL.md`), examples, and test fixtures that are broken on purpose. `stackledger skills validate` reads them as real skills, so a team's CI fails on fixtures, and a template shows up as a skill with a placeholder name. The owner asked at the `skills-source` gate 1 for a way to exclude them that works like `.gitignore`, which every developer already knows.

## What Changes

- A `.stackledgerignore` file at the top of a given folder lists, in `.gitignore` syntax, the entries the walk skips there: a skipped folder is not entered, a skipped skill folder or agent file is not read.
- The counts line and the JSON summary gain an `ignored` count, and the JSON lists the skipped paths, so excluding too much is visible.
- A problem with the ignore file itself (over 64 KiB, unreadable, not a regular file, a secret) is an error, and that folder is then read with no patterns.
- New dependency: `ignore` (MIT, no dependencies of its own), the `.gitignore` matcher used by ESLint and Prettier, pinned to an exact version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-source`: adds the ignore file, its syntax and where it applies.
- `skills-validate-command`: the text counts line and the JSON summary gain `ignored`; the JSON gains the `ignored` list.

## Out of scope

- `.stackledgerignore` files below the top of a given folder (nested ignore files, as `.gitignore` allows) or above it, and global or per-user ignore files.
- A list of the ignored paths in the text output: it stays one counts line; the JSON has the list.
- An option that makes any ignore an error in CI: comparing the JSON list with a trusted one does it (`jq -e '.ignored == [...]'`), shown in the docs.
- An option to bypass the file (`--no-ignore`).
- Ignoring files inside a skill folder (a skill is read whole or not at all) and the software catalogue (`stackledger validate`).
- Reading `.gitignore` itself: what Git ignores is not always what a skill set should skip.

## Decisions to confirm at gate 1

1. **Only one file, at the top of each given folder.** Recommended: it covers templates, examples and fixtures, and keeps the rule easy to explain; nested files can come later without breaking anything.
2. **An `ignored` count in the output.** Recommended: without it, a pattern that hides real skills passes silently. The counts line changes before the skills commands are first released, so no released format breaks.
3. **The `ignore` package instead of our own matcher.** Recommended: `.gitignore` semantics have many edge cases (negation, anchoring, `**`, escapes, a folder that cannot be re-included); a small, widely used library with no dependencies is safer than new code.

## Gate 1

The owner approved the three decisions above as recommended (2026-10-22). After the first spec review, the spec also: tests `<skill>/SKILL.md` as Git would (so `fixtures/*/SKILL.md` works); tests only the entries that can add to the set; bounds the ignore file (64 KiB, 100 pattern lines, 200 characters and 16 wildcards per line); tests links without `/`, as Git does; and adds the JSON `ignored` list.

## Implicit requirements

- **Errors and invalid input:** requirement. An ignore file that cannot be used is an error on that file, and its folder is read with no patterns, so nothing is hidden by a broken file. Each line means what it means to `ignore@7.0.13`, which follows Git; a line Git cannot match (such as `a[`) matches nothing and gives no problem, because the package does not report such lines.
- **Limits:** requirement. The ignore file has its own limits (64 KiB, 100 pattern lines, 200 characters and 16 wildcards per line), and every line is compiled when read: a fork's pull request must not be able to stall CI or crash the matcher.
- **Repetition and idempotency:** requirement. The same files give the same output.
- **Concurrency:** n/a: one read-only process.
- **Security:** requirement. The file is checked with the secret rules like every file read, and messages about it are fixed texts that never repeat its content.
- **Logs and observability:** requirement. The `ignored` count; no other logging.

## Dependencies

ADR 10 and the v2 roadmap (PR #12, merged), where this change is row 2.

## Documentation

- `docs/skills.md`: the ignore file, its syntax, where to put it, an example for templates and fixtures, the `ignored` count and list, a CI check on the count, and the `.gitignore` caveat; the counts sentence (now seven counts).
- `README.md`: one sentence in "Agent skills".
- `docs/roadmap.md`: the row of `skills-ignore`.
- Brain vault: the stackledger architecture, roadmap and changelog.
