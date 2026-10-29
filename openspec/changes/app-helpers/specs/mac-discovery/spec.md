## ADDED Requirements

### Requirement: App helpers
`launchd` SHALL also look inside each `.app` the `app` source looks at ("Applications found"): at the `.plist` files directly inside `Contents/Library/LaunchAgents` (scope `app-agent`) and `Contents/Library/LaunchDaemons` (scope `app-daemon`), read as launchd jobs, and at the `.app` folders directly inside `Contents/Library/LoginItems` (scope `app-login-item`). A helper folder that does not exist adds nothing. The Applications folders count among the source's folders for `skipped`.

#### Scenario: Agent inside an app
- **WHEN** `/Applications/Northwind Display.app/Contents/Library/LaunchAgents/com.northwind.display.agent.plist` has `Label` `com.northwind.display.agent`
- **THEN** the item has `id` `com.northwind.display.agent`, scope `app-agent` and `path` that file

#### Scenario: Daemon inside an app
- **WHEN** `/Applications/Northwind Utils.app/Contents/Library/LaunchDaemons/com.northwind.utils.fan.plist` has `Label` `com.northwind.utils.fan`
- **THEN** the item has scope `app-daemon` and `path` that file

#### Scenario: Login item
- **WHEN** `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app/Contents/Info.plist` has `CFBundleIdentifier` `com.northwind.vault.launcher`
- **THEN** the item has `id` `com.northwind.vault.launcher`, scope `app-login-item` and `path` `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app`

#### Scenario: Login item without identifier
- **WHEN** a login item's `Info.plist` has no `CFBundleIdentifier`
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Helper of an app in a subfolder
- **WHEN** `/Applications/Northwind Suite/Northwind Sync.app/Contents/Library/LaunchAgents/com.northwind.suite.sync.plist` has a `Label`
- **THEN** that job is recorded with scope `app-agent`

#### Scenario: Snapshot with helper scopes
- **WHEN** a `stackledger-snapshot/v1` snapshot holds a `launchd` item with scope `app-login-item`
- **THEN** it passes the snapshot shape check, and one with scope `app-service` does not

#### Scenario: Apps without job folders
- **WHEN** none of the three job folders exists and `/Applications` holds an app with one helper
- **THEN** `launchd` is `ok` with that helper

### Requirement: App helper programs
A helper plist's `program` SHALL be `Program`, else, when it has `BundleProgram`, `<app path>/<BundleProgram>` if that value does not start with `/` and has no `..` part (null otherwise), else `ProgramArguments.0`, else null. A login item's `program` SHALL be `<login item path>/Contents/MacOS/<CFBundleExecutable>` when that value is not empty and has no `/`, else null; its `script` SHALL be null.

#### Scenario: Program inside the bundle
- **WHEN** the plist of `com.northwind.display.agent` in `/Applications/Northwind Display.app` has only `BundleProgram` `Contents/MacOS/DisplayAgent`
- **THEN** its `program` is `/Applications/Northwind Display.app/Contents/MacOS/DisplayAgent`

#### Scenario: Bundle program before the arguments
- **WHEN** a helper plist in `/Applications/Northwind Display.app` has `BundleProgram` `Contents/MacOS/agent` and `ProgramArguments` `["agent", "--quiet"]`
- **THEN** its `program` is `/Applications/Northwind Display.app/Contents/MacOS/agent`

#### Scenario: Bundle program that leaves the bundle
- **WHEN** a helper plist has `BundleProgram` `../../../../usr/local/bin/northwind` or `/usr/local/bin/northwind`, and `ProgramArguments` `["northwind"]`
- **THEN** its `program` is null (not `northwind`) and the item is recorded

#### Scenario: Login item program
- **WHEN** the login item `Northwind Launcher.app` has `CFBundleExecutable` `Northwind Launcher`
- **THEN** its `program` is `/Applications/Northwind Vault.app/Contents/Library/LoginItems/Northwind Launcher.app/Contents/MacOS/Northwind Launcher` and its `script` is null

#### Scenario: Executable name with a slash
- **WHEN** a login item's `CFBundleExecutable` is `../northwind`
- **THEN** its `program` is null and the item is recorded

### Requirement: App helpers not followed
Every entry the `app` walk counts as ignored ("Applications not followed"), a linked `.app` included, SHALL count once in `launchd`'s `ignored` and not be looked into. A linked `Contents`, `Contents/Library`, helper folder, helper plist or login item, a login item whose `Contents` or `Contents/Info.plist` is a link, a folder that cannot be listed and an entry that cannot be examined or read SHALL count once and not be read.

#### Scenario: Linked helper folder
- **WHEN** `/Applications/Northwind Display.app/Contents/Library/LaunchAgents` is a symbolic link to a folder holding a job file
- **THEN** that job is not recorded and `ignored` counts the link once

#### Scenario: Linked app
- **WHEN** `/Applications/Northwind Link.app` is a symbolic link to an app with a helper
- **THEN** `launchd` records no helper of it and `ignored` counts the link once

#### Scenario: Unreadable Applications folder
- **WHEN** `/Applications` exists but cannot be listed and `~/Library/LaunchAgents` holds a job
- **THEN** `launchd` is `ok` with that job and `ignored` counts `/Applications` once

#### Scenario: Linked Applications folder
- **WHEN** `~/Applications` is a symbolic link
- **THEN** `launchd` does not follow it and `ignored` counts it once

#### Scenario: Linked Info.plist of a login item
- **WHEN** a login item's `Contents/Info.plist` is a symbolic link to a file outside the bundle
- **THEN** that file is never read and the login item counts as ignored

#### Scenario: Unreadable helper folder
- **WHEN** an app's `Contents/Library/LaunchDaemons` cannot be listed
- **THEN** it counts as one ignored entry and the source is `ok`

## MODIFIED Requirements

### Requirement: launchd privacy
Discovery SHALL read only the keys `Label`, `Program`, `ProgramArguments.0` and, in a helper plist, `BundleProgram` of a launchd file, plus `ProgramArguments.1` once when `program` is an interpreter ("launchd script"), and only `CFBundleIdentifier` and `CFBundleExecutable` of a login item's `Info.plist`, one `plutil -extract <key> raw` run per key, so no other argument, environment variable or key is read or reaches the snapshot.

#### Scenario: Arguments are not recorded
- **WHEN** a job's `ProgramArguments` is `["/usr/local/bin/northwind-agent", "--token", "nw-example-value"]` and it has `EnvironmentVariables`
- **THEN** the snapshot contains neither `nw-example-value` nor any environment variable, and every `plutil` run on that file extracts `Label`, `Program` or `ProgramArguments.0`

#### Scenario: Later arguments of an interpreter job
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "/Users/username/northwind/agent.py", "--token", "nw-example-value"]` and that script file exists
- **THEN** `script` is `/Users/username/northwind/agent.py`, the snapshot does not contain `nw-example-value`, every `plutil` run on that file extracts `Label`, `Program`, `ProgramArguments.0` or `ProgramArguments.1`, and `ProgramArguments.1` is extracted once

#### Scenario: Token as first argument
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "nw-example-value"]`
- **THEN** `script` is null and the snapshot does not contain `nw-example-value`

#### Scenario: Token that looks like a path
- **WHEN** a job's `ProgramArguments` is `["/usr/bin/python3", "/nwExampleValue+9a/Q="]` and no such file exists
- **THEN** `script` is null and the snapshot does not contain `/nwExampleValue+9a/Q=`

#### Scenario: Helper arguments are not recorded
- **WHEN** a helper plist has `BundleProgram` `Contents/MacOS/agent`, `ProgramArguments` `["agent", "--token", "nw-example-value"]` and `EnvironmentVariables`
- **THEN** the snapshot contains neither `nw-example-value` nor any environment variable, and every `plutil` run on that file extracts `Label`, `Program`, `ProgramArguments.0` or `BundleProgram`

#### Scenario: Keys of a login item
- **WHEN** a login item's `Info.plist` also has `LSEnvironment` with `NORTHWIND_TOKEN`
- **THEN** every `plutil` run on that file extracts `CFBundleIdentifier` or `CFBundleExecutable`, and the snapshot does not contain `NORTHWIND_TOKEN`
