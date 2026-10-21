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

`app` and `launchd` list folders with `readdir`/`lstat` (never following links).

- `app` passes each `Info.plist` to sandboxed `plutil -convert json -o - <file>`. When that conversion fails (a plist holding a date or data value cannot become JSON), it falls back to `plutil -extract <key> raw -o - <file>` for each of its four keys. An app's `Info.plist` holds no user secrets, so converting it whole is fine.
- `launchd` never converts a file whole: it runs `plutil -extract Label raw`, `plutil -extract Program raw` and, when `Program` is absent, `plutil -extract ProgramArguments.0 raw`. Before that, Node opens the file for reading to tell an unreadable file (ignored) from a missing key (`plutil` exit 1 on a readable file: the key is absent).
- `mise` and `pipx` read their folders and `pipx_metadata.json` with Node only, without running their programs.

Node only reads: the one writer is `src/discovery/write.ts`. Per-file `plutil` runs go through a pool of 8 at a time, and results are sorted afterwards, so concurrency never changes the snapshot.

### D3. Snapshot model

`src/discovery/snapshot.ts` holds the zod schema of `stackledger-snapshot/v1` (strict objects: an unknown field is a shape error), the consistency checks, the sort rules and the serialiser. `drift` parses with it; tests check what `discover` writes against it. The secret guard reuses the value rules of `src/secrets.ts` (private-key block, Luhn card number), moved into one exported function that both call.

```json
{
  "format": "stackledger-snapshot/v1",
  "takenAt": "2026-10-21T07:30:00Z",
  "machine": { "name": "username-macbook-air", "user": "username", "macos": "27.2" },
  "sources": [
    { "source": "brew", "status": "ok", "reason": null, "items": 2, "ignored": 0 },
    { "source": "mas", "status": "skipped", "reason": "not found", "items": 0, "ignored": 0 }
  ],
  "items": [
    { "source": "brew", "id": "forge", "versions": ["2.1.0"], "onRequest": true, "dependsOn": ["libnorth"] },
    { "source": "cask", "id": "northwind-editor", "versions": ["5.0.1"], "apps": ["Northwind Editor.app"] },
    { "source": "mas", "id": "1234567890", "versions": ["4.2"], "title": "Northwind Notes" },
    { "source": "app", "id": "com.northwind.editor", "versions": ["5.0.1"], "title": "Northwind Editor", "path": "/Applications/Northwind Editor.app", "appStore": false },
    { "source": "launchd", "id": "com.northwind.sync", "versions": [], "scope": "user-agent", "path": "/Users/username/Library/LaunchAgents/com.northwind.sync.plist", "program": "/Applications/Northwind Sync.app/Contents/MacOS/sync" },
    { "source": "mise", "id": "node", "versions": ["22.12.0", "24.1.0"] },
    { "source": "npm", "id": "northwind-cli", "versions": ["3.0.0"] },
    { "source": "pipx", "id": "northwind-docs", "versions": ["1.6.0"] }
  ]
}
```

(`sources` always has all eight entries, in source order; two are shown.) Types: `takenAt` matches `YYYY-MM-DDTHH:MM:SSZ`; `machine.name` matches the fold rule's output; `machine.user` is a non-empty string; `machine.macos` is a string or `null`; `status` is `ok`, `skipped` or `failed`; `reason` is one of the fixed texts or `null`; `items` and `ignored` are non-negative integers; every `id`, version, title, path, app name and dependency is a non-empty string; `versions` may be empty (always for `launchd`; for an app without `CFBundleShortVersionString`); `program` is a string or `null`; `scope` is `user-agent`, `agent` or `daemon`. Each source has exactly the fields shown for it.

`takenAt` is `new Date().toISOString()` cut to seconds. `machine.user` is `os.userInfo().username`; `machine.macos` comes from sandboxed `sw_vers -productVersion` (an unreadable version is `null`, not a failure). The serialiser is `JSON.stringify(snapshot, null, 2)` with U+007F–U+009F replaced by `\u` escapes, plus a final line feed.

### D4. Writing the file

`src/discovery/write.ts`, through a small `FsOps` (as `src/site/fs-ops.ts` does, so tests can inject a swap between steps):

0. Serialise the snapshot first; over 32 MiB is a write failure before any file system call.
1. `stat` the home folder: refuse it when its mode has `0o022`. `lstat` `~/.stackledger`, then the machine folder; create a missing one with `mkdir(…, { mode: 0o700 })`, one level at a time, and `lstat` it again. Refuse a link, a non-folder, a folder whose `uid` is not the current user's, or one with any of the mode bits `0o077`. Remember each folder's `dev` and `ino`. Refuse an existing `snapshot.json` that is not a regular file.
2. Open `snapshot.<pid>.<random>.tmp` in the machine folder with `wx`, `O_NOFOLLOW` and mode `0600`, then repeat the folder check (each folder still a non-link folder with the same `dev`/`ino`). On a mismatch, remove the temporary file by its path (the link the swap put there still leads to where it was created), close it and exit 1, before any snapshot byte is written.
3. Write, `fsync`, close, repeat the folder check, `rename` over `snapshot.json`. On a mismatch, remove the temporary file by its path when `lstat` of that path shows the same `ino` as the file written (in a folder moved away the file stays, and nothing else is removed), and exit 1. Remove the temporary file on any other failure too.

Threat model: the write boundary holds against other users, because the home folder is not writable by them and both snapshot folders are the user's own with no permission for anyone else, so no other user can create, rename or replace anything on the path. Against the user's own processes the checks only detect a swap: a swap between the last check and `rename` still writes where the swap points, and such a process already has every right the user has. Node has no `openat`/`renameat`, which would close that window. Concurrent runs each rename a complete file: the last one wins.

### D5. Machine name

`src/discovery/machine.ts`: `fold(text)` implements the spec rule; `machineName(run)` tries `ComputerName`, then `LocalHostName`, then `mac`. Used by `discover` and by `drift`'s default snapshot path.

### D6. Drift

`src/drift.ts` exports `buildDrift(snapshot, components): Drift`, a pure function; `src/drift-command.ts` does arguments, files and output like `src/report-command.ts` (counts line on stderr, whole output built in memory, the same stdout writer with the EPIPE guard). Annotation parsing (`src/discovery/annotations.ts`) is shared with `validate`, so the catalogue warnings and the matcher read identifiers the same way. Matching uses a map from `source + normalised id` to components: linear in items plus identifiers.

Inferred needs (spec) are computed on the snapshot, then lifted to components. A launchd program path is compared with an app path plus `/`, so `Northwind Sync Helper.app` never matches `Northwind Sync.app`.

### D7. Tests without a real Mac

Each source module takes a small `Host` (`run`, `readdir`, `lstat`, `readFile`, `env`, `home`, `platform`, the source roots and the snapshot root, which the CLI sets to `~/.stackledger`), so unit tests feed fictitious Northwind outputs from `test/fixtures/discovery/`. A test entry script (`test/integration/discover-entry.mjs`, like `build-with-faults.mjs`) runs `discoverCommand` with a host built from a JSON file in a temporary folder: fake programs on a temporary `PATH`, fake `/Applications` and launchd roots, a temporary `HOME`. The sandbox scenarios (write and network denied, the Node permission model run) need macOS: they run when `process.platform === 'darwin'`, and a new `macos-latest` job in `.github/workflows/test.yml` runs them in CI. Tests against Bruno's real Mac are never committed; they run once by hand in a scratch copy and are deleted.

### D8. Validate

`validateLoaded` gains one stage after the secret scan for served components: unknown `stackledger/` annotation keys, empty identifiers and identifiers claimed twice, all warnings. The `stackledger/zone` key is a label, not an annotation, so it is unaffected.

### D9. Drift output

An item is named in drift output by `{ "source", "id", "path" }`, where `path` is the item's path or `null` for sources without one. JSON shape (stable within v1):

```json
{
  "snapshot": { "machine": { "name": "username-macbook-air", "user": "username", "macos": "27.2" }, "takenAt": "2026-10-21T07:30:00Z" },
  "counts": { "items": 40, "matched": 30, "notDeclared": 4, "dependencies": 5, "macos": 1, "missing": 2, "notChecked": 1, "shared": 1, "proposedRelations": 2, "componentsWithoutAnnotations": 3 },
  "notDeclared": [{ "source": "cask", "id": "northwind-editor", "path": null, "versions": ["5.0.1"], "title": null, "annotation": "stackledger/cask: northwind-editor", "note": null, "suggestedComponents": [] }],
  "missing": [{ "component": "component:legacy", "source": "app", "id": "com.northwind.legacy", "incomplete": false }],
  "notChecked": [{ "component": "component:notes", "source": "mas", "id": "1234567890", "status": "skipped" }],
  "shared": [{ "source": "cask", "id": "northwind-editor", "path": null, "components": ["component:editor", "component:editor-beta"] }],
  "matched": [{ "source": "brew", "id": "forge", "path": null, "components": ["component:forge"] }],
  "proposedRelations": [{ "from": "component:forge", "to": "component:libnorth", "reasons": [{ "from": { "source": "brew", "id": "forge", "path": null }, "to": { "source": "brew", "id": "libnorth", "path": null } }] }]
}
```

- `counts.items` is every snapshot item; `matched` counts items matched by at least one component (shared ones once); `dependencies` and `macos` count the items left out of `notDeclared`; `componentsWithoutAnnotations` counts served components with no `stackledger/` discovery annotation.
- `missing` and `notChecked` hold the identifier as the component wrote it (trimmed); `component` is `component:<name>` with the name as the catalogue writes it, as the graph's `ref` prints it elsewhere, and references sort with `compareRefs` from `src/identity.ts`.
- `title` is the item's `title` or `null`; `annotation` is `null` and `note` is `cannot be annotated` for an identifier no annotation can hold, otherwise `note` is `null`; `suggestedComponents` lists references (possibly none).
- `shared` items are also in `matched`.
- Text output shows the same lists with one line per entry, for example `cask  northwind-editor 5.0.1  -> stackledger/cask: northwind-editor`, `missing  component:legacy  app com.northwind.legacy (incomplete source)` and `propose  component:forge dependsOn component:libnorth  (brew forge needs brew libnorth)`.

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
