## Why

People and teams now keep agent skills (folders with a `SKILL.md`, per the [Agent Skills specification](https://agentskills.io/specification)), agent definitions and rules next to their code, but nothing checks them as a set: a playbook can name a skill that no longer exists, two skills can share a name, a rule ID can be defined twice, and a skill can drift away from the specification that every tool reads. This is the first change of the v2 roadmap ([ADR 10](../../../docs/adr/0010-agent-skills-are-a-second-ledger-read-from-their-folders.md)): it teaches stackledger to read a skill set and check it, so a person can run it on their own folders and a team can run it in any CI on every pull request. The site, the maps and the comparison with installed tools build on this reading in later changes.

## What Changes

- New command `stackledger skills validate [folder...] [--json]`: reads one or more folders as one skill set and reports problems in the same line format as `stackledger validate`, with exit codes 0, 1 and 2.
- Reading a skill set: skill folders found by walking each folder (`SKILL.md` frontmatter), agent files in an `agents/` folder at the top of each given folder (the Claude Code subagent format), and an optional `rules.md` next to each `SKILL.md`.
- Relations are declared in each skill, inside the specification's `metadata` field so `SKILL.md` stays valid: `stackledger-kind: playbook`, `stackledger-skills` and `stackledger-agents` (space-separated names). Agents keep the Claude Code `skills` list.
- Checks: what breaks reading (no frontmatter, invalid YAML, missing `name` or `description`), what breaks the set (duplicate skill or agent names, a declared skill or agent that does not exist, a duplicate rule ID in one file, a typo in a `stackledger-*` key), departures from the Agent Skills specification (as warnings), and private keys or payment-card numbers in any file read.
- The global `--help` lists the new command.

## Capabilities

### New Capabilities

- `skill-source`: how stackledger finds and reads skills, playbooks, agents and rules in folders, which relations it reads, and which problems a skill set can have.
- `skills-validate-command`: the `stackledger skills validate` command line: input, usage errors, exit codes, text and JSON output.

### Modified Capabilities

None. The software catalogue, `stackledger validate` and the other commands do not change.

## Out of scope

- The site, the skills map, Mermaid pages, the comparison with what each tool has installed, links between skills and software, MCP tools for skills: later v2 changes.
- Relations written in the text of a skill (a skill name in backticks): only declared relations are read.
- Other agent formats (Codex TOML, Cursor rules, `AGENTS.md`), lower-case `skill.md`, reading a skill set from a Git URL.
- Following a symbolic link to a folder that is not itself a skill (see the design).
- Fixing anything: the command only reads.

## Open questions for gate 1

1. **Relation format.** Recommended: the `metadata` keys above, because the specification allows only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools` at the top level, `metadata` holds only string values, and the reference validator (`skills-ref`) rejects any other top-level field. The alternative, top-level `skills:` and `agents:` lists, is what the owner's own skills repository uses today, but it makes every playbook fail the reference validator. With the recommendation, that repository migrates its playbooks in a small pull request of its own.
2. **Fields outside the specification** (for example `version`, `author`, `aliases`, or Claude Code's `model`): recommended one warning per skill naming them, because tools add their own fields and an error would fail almost every real set.
3. **The same rule ID in two skills**: recommended a warning (the reviewer usually cites the rule with its skill), and an error only inside one rules file.
4. **Copies in tool folders.** A skill set is what one agent sees, so two separate files with the same name are a duplicate-name error, while links to the same file are read once. Giving a repository and a tool folder that holds copies (not links) together therefore fails. Recommended: keep it, and document that each tool folder is checked on its own; comparing tool folders with a repository is the job of `skills drift` (roadmap change 4).
5. **Templates and test fixtures inside a skills folder** (a `templates/skill/SKILL.md` mould, deliberately broken fixtures) are read like any skill. Recommended: no ignore mechanism in this change; point the command at the folders that hold real skills, and rename a mould file (for example `SKILL.md.template`). An ignore list can come with the settings file that `skills-site` needs anyway.
6. **Secret scan over whole files, code blocks included.** A security skill that shows a PEM header as an example fails. Recommended: keep scanning everything, because a real key pasted in a code block is the case that matters; a run over 148 real `SKILL.md`, `rules.md` and agent files found no false positive.

## Implicit requirements

- **Errors and invalid input:** requirement. Every problem has a path, position, severity and message; a given folder that cannot be read stops the command with exit 2; a sub-folder or file that cannot be read is an error for that path only, and the rest is still read.
- **Limits:** requirement. Folders are walked at most five levels deep; files over 1 MiB are not read (the catalogue's limit).
- **Repetition and idempotency:** requirement. The output is the same for the same files, whatever the order the file system lists them in; the same skill folder reached twice is read once.
- **Concurrency:** n/a: one read-only process; files changed during a run may give a mixed result, as with `stackledger validate`.
- **Security:** requirement. Read-only, no network, symbolic links to non-skill folders are not followed, private keys and payment-card numbers are errors whose message never repeats the value.
- **Logs and observability:** requirement. Problems on stdout, usage and folder errors on stderr, no other logging.

## Dependencies

ADR 10 and the v2 section of `docs/roadmap.md` arrive with PR #12; this change's documentation tasks update that roadmap row after PR #12 is merged.

## Documentation

- `README.md`: the new command in Usage, and a short "Agent skills" section with the relation keys.
- `docs/skills.md` (new): the skill-set format, the relation keys, what each check means, and a CI example.
- `AGENTS.md`: the implemented list.
- `docs/roadmap.md`: the row of `skills-source`.
- Brain vault: the stackledger project page (status), on the vault's `main`.
