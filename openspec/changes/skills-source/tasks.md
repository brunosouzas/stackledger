## Scenario to test map

Levels: U unit (`src/skills/` functions on folders built in a temporary directory), I integration (the built CLI). Every scenario has one test named after it. Fixtures are fictitious (a Northwind team's skills), built in temporary folders by a helper in `test/skills-helpers.ts`.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| skill-source | Two folders form one set; Read-only; Grouped skills; Resources are not skills; Depth limit; Hidden and dependency folders; Given folder is a hidden tool folder; A single skill | `test/unit/skills-walk.test.ts` | U |
| skill-source | Tool folder made of links; Link to a plain folder; Broken link; Repository and tool folder given together | `test/unit/skills-walk.test.ts` | U |
| skill-source | No frontmatter; Invalid YAML; CRLF file; Missing description; Name not a string; Upper-case name; Name differs from the folder; Description at the limit; Tool-specific fields; Nested metadata | `test/unit/skills-frontmatter.test.ts` | U |
| skill-source | Playbook; Typo in a key; Unknown kind; List instead of a string; Missing skill; Missing agent; Repeated name; Target excluded by an error; Claude Code subagent; Nested agents folder; Unknown preloaded skill; Skills as a string; Same skill name in two folders | `test/unit/skills-relations.test.ts` | U |
| skill-source | Rule with why and check; Example inside a code fence; Duplicate in one file; Same ID in two skills | `test/unit/skills-rules.test.ts` | U |
| skill-source | Private key in a skill; Ordinary numbers; Oversized rules file; Wrong folder; Listing order does not matter | `test/unit/skills-problems.test.ts` | U |
| skills-validate-command | Default folder; Several folders; Help wins; No subcommand; Unknown subcommand; Unknown option; Warnings only; One error; Missing second folder | `test/integration/skills-validate.test.ts` | I |
| skills-validate-command | Relative argument; No argument; Position of a relation; Clean set; JSON with one error | `test/integration/skills-validate.test.ts` | I |

`Listing order does not matter` reads the same fixture through a directory-listing function injected in reversed order. `Read-only` hashes every fixture file and compares modification times before and after.

## 1. Reading a skill set

- [ ] 1.1 `src/skills/walk.ts`: walk the given folders (depth, skipped folders, skill folders, symbolic links, one read per real path, agents folder) and return the files to read with their display paths; `test/skills-helpers.ts` with the fixture builder; the walk scenarios in `test/unit/skills-walk.test.ts`. Check: `npx vitest run test/unit/skills-walk.test.ts`.
- [ ] 1.2 `src/skills/frontmatter.ts`: split and parse the frontmatter (byte-order mark, CRLF, one mapping, duplicate keys) with positions offset to the file; name, description, specification and outside-field checks; the frontmatter scenarios. Check: `npx vitest run test/unit/skills-frontmatter.test.ts`.
- [ ] 1.3 `src/skills/rules.ts`: rules files (IDs, groups, code fences, duplicates in one file and across skills); the rules scenarios. Check: `npx vitest run test/unit/skills-rules.test.ts`.
- [ ] 1.4 `src/skills/source.ts`: build the set (kinds, unique names, relation keys, declared relations, agents and their `skills`), secrets through `secretRules`, file limits, folders with nothing to read, sorting with `sortProblems`; the relation and problem scenarios. Check: `npx vitest run test/unit/skills-relations.test.ts test/unit/skills-problems.test.ts`.

## 2. The command

- [ ] 2.1 `src/skills/command.ts` and `src/cli.ts`: `stackledger skills validate`, usage and global usage, exit codes, problem paths, text and JSON output through `src/control.ts`; `test/integration/skills-validate.test.ts`. Check: `npm run build && npx vitest run test/integration/skills-validate.test.ts`, and the existing `test/integration/cli.test.ts` still passes.
- [ ] 2.2 Documentation: `docs/skills.md` (format, relation keys, checks table, CI example with the three steps), README Usage row and "Agent skills" section, `AGENTS.md` implemented list, roadmap row. Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full checks from clean: `rm -rf node_modules dist && npm ci && npm run build && npm test`. Check: all pass.
- [ ] 3.2 Adversarial run of the built CLI: a skill with a private key, a link loop made of two links, a hostile file name with ESC and U+009B, `--help` mixed with bad arguments. Check: no key text in the output, no hang, no raw control character, exit codes as specified.

## Workflow follow-up

- Run read-only against the owner's real skills repository and tool folders in place (never copied into this repository) and report what a real set produces.
- After the merge: archive the change, write the capability Purposes, mark the roadmap row delivered.
