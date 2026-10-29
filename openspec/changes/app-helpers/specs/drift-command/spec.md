## ADDED Requirements

### Requirement: Helpers suggest their app's components
The not-declared entry of a `launchd` item whose scope is `app-agent`, `app-daemon` or `app-login-item` SHALL list every component that matches the `app` item whose `path` followed by `/` starts the item's `path`, without repeats and in reference order, as the ones that probably need its `stackledger/launchd` annotation; when none does, it SHALL list what that app's entry suggests ("Annotations proposed for a cask"). A helper never matches through its app.

#### Scenario: Helper of a declared app
- **WHEN** `component:utils` lists the app whose path is `/Applications/Northwind Utils.app`, and its daemon `com.northwind.utils.fan` is not declared
- **THEN** the daemon is listed as not declared with `stackledger/launchd: com.northwind.utils.fan` and suggests `component:utils`

#### Scenario: Helper of an undeclared app
- **WHEN** neither the app `/Applications/Northwind Utils.app` nor its daemon is declared
- **THEN** both are listed as not declared and the daemon suggests nothing

#### Scenario: Helper of an app a cask installs
- **WHEN** `component:display` lists the cask that installs `Northwind Display.app`, the app is not declared, and neither is its agent
- **THEN** the app's entry and the agent's entry both suggest `component:display`

#### Scenario: App path that only looks alike
- **WHEN** `component:sync` lists the app `/Applications/Northwind Sync.app` and a helper's path is inside `/Applications/Northwind Sync Helper.app`
- **THEN** that helper suggests nothing from `component:sync`

#### Scenario: Job outside an app
- **WHEN** a `user-agent` job's program is inside a declared app
- **THEN** its entry suggests nothing (it still needs that app, "Inferred needs")

### Requirement: Scaffold of app helpers
An undeclared helper (scope `app-agent`, `app-daemon` or `app-login-item`) with no suggested components, whose app is not declared either, SHALL go into the scaffold file that holds that app's annotation (the app's own file, or the cask file it joined), not into a file of its own.

#### Scenario: App and its helper in one file
- **WHEN** the app `com.northwind.utils` and its daemon `com.northwind.utils.fan` are both not declared
- **THEN** one file holds `stackledger/app: com.northwind.utils` and `stackledger/launchd: com.northwind.utils.fan`, and no other file names the daemon

#### Scenario: Helper of an app with a suggestion
- **WHEN** the daemon's app is not declared but its entry suggests `component:utils`
- **THEN** the daemon gets no file, like its app
