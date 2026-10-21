## Scenario to test map

Levels: U unit, I integration (CLI, entry script or built files), P performance (run alone with `npm run test:perf`). Every scenario has one test named after it. "macOS" marks tests that run only when `process.platform === 'darwin'` (locally and in the new `macos-latest` CI job).

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Valid discovery annotations; Unknown discovery source; Empty identifier; Other annotations untouched; Identifier claimed twice; Same identifier for two sources | `test/unit/annotations.test.ts` | U |
| catalogue | Hostile annotation key (text and JSON output of `stackledger validate`) | `test/integration/cli.test.ts` | I |
| mac-discovery | Name with spaces; Name with accents; Name with nothing usable; No usable name at all | `test/unit/discovery-machine.test.ts` | U |
| mac-discovery | Missing source; Failing source; Reason without program output; Homebrew outside PATH; No sandbox; Formula with a dependency; Formula from a tap; Cask with an app; Unreadable Homebrew output; Formula with a numeric version; App Store list; Line in another shape; App in a subfolder; Linked app; App Store receipt; App without identifier; App in the home folder; Agent of the user; Unreadable daemon; Arguments are not recorded; Tool with an alias link; npm reports a problem but lists packages; pipx package; Broken pipx metadata; Plist reader that hangs; Card number in a title; Private key in a version; Same package in two pipx folders; Two App Store lines for one app | `test/unit/discovery-sources.test.ts` | U |
| mac-discovery | Snapshot shape; Consistent counts; Secret in the user name; Same state twice | `test/unit/discovery-snapshot.test.ts` | U |
| mac-discovery | Write denied; Network denied; Program that hangs; Caller environment not passed; Writes only the snapshot | `test/integration/discover-sandbox.test.ts` | I (macOS) |
| mac-discovery | Fictitious user in the repository | `test/integration/docs.test.ts` | I |
| discover-command | Snapshot written; Skipped source still succeeds; Unexpected folder; Discover help; Not macOS; Sandbox missing; First run; Two runs at once; Linked snapshot folder; Folder writable by others; Folder readable by others; Folder not writable; Program output kept out | `test/integration/discover.test.ts` | I |
| discover-command | Folder replaced before the temporary file; Folder replaced before the rename (swaps injected through `FsOps`); Snapshot too large | `test/unit/discovery-write.test.ts` | U |
| drift-command | Name is not enough; Bundle identifier in another case; Python package spelling; Undeclared cask; Formula installed as a dependency; Apple app; Missing app; Source skipped; Missing from an incomplete source; Two components for one item; Job inside an app; Job of a formula; Job of a tap formula; Two formulae with one short name; Prefix that only looks alike; Formula dependency proposed; Relation already declared; App installed by a cask; App installed by a shared cask; Label with a comma; Dependency that cannot be annotated; Names in mixed case | `test/unit/drift.test.ts` | U |
| drift-command | Explicit snapshot; Default snapshot; Drift read-only; Unknown drift format; No catalogue folder; No snapshot yet; Snapshot in another format; Inconsistent snapshot; Secret in a snapshot; Default snapshot on Linux; Catalogue error; Nothing differs; Control characters removed; JSON lists; C1 character in JSON; Same input twice; Drift closed pipe | `test/integration/drift.test.ts` | I |
| drift-command | Large drift | `test/perf/drift.perf.test.ts` | P |
| drift-command | Scaffold of a cask; Title of control characters only; Card number built by removing controls; Cask and its app in one file; One app in two places; Two casks install one app; Scaffold relation; Name already in the catalogue; Title that looks like YAML | `test/unit/scaffold.test.ts` | U |
| drift-command | Scaffold written; Scaffold folder exists; Scaffold inside the catalogue; Scaffold passes validate; Scaffold write fails; Scaffold folder created meanwhile (both through an injected `FsOps`) | `test/integration/drift.test.ts` | I |
| mcp-server | Global help lists both commands | `test/integration/cli.test.ts` | I |
| mcp-server | No folder; Unknown view; Missing folder; Help (unchanged, tests already exist) | `test/integration/mcp.test.ts` | I |

`Default snapshot`, `Not macOS` and `Default snapshot on Linux` run through the test entry script with a fake host, so they run on every platform; `Not macOS` and `Default snapshot on Linux` also run against the real CLI on the Linux CI jobs.

## 1. Spike and annotations

- [x] 1.1 `docs/spikes/2026-10-21-mac-discovery/README.md`: what each source returned, timings and the sandbox results, with no real names, paths or counts from the spike machine. Check: `test/integration/docs.test.ts` (Fictitious user in the repository) passes.
- [x] 1.2 `src/discovery/annotations.ts` (keys, list parsing, identifier comparison) and the validate stage of D8; `fieldName` in `src/source.ts` writes U+0000–U+001F and U+007F–U+009F as `\u` escapes inside bracketed keys; `test/unit/annotations.test.ts` and the hostile-key test in `test/integration/cli.test.ts`. Check: `npm test`, existing field-path tests unchanged.

## 2. Runner and machine name

- [x] 2.1 `src/discovery/run.ts`: program lookup, the sandbox profile, time and output limits, fixed environment, fixed reasons; `src/discovery/host.ts` (the `Host` of D7). Check: `test/integration/discover-sandbox.test.ts` on macOS; the runner parts of `test/unit/discovery-sources.test.ts`.
- [x] 2.2 `src/discovery/machine.ts` (fold and fall-backs); `test/unit/discovery-machine.test.ts`.

## 3. Sources

- [x] 3.1 `src/discovery/sources/brew.ts` (formulae and casks from one run), `mas.ts`, `apps.ts`, `launchd.ts`, `mise.ts`, `npm.ts`, `pipx.ts`, with Northwind fixtures in `test/fixtures/discovery/`; `test/unit/discovery-sources.test.ts`. Check: `npm test`.

## 4. Snapshot and `discover`

- [x] 4.1 `src/discovery/snapshot.ts` (schema of D3, consistency checks, sorting, serialiser with C1 escapes, the secret guard through one value check exported from `src/secrets.ts`) and `src/discovery/index.ts` (`discover(host)`); `test/unit/discovery-snapshot.test.ts`. Check: `npm test`, with `test/unit/secrets.test.ts` unchanged and green.
- [x] 4.2 `src/discovery/write.ts` (D4, with `FsOps`) and `src/discover-command.ts`; `test/unit/discovery-write.test.ts`; `src/cli.ts` usage and dispatch; `test/integration/discover-entry.mjs` and `test/integration/discover.test.ts`; the global help test in `test/integration/cli.test.ts`.
- [x] 4.3 `.github/workflows/test.yml`: a `macos-latest` job (Node 22) that builds and runs the discovery tests. Check: CI green on the pull request.

## 5. `drift`

- [ ] 5.1 `src/drift.ts` (`buildDrift`: matching, not declared with the left-out counts, missing, not checked, shared, inferred needs, proposed relations, cask app suggestions); `test/unit/drift.test.ts`.
- [ ] 5.2 `src/drift-command.ts` (arguments, snapshot reading and its limits, text and JSON, stdout writer); `test/integration/drift.test.ts`; `test/perf/drift.perf.test.ts`. Check: `npm test` and `npm run test:perf`.
- [ ] 5.3 `src/scaffold.ts` (D10: grouping, names, `dependsOn`, YAML text) and the `--scaffold` option of `src/drift-command.ts` (folder checks, temporary folder and rename); `test/unit/scaffold.test.ts` and the scaffold tests in `test/integration/drift.test.ts`. Check: `npm test`.

## 6. Example, documentation and a real run

- [ ] 6.1 `examples/northwind-machine/snapshot.json` (fictitious, user `username`) and discovery annotations on the Northwind components, so `stackledger drift examples/northwind --snapshot examples/northwind-machine/snapshot.json` shows every section. Check: `Explicit snapshot`.
- [ ] 6.2 `docs/discovery.md` (the flow from `discover` to a reviewed pull request on the catalogue, sources, exact commands and files read, sandbox, snapshot and drift JSON shapes, machine-name rule, `--scaffold`, a weekly launchd example, exit codes), `docs/catalogue-format.md` (annotations), README Usage rows, AGENTS.md, `skills/stackledger/SKILL.md`. Check: `npm test` (docs tests), `npm audit` reports 0.
- [ ] 6.3 One manual run on the owner's Mac, outside the repository: a scratch copy under `~/.hermes/cache/scratch/` runs `discover` through the entry script with the real sources and the snapshot folder inside the scratch copy, then `drift` against a scratch copy of the owner's catalogue; findings go to the pull request in words, not data; the scratch copy is deleted. Check: the scratch folder no longer exists.
