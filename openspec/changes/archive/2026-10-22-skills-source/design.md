## Context

The reading has to work on three kinds of folders without configuration: a skills repository (skills grouped in sub-folders, an `agents/` folder), a tool's own folder (`~/.claude`, with `skills/` holding symbolic links into a repository and real folders side by side) and a single skill. It must also stay usable on sets the person does not own (skills bundled with a tool), which add fields of their own to the frontmatter.

## Decisions

### 1. Relations live in `metadata`, as space-separated strings

The specification allows six top-level fields and says `metadata` maps strings to strings; `skills-ref` rejects other top-level fields. So a relation is a string of names separated by spaces, under a key prefixed `stackledger-` (the specification asks for reasonably unique keys), the same shape as `allowed-tools`:

```yaml
metadata:
  stackledger-kind: playbook
  stackledger-skills: architect developer code-review
  stackledger-agents: executor reviewer
```

Rejected: top-level lists (fail the reference validator), a nested `stackledger:` mapping inside `metadata` (not a string value), a side file per skill (a second place to keep in sync). Open question 1 asks the owner to confirm.

Agents are not Agent Skills: they keep their tool's format. Claude Code's subagent files list preloaded skills as a YAML list under `skills`, and Claude Code itself only warns when one is missing, so an unknown name there is a warning, not an error.

### 2. Severity: errors for what breaks reading or the set, warnings for the specification

| Error | Warning |
|---|---|
| No frontmatter, invalid YAML, not a mapping, missing or non-string `name` or `description`, file over 1 MiB or unreadable | `name` format or length, `name` different from the folder, `description` over 1024 characters, `compatibility` not a 1–500 character string, `license` or `allowed-tools` not a string |
| A second skill or agent with a name already in the set | Fields outside the specification (one warning per skill), a `metadata` value that is not a string (except `stackledger-*` keys) |
| Unknown `stackledger-*` key, a `stackledger-*` value that is not a string, a `stackledger-kind` other than `skill` or `playbook` | A name listed twice in one relation, a skill that lists itself |
| A name in `stackledger-skills` or `stackledger-agents` that is not in the set | A name in an agent's `skills` that is not in the set; an agent `skills` that is not a list of strings |
| A rule ID twice in one `rules.md` | A rule ID also used by another skill |
| Private key or payment-card number in any file read | A symbolic link that does not lead to a skill folder |
| A given folder in which no skill folder or agent file is found | A file in `agents/` with no frontmatter |
| A sub-folder that cannot be listed | |

Validation runs in phases. (1) Each file gets its own checks in a fixed order (size, secrets on the raw text, frontmatter shape, secrets on the decoded frontmatter, name and description, other fields), and an error stops the later steps; only a file without such an error is a candidate. (2) Among candidates, a later duplicate name is rejected. (3) The set is then fixed, and relation targets, agent preloads and rule IDs across skills are checked against it; those problems are errors or warnings on the file but never remove an item, so there is no cascade and the counts are stable. Decoded strings are scanned because YAML escapes (`\u0031`) hide a card number from a raw-text scan. That keeps one root cause to one message, and keeps every value of a file with a secret out of other items' messages.

Errors are things a pipeline should stop on; warnings are things a person should know but that tools tolerate. The specification's own constraints are warnings because a set the person does not own (bundled skills) would otherwise never pass.

### 3. Walking folders and symbolic links

Each given folder is walked depth first, entries in code-point order, at most five levels below it. A folder with a `SKILL.md` file is a skill; the walk does not enter it (its sub-folders are its resources). Folders whose name starts with `.` (below the given folder) and `node_modules` are skipped.

A symbolic link to a folder is read only when that folder holds a `SKILL.md`, and is never walked into; any other folder link gives one warning and is not followed. File links (`SKILL.md`, `rules.md`, agent files) are read, and a given folder that is a link is followed. This reads tool folders made of links (`~/.claude/skills/x -> repo/skills/y/x`, `~/.claude/agents/x.md -> repo/agents/x.md`), and the walk can never loop: the only things read from outside the given folders are linked skill folders and linked files, never walked into. An item reached twice (through a link and directly, or from two given folders) is read once, at the first path in walk order, which uses the folders in argument order; sameness is decided by device and inode numbers, which also works on case-insensitive file systems.

Copies are not links: two separate files with one name are a duplicate. A skill set is what one agent sees, so each tool folder is checked on its own; comparing tool folders with a repository is the later `skills drift` command.

The folder name used for the "name differs from the folder" warning is the name of the link or folder where the skill was found, because that is the name the tool sees.

### 4. Reuse

Network: Node 22's permission model does not restrict network access, so the offline promise is proved by a test that inspects the skill code for network modules and `fetch`, and writes are proved with the permission model.

Reused as they are: the `Problem` shape, `fieldName` and `MAX_FILE_BYTES` (`src/source.ts`), `sortProblems` (`src/validate.ts`), `secretRules` (`src/secrets.ts`), `withoutControls` and `escapeJsonControls` (`src/control.ts`), and the `yaml` package's positions. New code: frontmatter splitting and positions (the catalogue's `problem()` puts a missing field at the start of the mapping, while this change wants `1:1`, and its parser reports one problem per parser error, while this change wants one per file), and the text formatter, because the catalogue one in `src/cli.ts` prints the catalogue's counts. The skill code lives in `src/skills/` and is not imported by the catalogue commands.

## Risks

- Names that collide between a person's set and a tool's bundled skills are reported as duplicates only when both folders are given together; that is the intended use (one set = what one agent would see).
- The relation keys become a public contract once released; changing them later needs a deprecation period.
