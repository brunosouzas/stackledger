## MODIFIED Requirements

### Requirement: launchd jobs
`launchd` SHALL read the `.plist` files directly inside `~/Library/LaunchAgents` (scope `user-agent`), `/Library/LaunchAgents` (scope `agent`) and `/Library/LaunchDaemons` (scope `daemon`), not following links: a linked folder or file counts as one ignored entry. The item has `id` = `Label`, `scope`, `path` of the file and `program` = `Program`, else the first entry of `ProgramArguments`, else null. A file that cannot be examined or read, or has no `Label`, is counted as ignored.

#### Scenario: Agent of the user
- **WHEN** `~/Library/LaunchAgents/com.northwind.sync.plist` has `Label` `com.northwind.sync` and `ProgramArguments` `["/Applications/Northwind Sync.app/Contents/MacOS/sync", "--quiet"]`
- **THEN** the item has scope `user-agent`, `program` `/Applications/Northwind Sync.app/Contents/MacOS/sync` and `script` null

#### Scenario: Unreadable daemon
- **WHEN** a file in `/Library/LaunchDaemons` cannot be read by the user
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Unexaminable launchd file
- **WHEN** a `.plist` listed in `/Library/LaunchDaemons` cannot be examined (lstat fails)
- **THEN** it is counted as ignored and the source is `ok`

#### Scenario: Linked launchd folder
- **WHEN** `/Library/LaunchDaemons` is a symbolic link to a folder holding a job file
- **THEN** that job is not recorded, `launchd` is `ok` and `ignored` counts the link once

### Requirement: launchd privacy
Discovery SHALL read only the keys `Label`, `Program` and `ProgramArguments.0` of a launchd file, plus `ProgramArguments.1` once when `program` is an interpreter ("launchd script"), one `plutil -extract <key> raw` run per key, so no other argument, environment variable or key is read or reaches the snapshot.

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

## ADDED Requirements

### Requirement: launchd script
Each item SHALL also have `script`: `ProgramArguments.1` when the text of `program` after its last `/` (the whole value if it has none) equals, exactly and case-sensitively, `sh`, `bash`, `zsh`, `dash`, `ksh`, `python`, `python3`, `node`, `ruby`, `perl`, `osascript`, or `python3.` followed by one or more ASCII digits and nothing more, and that value starts with `/` and names an existing regular file, links followed; otherwise null.

#### Scenario: Interpreter job
- **WHEN** a job has `ProgramArguments` `["/Users/username/.venvs/northwind/bin/python3.12", "/Users/username/northwind/server.py", "--port", "8800"]` and `server.py` exists
- **THEN** the item has `program` `/Users/username/.venvs/northwind/bin/python3.12` and `script` `/Users/username/northwind/server.py`

#### Scenario: Interpreter set through Program
- **WHEN** a job has `Program` `/bin/zsh`, `ProgramArguments` `["zsh", "/Users/username/bin/northwind-backup.sh"]` and that file exists
- **THEN** the item has `program` `/bin/zsh` and `script` `/Users/username/bin/northwind-backup.sh`

#### Scenario: Interpreter with a flag first
- **WHEN** a job has `ProgramArguments` `["/bin/bash", "-c", "northwind-sync --all"]`
- **THEN** the item has `program` `/bin/bash` and `script` null

#### Scenario: Not an interpreter name
- **WHEN** jobs have `program` `/usr/local/bin/python3.12-intel64`, `/usr/bin/Python3` or `/usr/bin/perl5.34`, each followed by an existing script path
- **THEN** each item has `script` null

#### Scenario: Script is a folder
- **WHEN** an interpreter job's `ProgramArguments.1` is `/Users/username/northwind`, a folder
- **THEN** the item has `script` null

### Requirement: launchd script reading
A limit, a non-zero exit or a missing or non-string value on the `ProgramArguments.1` run, or an empty value, SHALL make `script` null and keep the item; `plutil` not found keeps the rule of "Program limits". An item whose `script` breaks the snapshot secret guard SHALL be left out and counted as ignored, as "Snapshot secret guard" does for every item string.

#### Scenario: Interpreter with no argument
- **WHEN** a job has `ProgramArguments` `["/usr/bin/python3"]`
- **THEN** the item is recorded with `script` null

#### Scenario: Plist reader that hangs on the script key
- **WHEN** `plutil` hangs on `ProgramArguments.1` of an interpreter job
- **THEN** after the time limit the item is recorded with `script` null and the source is `ok`

#### Scenario: Non-string script value
- **WHEN** an interpreter job's `ProgramArguments.1` is a dictionary
- **THEN** the item is recorded with `script` null

#### Scenario: Card number in a script path
- **WHEN** an interpreter job's `script` would be `/Users/username/4111111111111111.py`, an existing file
- **THEN** the item is left out and counted as ignored
