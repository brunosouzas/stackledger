## Scenario to test map

Levels: U unit (`src/skills/` functions on folders built in a temporary directory), I integration (the built CLI). Every scenario has one test named after it. Fixtures are fictitious (a Northwind team's skills), built in temporary folders by a helper in `test/skills-helpers.ts`.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| skill-source | Two folders form one set; Read-only; Hidden link to a skill; Linked SKILL.md; Linked given folder; Grouped skills; Resources are not skills; Depth limit; Hidden and dependency folders; Given folder is a hidden tool folder; A single skill | `test/unit/skills-walk.test.ts` | U |
| skill-source | Tool folder made of links; Link to a plain folder; Broken link; Linked copy of a repository skill; Unlistable sub-folder; Listing order does not matter | `test/unit/skills-walk.test.ts` | U |
| skill-source | No frontmatter; Invalid YAML; Frontmatter never closed; CRLF and byte-order mark; Missing description; Name not a string; Upper-case name; Name differs from the folder; Ligatures in a description; Description at the limit; Tool-specific fields; Number as a metadata key; Nested metadata | `test/unit/skills-frontmatter.test.ts` | U |
| skill-source | Secret and no frontmatter; Escaped card number; Several field problems; Name and description both missing; Target excluded by an error; Cascading relations | `test/unit/skills-problems.test.ts` | U |
| skill-source | Playbook; Typo in a key; Unknown key with a list value; Unknown kind; List instead of a string; Missing skill; Missing agent; Names on several lines; Repeated name; Missing name repeated | `test/unit/skills-relations.test.ts` | U |
| skill-source | Claude Code subagent; Linked agent file; Agent without a name; Notes in the agents folder; Nested agents folder; Unknown preloaded skill; Skills as a string; Same skill name in two folders; Two agents with one name | `test/unit/skills-relations.test.ts` | U |
| skill-source | Rule with why and check; Indented item; Example inside a code fence; Fence never closed; Duplicate in one file; Same ID in two skills | `test/unit/skills-rules.test.ts` | U |
| skill-source | Private key in a skill; Card number as a skill name; Ordinary numbers; Oversized rules file; Unreadable SKILL.md; Wrong folder; Everything already read | `test/unit/skills-problems.test.ts` | U |
| skill-source | Write-protected run | `test/integration/skills-validate.test.ts` | I |
| skill-source | Network not used | `test/unit/skills-offline.test.ts` | U |
| skills-validate-command | Default folder; Several folders; Folder given twice; Help wins; No subcommand; Unknown subcommand; Unknown option; Warnings only; One error; Missing second folder | `test/integration/skills-validate.test.ts` | I |
| skills-validate-command | Relative argument; No argument; Trailing separator; Position of a relation; Position of an unknown key; Problem line; Control characters in a file name; Clean set; JSON with one error | `test/integration/skills-validate.test.ts` | I |

`Listing order does not matter` reads the same fixture through a directory-listing function injected in reversed order. `Read-only` hashes every fixture file and compares modification times before and after. `Write-protected run` runs the built CLI with `node --permission --allow-fs-read=*` and compares output and exit code with an unrestricted run. Node 22's permission model does not restrict the network, so `Network not used` inspects `src/skills/*.ts` and the command for network modules and `fetch` instead. `Unlistable sub-folder` and `Unreadable SKILL.md` use `chmod 000` and are skipped when the tests run as root.

## 1. Reading a skill set

- [x] 1.1 `src/skills/walk.ts`: walk the given folders (depth, hidden and `node_modules` entries skipped before link checks, skill folders, file and folder links, one read per device and inode, agents folder, unlistable sub-folders) with an injectable directory listing, and return the files to read with their display paths; `test/skills-helpers.ts` with the fixture builder; the walk scenarios in `test/unit/skills-walk.test.ts`. Check: `npx vitest run test/unit/skills-walk.test.ts`.
- [x] 1.2 `src/skills/frontmatter.ts`: split and parse the frontmatter (byte-order mark, CRLF, unclosed block, one mapping, duplicate keys, one error per file) with value and key positions offset to the file; name and description, specification checks (NFKC only for the name format; lengths in code points without normalisation), outside fields and non-string metadata keys; the frontmatter scenarios. Check: `npx vitest run test/unit/skills-frontmatter.test.ts`.
- [x] 1.3 `src/skills/rules.ts`: rules files (IDs at column 1, why and check lines, groups, backtick and tilde fences, unclosed fences, duplicates in one file and across skills); the rules scenarios. Check: `npx vitest run test/unit/skills-rules.test.ts`.
- [x] 1.4 `src/skills/source.ts`: the per-file check order (secret rules on raw text, then on decoded frontmatter keys and strings), unique names among candidates, then the fixed set and the checks against it (relation keys, declared relations, repeated and self relations, agent preloads, rule IDs across skills), which add problems without removing items, secrets through `secretRules`, file limits, folders with nothing found, sorting with `sortProblems` from `src/validate.ts`; the relation and problem scenarios. Check: `npx vitest run test/unit/skills-relations.test.ts test/unit/skills-problems.test.ts test/unit/skills-offline.test.ts`.

## 2. The command

- [ ] 2.1 `src/skills/command.ts` and `src/cli.ts`: `stackledger skills validate`, usage and global usage, exit codes, problem paths (trailing separators, `.`), a new text formatter with the skills counts, JSON output, control characters through `src/control.ts`; `test/integration/skills-validate.test.ts`. Check: `npm run build && npx vitest run test/integration/skills-validate.test.ts`, and the existing `test/integration/cli.test.ts` still passes.
- [ ] 2.2 Documentation: `docs/skills.md` (format, relation keys, checks table, one set = what one agent sees and each tool folder on its own, a CI example with the three steps), README Usage row and "Agent skills" section, `AGENTS.md` implemented list, the roadmap row once PR #12 is merged. Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full checks from clean: `rm -rf node_modules dist && npm ci && npm run build && npm test`. Check: all pass.
- [ ] 3.2 Adversarial run of the built CLI (by hand, beyond the tests): a skill with a private key, a link loop made of two folder links, a card number used as a name, `--help` mixed with bad arguments. Check: no key text or number in the output, no hang, exit codes as specified.

## Workflow follow-up

- Run read-only against the owner's real skills repository and tool folders in place (never copied into this repository) and report what a real set produces.
- After the merge: archive the change, write the capability Purposes, mark the roadmap row delivered.
