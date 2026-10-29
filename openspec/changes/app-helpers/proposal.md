## Why

Apps can start programs at login or in the background without any file in `~/Library/LaunchAgents`, `/Library/LaunchAgents` or `/Library/LaunchDaemons`: since macOS 13 they register helpers kept inside their own bundle (Service Management). On the owner's Mac, Vorssaint (a root daemon), DisplayLink Manager, 1Password and OrbStack appear in System Settings > Login Items & Extensions but not in `stackledger discover`, so the catalogue cannot say what they run (AB#222). The list macOS keeps of what is enabled cannot be read without `sudo` or a permission prompt, but the helpers each app declares inside its bundle can.

## What Changes

- **The `launchd` source also reads the helpers apps declare.** For each `.app` the `app` source looks at, it reads the `.plist` files directly inside `Contents/Library/LaunchAgents` (scope `app-agent`) and `Contents/Library/LaunchDaemons` (scope `app-daemon`), and the `.app` bundles directly inside `Contents/Library/LoginItems` (scope `app-login-item`).
- **A helper's program** is `Program`, else `BundleProgram` resolved inside the app (what launchd runs), else `ProgramArguments.0`. A login item's id is its `CFBundleIdentifier`, and its program is its `Contents/MacOS/<CFBundleExecutable>`.
- **What it means:** a helper item says what an app *can* run in the background, not whether it is enabled. The docs say so.
- **`drift` suggests the app's components.** A not-declared helper suggests the components that match the app holding it ("probably belongs to"), or, when none does, what the app's own entry suggests (its cask's components). A helper matches only through an explicit `stackledger/launchd` annotation.
- **`--scaffold` keeps a helper with its app.** A helper of an undeclared app goes into that app's draft file, so the annotation lands on the app's component.
- **Snapshot:** three new `scope` values. The format stays `stackledger-snapshot/v1`; `drift` 0.6.0 rejects a snapshot with them, as it already rejects one with `script`.

Out of scope:

- whether a helper is enabled or loaded (needs `sudo sfltool dumpbtm`, the root-only Background Task Management database, or `launchctl` outside the sandbox);
- apps in the classic "Open at Login" list that have no helper: they can only be read through System Events, which asks for permission, and the weekly scan cannot answer a prompt. Documented as a limit;
- helpers of apps outside `/Applications` and `~/Applications`, and system extensions, kernel extensions and privileged helpers in `/Library/PrivilegedHelperTools`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mac-discovery`: "App helpers", "App helper programs" and "App helpers not followed" added; "launchd privacy" modified (the keys a helper may have read).
- `drift-command`: "Helpers suggest their app's components" and "Scaffold of app helpers" added.

## Implicit requirements

- Errors and invalid input: a helper plist without `Label`, a login item without `CFBundleIdentifier`, an entry that cannot be read or examined, and every Applications-level entry the `app` walk ignores are counted as `launchd` ignored (so `drift` marks a missing helper `incomplete`); a `BundleProgram` that is absolute or has a `..` part, or a `CFBundleExecutable` with a `/`, gives `program` null (scenarios in "App helpers", "App helper programs").
- Limits: the existing per-program limits apply to each `plutil` run; at most three folders more are listed per app.
- Repetition and idempotency: deterministic; items sorted as today (source, `id`, `path`).
- Concurrency: n/a, the extra runs join the existing `plutil` pool.
- Security: only the keys "launchd privacy" names are read, so no argument or environment of a helper reaches the snapshot; links are not followed, inside a login item too (scenarios "Linked helper folder", "Linked Info.plist of a login item"); the secret guard applies as to every item.
- Logs and observability: n/a, discovery prints only per-source counts.

## Impact

`src/discovery/sources/launchd.ts` (and the app-folder listing it shares with `src/discovery/sources/apps.ts`), `src/discovery/types.ts` and `src/discovery/snapshot.ts` (scope values), `src/drift.ts` (suggestions), `src/scaffold.ts` (grouping), tests in `test/unit` and `test/integration` with fictitious apps, `test/fixtures/discovery/machine.json`, `examples/northwind-machine/snapshot.json`.

After the merge, outside this change: a release with this change and `launchd-script`, then the owner's catalogue moves to it and annotates its helpers.

## Documentation

- `docs/discovery.md`: the launchd source row, scopes, what a helper item means (can run, not enabled), the "Open at Login" limit, the privacy paragraph (`BundleProgram`, the two login item keys, links inside bundles not followed), the "what is recorded" list, the suggestion in drift, the scaffold grouping, and 0.6.0 rejecting the scopes.
- `skills/stackledger/SKILL.md`: a helper's suggestion means the annotation goes on the app's component.
- Vault `10-personal/projects/stackledger/`: changelog, roadmap and architecture, after the merge.
- No ADR: the design choices are in design.md.
