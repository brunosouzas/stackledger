## Context

`launchd` (spec `mac-discovery`, "launchd jobs") reads the three job folders. Since macOS 13 an app can register a login item or a launch agent or daemon kept inside its own bundle (`SMAppService`); the plist stays in `Contents/Library/LaunchAgents` or `LaunchDaemons`, or the helper app in `Contents/Library/LoginItems`, and uses `BundleProgram`, a path relative to the bundle. What macOS enabled lives in `/private/var/db/com.apple.backgroundtaskmanagement`, which the user cannot read (`Operation not permitted`), and `launchctl` fails inside the sandbox. On the owner's Mac the bundles hold 6 helpers in 4 apps.

## Goals / Non-Goals

Goals: list every helper an app in the Applications folders declares, with what it runs, in the same `launchd` source, so the catalogue can name it.

Non-goals: enabled or loaded state, the classic "Open at Login" list, apps elsewhere, system and kernel extensions, `/Library/PrivilegedHelperTools`.

## Decisions

- **D1. Declared, not enabled.** Discovery reads what each bundle declares. It cannot tell whether the user turned a helper off; a helper turned off still shows. Alternatives rejected (approved by the owner): `sudo sfltool dumpbtm` (a password in a weekly job), `launchctl print` outside the sandbox (breaks "every program in the sandbox"), System Events (a permission prompt).
- **D2. In the `launchd` source, three new scopes.** `app-agent`, `app-daemon`, `app-login-item`. Annotations stay `stackledger/launchd: <id>`, and the snapshot keeps eight sources, so the format stays `stackledger-snapshot/v1`. As with `script`, `drift` 0.6.0 rejects a snapshot holding the new scopes (strict enum); the docs say so. Alternative rejected: a ninth source, which changes the format for every reader.
- **D3. The same apps the `app` source sees.** The `.app` list comes from the folder walk `app` uses (top level and one subfolder level, links not followed), shared, not copied. Every entry that walk ignores (a linked or unreadable Applications folder, a linked or unlistable subfolder, a linked or unexaminable `.app`) also counts once in `launchd`'s `ignored`, because `drift` marks a missing identifier `incomplete` from its own source's count only. An unreadable Applications folder does not fail `launchd`: the job folders are still read.
- **D4. `BundleProgram` before `ProgramArguments.0`, and inside the bundle.** For an `SMAppService` plist launchd runs `BundleProgram` and passes `ProgramArguments` only as arguments, so `ProgramArguments.0` (often a bare name) would hide the executable. `BundleProgram` is joined to the app path only when it is relative with no `..` part, so a plist cannot make the snapshot claim a program outside the app. A login item whose `Contents` or `Info.plist` is a link is never read, as `app` does for its own bundles. A login item's program is `Contents/MacOS/<CFBundleExecutable>`, the same rule macOS uses to start it, with no `/` allowed.
- **D5. Suggest, never match; draft with the app.** A helper's not-declared entry suggests the components of its app, else what its app's entry suggests (its cask's components), reusing `suggestedComponents`, so the text output already prints "probably belongs to". Matching stays annotation-only. In `--scaffold`, a helper of an undeclared app joins its app's file (as an app joins its cask's), so the owner's decision holds: the annotation goes on the app's component.

## Risks / Trade-offs

- The 6 helpers on the owner's Mac show as not declared until the catalogue is annotated; that is the point, and the suggestion says where.
- An app that declares a helper it never registers still shows; the description in the catalogue explains it.
- Up to three more folder listings per app and a few `plutil` runs per helper; with about 30 apps this is well under the drift performance budget.
