# Design: mac-discovery

## Context

Delivered: the catalogue and its views (`src/validate.ts`, `src/views.ts`), `map`, `mcp`, `build` and `report`. Component annotations are already accepted as free string mappings and survive both views. The owner's decisions of 2026-10-21 are in the proposal. The spike of 2026-10-21 (`docs/spikes/2026-10-21-mac-discovery/README.md`) measured each source on a real Mac; its raw output stayed in a scratch folder and was deleted.

What the spike found:

- `brew info --json=v2 --installed` takes about 1.5 s and gives, per formula, the full name, installed versions, `installed_on_request` and `runtime_dependencies` with `declared_directly`; per cask, the full token, the version and the `.app` artifacts. With `HOMEBREW_NO_AUTO_UPDATE=1` it reads its cached API files and needs no network: it gives the same bytes inside a sandbox that denies network and writes.
- `npm ls --global --depth=0 --json` works inside that sandbox. Outside it, every npm run writes a debug log under `~/.npm/_logs`, and `--logs-max=0` *deletes* existing logs. The sandbox is what keeps npm read-only.
- `pipx list --json` writes a log on every run and crashes when writes are denied; `pipx_metadata.json` in each venv has the same data.
- `launchctl list` fails inside the sandbox; the launchd plist files are readable without it (two root-only daemons were not, which is expected).
- `plutil -convert json -o - <Info.plist>` converted every app bundle tested; about 1 s for 60 apps, each in its own sandboxed run. Apple's own apps such as Safari are symbolic links into the system cryptex.
- `scutil --get ComputerName` gives names like `username - MacBook Air`; `LocalHostName` gives `username---MacBook-Air`.
- `mas` and `mise` were not installed on the spike machine, so their formats come from their documentation and are covered by fixtures; they are the first to check on a machine that has them.

## Goals / Non-goals

Goals: an enforced read-only discovery; a snapshot that is stable and private; a drift that never guesses.

Non-goals: editing the catalogue, several machines, versions drift, any view of discovery in the site or MCP.

## Decisions

### D1. Sandbox every program

`src/discovery/run.ts` runs each program as `/usr/bin/sandbox-exec -p <profile> <program> <args…>` with `execFile` (no shell), a 60 s timeout, a 64 MiB stdout cap and a fixed environment:

```
(version 1)
(allow default)
(deny network*)
(deny file-write* (require-not (literal "/dev/null")))
```

The environment is `PATH`, `HOME`, `USER` and `TMPDIR` from the caller, plus `HOMEBREW_NO_AUTO_UPDATE=1`, `HOMEBREW_NO_ANALYTICS=1`, `HOMEBREW_NO_ENV_HINTS=1`, `HOMEBREW_NO_INSTALL_CLEANUP=1`, `npm_config_update_notifier=false`, `NO_COLOR=1` and `LC_ALL=C`. stderr is read (capped) and dropped: no program text reaches the snapshot reason or the terminal.

Alternatives: run programs plainly and trust them (npm and pipx proved they write); read every source from files only (Homebrew's Cellar and Caskroom layout is internal and changes more often than `brew info` JSON). `sandbox-exec` is marked deprecated by Apple but ships with every macOS release, and the profile language used here is the small stable subset. If it disappears, discovery refuses to run (owner question 5) instead of silently losing the guarantee.

### D2. Files read by Node itself

`app` and `launchd` list folders with `readdir`/`lstat` (never following links) and pass each plist path to sandboxed `plutil -convert json -o - <file>`. When that conversion fails (a plist holding a date or data value cannot become JSON), the source falls back to `plutil -extract <key> raw -o - <file>` for each key it needs. `mise` and `pipx` read their folders and `pipx_metadata.json` with Node only, without running their programs. Node only reads: the one writer is `src/discovery/write.ts`.

### D3. Snapshot model

`src/discovery/snapshot.ts` holds the zod schema of `stackledger-snapshot/v1` (used to parse in `drift`, and by tests on what `discover` writes) and the sort rules. Item fields by source:

| Source | Fields besides `source`, `id`, `versions` |
| --- | --- |
| `brew` | `onRequest`, `dependsOn` |
| `cask` | `apps` |
| `mas` | `title` |
| `app` | `title`, `path`, `appStore` |
| `launchd` | `scope`, `path`, `program` (or none) |
| `mise`, `npm`, `pipx` | none |

`takenAt` is `new Date().toISOString()` cut to seconds. `machine.user` is `os.userInfo().username`; `machine.macos` comes from sandboxed `sw_vers -productVersion` (an unreadable version is `null`, not a failure).

### D4. Writing the file

`src/discovery/write.ts`: `lstat` `~/.stackledger` and the machine folder; create missing ones with `mkdir(…, { mode: 0o700 })` (one level at a time, so a link created between checks is caught by the next `lstat`); refuse links and non-folders; refuse an existing `snapshot.json` that is not a regular file. Write `snapshot.<pid>.<random>.tmp` with flags `wx` and mode `0600`, `fsync`, then `rename` over `snapshot.json`; remove the temporary file on any failure. Concurrent runs each rename a complete file: the last one wins.

### D5. Machine name

`src/discovery/machine.ts`: `fold(text)` implements the spec rule; `machineName(run)` tries `ComputerName`, then `LocalHostName`, then `mac`. Used by `discover` and by `drift`'s default snapshot path.

### D6. Drift

`src/drift.ts` exports `buildDrift(snapshot, components): Drift`, a pure function; `src/drift-command.ts` does arguments, files and output like `src/report-command.ts` (counts line on stderr, whole output built in memory, the same stdout writer with the EPIPE guard). Annotation parsing (`src/discovery/annotations.ts`) is shared with `validate`, so the catalogue warnings and the matcher read identifiers the same way. Matching uses a map from `source + normalised id` to components: linear in items plus identifiers.

Inferred needs (spec) are computed on the snapshot, then lifted to components. A launchd program path is compared with an app path plus `/`, so `Northwind Sync Helper.app` never matches `Northwind Sync.app`.

### D7. Tests without a real Mac

Each source module takes a small `Host` (`run`, `readdir`, `lstat`, `readFile`, `env`, `home`, `platform`, the source roots and the snapshot root, which the CLI sets to `~/.stackledger`), so unit tests feed fictitious Northwind outputs from `test/fixtures/discovery/`. A test entry script (`test/integration/discover-entry.mjs`, like `build-with-faults.mjs`) runs `discoverCommand` with a host built from a JSON file in a temporary folder: fake programs on a temporary `PATH`, fake `/Applications` and launchd roots, a temporary `HOME`. The sandbox scenarios (write and network denied, the Node permission model run) need macOS: they run when `process.platform === 'darwin'`, and a new `macos-latest` job in `.github/workflows/test.yml` runs them in CI. Tests against Bruno's real Mac are never committed; they run once by hand in a scratch copy and are deleted.

### D8. Validate

`validateLoaded` gains one stage after the secret scan for served components: unknown `stackledger/` annotation keys, empty identifiers and identifiers claimed twice, all warnings. The `stackledger/zone` key is a label, not an annotation, so it is unaffected.

## Risks / Trade-offs

- `sandbox-exec` is deprecated → it has been deprecated since 2016 and still ships; failing closed keeps the promise, and docs say so.
- `brew info` with no cached API files and no network → Homebrew fails inside the sandbox; the source is `failed` with `exited with code <n>`, and docs say to run any `brew` command once online.
- `mas` output may change between releases → strict line parsing with an ignored count, fixture tests; first real check on a Mac that has `mas`.
- The snapshot holds the user name and paths → it lives outside the catalogue repository with mode `0600`; public fixtures use `username`, enforced by a test.
- Many brew dependencies would bury the useful lines → dependencies and macOS items are counted, not listed (owner question 4).

## Open questions

Each has a recommendation; gate 1 answers them.

1. **Snapshot folder.** Recommend `~/.stackledger/<machine>/`, as already decided. `discover` needs no catalogue, so it can run on any Mac without one; a file next to the catalogue but outside Git relies on `.gitignore` to keep real inventory and the user name out of a repository, and one mistake publishes it.
2. **Machine name.** Recommend the folded `ComputerName` (`username-macbook-air`), with `LocalHostName` and then `mac` as fall-backs. `LocalHostName` keeps case and runs of hyphens (`username---MacBook-Air`) and is less readable.
3. **Several identifiers per annotation.** Recommend a comma-separated list (`stackledger/launchd: com.northwind.sync, com.northwind.helper`). The old registry already lists several app names or labels on one entry; a component per job would be noise.
4. **What `drift` leaves out of "not declared".** Recommend counting, not listing, formulae installed only as dependencies and macOS's own items (`com.apple.*` apps without an App Store receipt, `com.apple.*` launchd labels). Both still match when annotated. Without this, about four in five Homebrew lines on the spike machine would be dependencies.
5. **No sandbox.** Recommend failing closed: `discover` exits 1 and runs nothing.
6. **Homebrew through `brew info`.** Recommend `brew info --json=v2 --installed` in the sandbox over reading `Cellar` and `Caskroom` directly: it is Homebrew's documented interface, it is a listing command, and the spike showed it works offline.
