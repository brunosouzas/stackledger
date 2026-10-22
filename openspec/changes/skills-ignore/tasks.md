## 1. Code

- [ ] 1.1 Add `ignore@7.0.13` as an exact dependency (`npm install --save-exact`), and check `npm ls --omit=dev` shows no other new package. Check: `npm ci && npm run build`.
- [ ] 1.2 `src/skills/ignore.ts`: read `.stackledgerignore` at the top of a given folder through the same bounded, non-blocking read and secret rules as the other files; build the matcher with `ignorecase: false`; return no patterns on any error. Check: `npx vitest run test/unit/skills-ignore.test.ts`.
- [ ] 1.3 `src/skills/walk.ts`: test each entry below a given folder right after the hidden and `node_modules` skip, with its relative `/` path and a trailing `/` for folders and folder links; count skipped entries; never test files inside a skill folder; given folders that are skill folders read no ignore file. Check: same file.
- [ ] 1.4 `src/skills/source.ts` and `command.ts`: the `ignored` count in the set, the text counts line and the JSON summary; "Folders with nothing found" ignores skipped entries. Check: `npx vitest run test/unit/skills-*.test.ts test/integration/skills-validate.test.ts`.

## 2. Tests and documentation

- [ ] 2.1 One test per scenario, named after it (map below); update the tests that assert the counts line. Fixtures are fictitious (Northwind) and built in temporary folders.
- [ ] 2.2 `docs/skills.md`: an "Ignore file" section (syntax, where it applies, what it never touches, an example for a template folder and fixtures, the `ignored` count, failure reads everything); README "Agent skills" one sentence; `AGENTS.md` implemented list. Check: `npx vitest run test/integration/docs.test.ts`.

## 3. Integration

- [ ] 3.1 Full suite. Check: `npm test`.

| Capability | Scenarios |
|---|---|
| skill-source | Template folder ignored; Negation re-includes a skill; Ignored folder cannot be re-included below; Case-sensitive match; Comment and escaped hash; Ignore file below the top; Ignore file in a skill folder; Link matched by its own path; Folder pattern does not match a file; Agent file ignored; Patterns stay in their folder; Rules file is never ignored; Count; Secret in the ignore file; Invalid pattern line; Oversized ignore file; Wrong folder; Everything already read; Everything ignored |
| skills-validate-command | Problem line; Control characters in a file name; Clean set; JSON with one error; JSON ignored count |

## Workflow follow-up

- Run read-only against the owner's real skills repository with a `.stackledgerignore` written in a temporary copy of the file list only (never in the real repository) and report the counts.
- After PR #12 is merged: mark the `skills-ignore` row of `docs/roadmap.md` delivered.
