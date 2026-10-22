## 1. Code

- [ ] 1.1 Add `ignore@7.0.13` as an exact dependency (`npm install --save-exact`), and check `npm ls --omit=dev` shows no other new package. Check: `npm ci && npm run build`.
- [ ] 1.2 `src/skills/ignore.ts`: find `.stackledgerignore` at the top of a given folder that is not a skill folder (`lstat`, then the target for a link); read a regular file through the same bounded, non-blocking read as other files but with a 64 KiB limit, and check it with the secret rules; build the matcher with `ignorecase: false`; return an error and no patterns for anything else. Report each ignore file problem once per run (device and inode, first path in walk order). Check: `npx vitest run test/unit/skills-ignore.test.ts`.
- [ ] 1.3 `src/skills/walk.ts`: right after the hidden and `node_modules` skip, test folders, links (with `/` only when the target is a folder; a matched link gets no warning), each skill folder's own path and its `SKILL.md` path, and the `.md` files directly in the top-level `agents/`; never test other files. Record each skipped entry once per run by device and inode, with its display path. Check: same file.
- [ ] 1.4 `src/skills/source.ts` and `command.ts`: the `ignored` count and sorted list in the set; the text counts line (`ignored` after `rules`); the JSON `ignored` list between `problems` and `summary`; "Folders with nothing found" ignores skipped entries and its message says how many were skipped. Check: `npx vitest run test/unit/skills-*.test.ts test/integration/skills-validate.test.ts`.

## 2. Tests and documentation

- [ ] 2.1 One test per scenario, named after it (map below); update the tests that assert the counts line or the JSON summary. Fixtures are fictitious (Northwind) and built in temporary folders.
- [ ] 2.2 `docs/skills.md`: an "Ignore file" section (where to put it and that it is not read from parents or sub-folders, syntax, what is tested and what never is, an example for a template folder and fixtures, the `ignored` count and JSON list, a CI check with `jq -e '.summary.ignored == N'`, failure reads everything, the `.gitignore` caveat for local build copies); the counts sentence (seven counts) and the JSON shape; README "Agent skills" one sentence; `AGENTS.md` implemented list; `docs/roadmap.md` row 2 delivered. Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full suite. Check: `npm test`.
- [ ] 3.2 Release note: this change ships in the same npm release as `skills-source` (the `skills` command is unreleased, so the new counts are not a breaking change only then). Recorded in the pull request.

| Capability | Scenario | Test file |
|---|---|---|
| skill-source | Template folder ignored; Ignore file below the top; Ignore file above the given folder; Ignore file in a skill folder | test/unit/skills-ignore.test.ts |
| skill-source | Negation re-includes a skill; Ignored folder cannot be re-included below; Pattern syntax table; CRLF and byte-order mark | test/unit/skills-ignore.test.ts |
| skill-source | Link matched with a folder pattern; Broken link matched; Folder pattern does not match a broken link; Folder pattern does not match a file; SKILL.md pattern; Files the walk does not use | test/unit/skills-ignore.test.ts |
| skill-source | Agent file ignored; Patterns stay in their folder; Overlapping folders; Rules file is never ignored | test/unit/skills-ignore.test.ts |
| skill-source | Count; Folder given twice with an ignore file | test/unit/skills-ignore.test.ts |
| skill-source | Secret in the ignore file; Oversized ignore file; FIFO ignore file; Broken link ignore file; Ignore file problem in a folder given twice | test/unit/skills-ignore.test.ts |
| skill-source | Linked copy of a repository skill (existing test, unchanged) | test/unit/skills-walk.test.ts |
| skill-source | Wrong folder; Everything already read (existing tests, unchanged); Everything ignored | test/unit/skills-problems.test.ts |
| skills-validate-command | Problem line; Control characters in a file name; Clean set; JSON with one error; JSON ignored list | test/integration/skills-validate.test.ts |

## Workflow follow-up

- Run read-only against the owner's real skills repository in place, with no ignore file there, and report the counts; then against a scratch folder of links to it plus a `.stackledgerignore` holding `templates/`, and report that the template warning is gone and `ignored` is 1.
