## 1. Discovery

- [x] 1.1 Add `script: string | null` to `LaunchdItem` (`src/discovery/types.ts`) and to the launchd schema in `src/discovery/snapshot.ts`: optional on read and defaulted to null, always written, a non-string non-null value invalid, and included in the strings the secret guard checks. Check: `test/unit/discovery-snapshot.test.ts` for "Snapshot from before the script field" (parsed, then drift text and JSON) and "Script of the wrong type" (problem `shape`; exit 2 and its message come from the shared mapping proven in `test/integration/drift.test.ts`), and `test/unit/discovery-sources.test.ts` for "Card number in a script path".
- [x] 1.2 In `src/discovery/sources/launchd.ts`, after `program`, when it is an interpreter, extract `ProgramArguments.1` once and keep it only when it starts with `/` and sandboxed `test -f` exits 0. Check: `test/unit/discovery-sources.test.ts` with the virtual host for "Agent of the user", "Interpreter job", "Interpreter set through Program", "Interpreter with a flag first", "Not an interpreter name", "Script is a folder", "Interpreter with no argument", "Plist reader that hangs on the script key", "File check that hangs", "Script through a link", "Non-string script value", "Later arguments of an interpreter job", "Token as first argument", "Token that looks like a path" and "Arguments are not recorded" (every `plutil` run matched against the allowed keys).
- [x] 1.3 Restated scenarios stay proven by their existing tests: "Unreadable daemon", "Unexaminable launchd file" and "Linked launchd folder" in `test/unit/discovery-sources.test.ts`. Check: those tests pass unchanged.

## 2. Drift

- [x] 2.1 Add `program` and `script` after `path` to every `NotDeclared` entry (`src/drift.ts`, null outside launchd) and print `  runs <program> [<script>]` after ` (<path>)` (`src/drift-formats.ts`), control characters removed. Check: `test/unit/drift.test.ts` for "Interpreter job not declared" (the exact line), "Job without a program" and "Other sources".
- [x] 2.2 Scaffold copies no `script`. Check: `test/unit/scaffold.test.ts` scaffold cases, including "Scaffold of a cask" and "Title of control characters only", pass, and a scaffold of an interpreter job holds no `script` value.

## 3. Example and docs

- [x] 3.1 Add `script` to the launchd items of `examples/northwind-machine/snapshot.json`, one of them an interpreter job. Check: `test/integration/drift.test.ts` and the docs example in `docs/discovery.md` agree with `node dist/cli.js drift examples/northwind --snapshot examples/northwind-machine/snapshot.json`.
- [x] 3.2 Update `docs/discovery.md` (launchd row, privacy paragraph, snapshot item fields and older files without `script`, drift text and JSON examples, 0.6.0 rejecting new snapshots) and `skills/stackledger/SKILL.md` (drift JSON fields); the vault changelog after the merge. Check: the docs tests pass (`/Users/username` paths only) and `grep -n "never its arguments" docs/` finds nothing stale.

## 4. Close

- [x] 4.1 `npm run build`, `npm test` and `openspec validate launchd-script --strict` pass.
