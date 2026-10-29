## 1. Discovery

- [x] 1.1 Share the `.app` walk of `src/discovery/sources/apps.ts` (top level and one subfolder level, links not followed) so `launchd` gets the same app paths and the same ignored entries. Check: the existing `app` tests pass unchanged ("Applications found", "Applications not followed"), and "Unreadable Applications folder fails the app source" pins that `app` still fails on an unlistable root.
- [x] 1.2 In `src/discovery/sources/launchd.ts`, for each app, read `Contents/Library/LaunchAgents` and `LaunchDaemons` plists as jobs (scopes `app-agent`, `app-daemon`; program `Program`, then `BundleProgram`, then `ProgramArguments.0`), and `Contents/Library/LoginItems/*.app` (scope `app-login-item`, `CFBundleIdentifier`, `CFBundleExecutable`); add the three scopes to `src/discovery/types.ts` and the snapshot schema. Check: `test/unit/discovery-sources.test.ts` with the virtual host for "Agent inside an app", "Daemon inside an app", "Login item", "Login item without identifier", "Helper of an app in a subfolder", "Apps without job folders", "Program inside the bundle", "Bundle program before the arguments", "Bundle program that leaves the bundle", "Bundle program that hits a limit", "Login item program", "Executable name with a slash"; `test/unit/discovery-snapshot.test.ts` for "Snapshot with helper scopes".
- [x] 1.3 Links and unreadable entries. Check: `test/unit/discovery-sources.test.ts` for "Linked helper folder", "Linked app", "Unreadable helper folder", "Unreadable Applications folder", "Linked Applications folder", "Linked Info.plist of a login item".
- [x] 1.4 Privacy. Check: same file, "Helper arguments are not recorded" and "Keys of a login item" (every `plutil` run matched against the allowed keys); the restated "launchd privacy" scenarios keep their existing tests ("Arguments are not recorded", "Later arguments of an interpreter job", "Token as first argument", "Token that looks like a path").

## 2. Drift

- [x] 2.1 In `src/drift.ts`, a not-declared launchd item with an `app-*` scope gets as `suggestedComponents` the components matching the app whose path plus `/` starts its path, else that app's own suggestions. Check: `test/unit/drift.test.ts` for "Helper of a declared app", "Helper of an undeclared app", "Helper of an app a cask installs", "App path that only looks alike", "Job outside an app".
- [x] 2.2 In `src/scaffold.ts`, a helper of an undeclared app joins the file holding that app's annotation. Check: `test/unit/scaffold.test.ts` for "App and its helper in one file" (helper program inside the app, no self `dependsOn`), "Helper of an app with a suggestion" and "Old agent with the helper's label", plus "Old agent sorting before the helper of an undeclared app".

## 3. Example, fixtures and docs

- [x] 3.1 Add fictitious helpers to `test/fixtures/discovery/machine.json` only where a test needs them (the counts of existing tests stay), and one helper of a declared app to `examples/northwind-machine/snapshot.json`. Check: `test/integration/drift.test.ts` sees `(probably belongs to component:` for the helper, and the drift text in `docs/discovery.md` equals `node dist/cli.js drift examples/northwind --snapshot examples/northwind-machine/snapshot.json`.
- [x] 3.2 Update `docs/discovery.md` (launchd row and scopes, declared not enabled, the "Open at Login" limit, the privacy paragraph with `BundleProgram`, the login item keys and the links inside bundles, the "what is recorded" list, the drift suggestion, the scaffold grouping, 0.6.0 rejecting the scopes) and `skills/stackledger/SKILL.md`. Check: the docs tests pass (`/Users/username` paths only).

## 4. Close

- [x] 4.1 `npm run build`, then `npm test` in a separate command, and `openspec validate app-helpers --strict` pass; `discover` and `drift` on the owner's Mac list the 6 helpers with their suggestions.
