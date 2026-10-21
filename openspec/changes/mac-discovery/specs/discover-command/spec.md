# discover-command

## Purpose
Defines `stackledger discover`, the command that reads what is installed on this Mac and writes one snapshot file for the machine, outside any catalogue, with a summary of each source on stdout.

## ADDED Requirements

### Requirement: Command
`stackledger discover` SHALL run discovery, write the snapshot to `~/.stackledger/<machine>/snapshot.json`, where `<machine>` is the machine name, print a summary on stdout and exit 0, also when sources are skipped or failed. The summary is the snapshot path, then one line per source in source order with its status, `items`, `ignored` and reason. It takes no catalogue folder.

#### Scenario: Snapshot written
- **WHEN** the command runs on a fictitious machine named `username - MacBook Air`
- **THEN** `~/.stackledger/username-macbook-air/snapshot.json` exists, stdout has its path and eight source lines, and the exit code is 0

#### Scenario: Skipped source still succeeds
- **WHEN** `mas` is not installed
- **THEN** the `mas` line says `skipped` and `not found`, and the exit code is 0

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise any argument or option SHALL print the reason and usage on stderr, print nothing on stdout, run no source and exit 2.

#### Scenario: Unexpected folder
- **WHEN** the command runs as `stackledger discover ./catalogue`
- **THEN** the exit code is 2, stdout is empty, stderr says the command takes no folder, and no snapshot is written

#### Scenario: Discover help
- **WHEN** the command runs as `stackledger discover --help --out x`
- **THEN** stdout shows usage and the exit code is 0

### Requirement: Runs only on macOS
On an operating system other than macOS, or when `/usr/bin/sandbox-exec` does not exist, the command SHALL print one line naming the reason on stderr, print nothing on stdout, write nothing and exit 1.

#### Scenario: Not macOS
- **WHEN** the command runs on Linux
- **THEN** the exit code is 1, stdout is empty, stderr has one line saying discovery runs only on macOS, and nothing is written

#### Scenario: Sandbox missing
- **WHEN** `/usr/bin/sandbox-exec` does not exist
- **THEN** the exit code is 1, stderr has one line naming the sandbox, and nothing is written

### Requirement: Snapshot folders
The command SHALL create `~/.stackledger` and the machine folder when they are absent, with mode `0700`, and SHALL never change the mode of existing ones. It SHALL write the snapshot with mode `0600` to a new file in the machine folder and then rename it over `snapshot.json`, so a reader sees either the previous complete file or the new one.

#### Scenario: First run
- **WHEN** `~/.stackledger` does not exist
- **THEN** after the run `~/.stackledger` and the machine folder have mode `0700` and `snapshot.json` has mode `0600`

#### Scenario: Two runs at once
- **WHEN** two runs on the same machine finish at the same time
- **THEN** `snapshot.json` is one complete, valid snapshot and no temporary file is left

### Requirement: Unsafe snapshot path
When the home folder can be written by group or others; or `~/.stackledger` or the machine folder is a symbolic link, is not a folder, is not owned by the current user, or grants any permission to group or others; or `snapshot.json` exists and is not a regular file, the command SHALL write nothing, print one error line on stderr and exit 1. These rules keep other users out of the snapshot folders.

#### Scenario: Linked snapshot folder
- **WHEN** `~/.stackledger` is a symbolic link to another folder
- **THEN** the exit code is 1, stderr has one line, and nothing is written in either folder

#### Scenario: Folder writable by others
- **WHEN** the machine folder exists with mode `0777`
- **THEN** the exit code is 1, stderr has one line, and nothing is written

#### Scenario: Folder readable by others
- **WHEN** `~/.stackledger` exists with mode `0755`
- **THEN** the exit code is 1, stderr has one line saying the folder must be private to the user, and nothing is written

### Requirement: Folder swap
After creating its temporary file and again before the rename, the command SHALL check that both folders are still the folders it checked (same device and inode, not a link). If not, it SHALL leave `snapshot.json` as it was, remove its temporary file when its path still leads to it (in a folder moved away it stays), print one error line and exit 1. This detects a swap by the user's own processes; it is not a boundary against them.

#### Scenario: Folder replaced before the temporary file
- **WHEN** the machine folder is replaced by a symbolic link after the folder checks and before the temporary file is created
- **THEN** the exit code is 1, the link's target holds no snapshot, and no temporary file is left in it

#### Scenario: Folder replaced before the rename
- **WHEN** the machine folder is replaced by a symbolic link after the snapshot is written to the temporary file and before the rename
- **THEN** the exit code is 1, neither the moved folder nor the link's target gets a new `snapshot.json`, and the link's target holds no temporary file

### Requirement: Write failures
A failure to create or write the file, or a snapshot whose JSON is larger than 32 MiB, SHALL exit 1 with one error line, remove the temporary file and leave any previous snapshot unchanged.

#### Scenario: Folder not writable
- **WHEN** the machine folder exists and cannot be written
- **THEN** the exit code is 1, stderr has one line, and the previous `snapshot.json` is unchanged

#### Scenario: Snapshot too large
- **WHEN** the discovered items serialise to more than 32 MiB
- **THEN** the exit code is 1, stderr says the snapshot is too large, and the previous `snapshot.json` is unchanged

### Requirement: Summary text
The summary SHALL contain no C0 or C1 control character: any such character in the snapshot path is removed. Program output never reaches stdout or stderr.

#### Scenario: Program output kept out
- **WHEN** a source program prints a terminal escape on stdout and on stderr and then fails
- **THEN** neither the command's stdout nor its stderr contains a control character
