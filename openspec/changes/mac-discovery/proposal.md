# Proposal: mac-discovery

## Why

A catalogue is only useful while it matches what is really installed. Today the owner keeps it in step by hand, and relations are rarely written down (an early count found `dependsOn` on 7 of 62 entries). Roadmap item 6: read what is installed on a Mac, without changing it, and compare it with the catalogue, so the person who keeps the catalogue sees what to add, what to remove and which relations to confirm.

## What Changes

- `stackledger discover`: reads what is installed on this Mac, read-only, and writes one snapshot file for this machine to `~/.stackledger/<machine>/snapshot.json`. Sources: Homebrew formulae and casks, the App Store through `mas` when it is installed, `/Applications` and `~/Applications`, launchd agents and daemons (user and system), mise, global npm packages and pipx. A missing source is skipped and reported, never an error.
- Every program discovery runs is started inside the macOS sandbox with network and file writes denied, so read-only is enforced, not only intended.
- `stackledger drift <folder>`: compares the snapshot with the catalogue and lists what is installed but not declared, what is declared but missing, and what could not be checked because its source was skipped.
- Matching is only through package-manager annotations on components (`stackledger/brew: git`, `stackledger/app: <bundle id>`, and so on). It never matches by name.
- `drift` prints the annotation an undeclared item would need and the `dependsOn` relations it can infer (Homebrew dependencies, the program a launchd job runs, the app a cask installs). It never edits the catalogue: a person confirms them.
- `stackledger validate` warns about an unknown `stackledger/` annotation key, an empty identifier and an identifier claimed by two components.

## Capabilities

### New Capabilities

- `mac-discovery`: what is read from each source, the snapshot content, the machine name and the read-only guarantees.
- `discover-command`: the `stackledger discover` command line and writing the snapshot file.
- `drift-command`: the `stackledger drift` command line, matching through annotations, outputs and proposals.

### Modified Capabilities

- `catalogue`: the discovery annotations and their warnings.
- `mcp-server`: the global help scenario lists `discover` and `drift` too.

## Impact

- New code: `src/discovery/` (one small module per source, the sandboxed runner, the machine name, the snapshot model and file), `src/drift.ts`, `src/discover-command.ts`, `src/drift-command.ts`; `src/cli.ts` gains the two commands; `src/validate.ts` gains the annotation warnings.
- No new runtime dependency: plists are read with macOS `plutil`, JSON with Node.
- CI: a macOS job runs the discovery tests that need the real sandbox and `plutil`; the existing Linux jobs run everything else.
- Documentation: `docs/discovery.md` (new), `docs/catalogue-format.md`, README, AGENTS.md, roadmap, the agent skill.

## Out of scope

- Writing to the catalogue, opening pull requests, or applying a proposed annotation or relation.
- Comparing several machines at once, or recording which machine a component should be on (later: several Macs, Fleet).
- Windows and Linux collectors; system software inside `/System`.
- Reading the arguments, environment or other keys of a launchd job beyond its label and program path; whether a job is loaded or running.
- npm globals of node versions other than the `npm` found on `PATH`; pip packages outside pipx; Mac App Store purchases that are not installed.
- Using `lifecycle` to decide what should be installed (it is free text).
- Showing discovery data in the site, the map, the report or the MCP server.
- A history of snapshots: each run replaces the machine's file.

## Implicit requirements

- **Errors and invalid input:** requirement. A missing source is reported as skipped; a source whose program fails, times out or prints something unreadable is reported as failed with no items; `drift` with no snapshot, or an invalid one, exits 2 and says how to make one; usage errors exit 2 with empty stdout.
- **Limits:** requirement. Each program run has a time limit and an output size limit; the snapshot file read by `drift` has a size limit; `drift` compares 2,000 items with 500 components in under 2 seconds.
- **Repetition and idempotency:** requirement. The same machine state gives the same snapshot apart from `takenAt`; `drift` gives byte-identical output for the same snapshot and catalogue.
- **Concurrency:** requirement. Two `discover` runs at once each write a complete file; the last rename wins, and no partial file is ever read.
- **Security:** requirement. No sudo, no network, no telemetry, no AI; programs run in a sandbox that denies network and writes; the only write is the snapshot file; launchd arguments and environment are never read; text is stripped of control characters in terminal output; the snapshot folder and file are private to the user.
- **Logs and observability:** requirement. `discover` reports each source's status and item count; `drift` writes the catalogue counts line on stderr as `report` does.

## Open questions

Decided by the owner on 2026-10-21 (not reopened): the sources; snapshots outside the catalogue repository in `~/.stackledger/<computer-name>/`; the macOS user name kept in snapshot paths and replaced by `username` in anything public; matching only through `stackledger/<source>` annotations, never by name; discovery prints annotations but never edits the catalogue; this change comes before `map-theme-ink` and `map-backgrounds`.

Open for gate 1 (each with a recommendation in `design.md`, Open questions):

1. Snapshot folder in the home folder (`~/.stackledger/`) or next to the catalogue but outside Git.
2. Machine name: slug of the computer name, or `LocalHostName`.
3. Several identifiers in one annotation (comma-separated).
4. What `drift` leaves out of "installed but not declared": Homebrew formulae installed only as dependencies, and macOS's own items.
5. A source whose sandbox cannot start (no `sandbox-exec`): fail closed.
6. A Homebrew formula's version and dependency data come from `brew info --json=v2 --installed`, run offline inside the sandbox.

## Documentation

- `docs/discovery.md` (new): sources, the exact commands and files read, the sandbox, the snapshot format with a fictitious example (`username`), the machine-name rule, `drift` output and exit codes.
- `docs/catalogue-format.md`: the `stackledger/<source>` annotations and their warnings.
- `README.md`: Usage rows for `discover` and `drift`.
- `AGENTS.md`: implemented list and the discovery rule for tests (no real machine data in fixtures).
- `docs/roadmap.md`: row 6 delivered after merge.
- `skills/stackledger/SKILL.md`: how an agent reads `drift` output and proposes annotations.
- `docs/spikes/2026-10-21-mac-discovery/README.md`: what the spike measured, without real data.
- Brain vault: `10-personal/projects/stackledger/_index.md`.
