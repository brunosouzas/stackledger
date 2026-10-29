## Context

`mac-discovery` (archived change `2026-10-21-mac-discovery`, design D2 and D3) reads three keys of a launchd file so that no argument, which may hold a token, reaches the snapshot. That keeps the snapshot safe but leaves an interpreter job (`python`, `bash`, `node`) unidentifiable: its `program` names the interpreter, not what it runs.

## Goals / Non-Goals

Goals: show the script of an interpreter job in the snapshot and in `drift`, without reading anything else.

Non-goals: `env`-launched jobs, flags before the script, Login Items that are not launchd files (AB#222), matching on the script, scaffold content.

## Decisions

- **D1. Read `ProgramArguments.1` only for interpreter jobs, keep it only when it is the path of an existing file.** The interpreter list is fixed (spec "launchd script") and compared exactly with the text after the last `/` of `program`, so `/opt/homebrew/bin/python3.12` and a venv's `python` count, and `python3.12-intel64` does not. Requiring an absolute path rules out flags (`-c`, `-m`) and inline code. Requiring an existing regular file rules out a token that starts with `/` (base64 can), which a plain "starts with `/`" check would keep; the check is one `test -f <path>` run through the same sandboxed runner as `plutil`, with its time limit and no network, never a stat in the Node process: the path comes from plist data and may point at a stale network mount. Alternatives rejected: reading every argument and filtering (reads values the privacy requirement forbids); a path-shape heuristic (no `=` or `+`, two components), which a token can still pass.
- **D2. One more `plutil -extract ProgramArguments.1 raw` run, after `program` is known, and one `test -f` when the value starts with `/`.** Same sandbox, pool and limits as the other keys; a check that is not found, stopped or fails gives `script` null. A failure on that key (missing, not a string) gives `script` null and keeps the item, because the job itself was read.
- **D3. `script` is a new nullable field of launchd items, format stays `stackledger-snapshot/v1`.** discover always writes it. The schema accepts a launchd item without it and reads it as null (the parsed type always has it), so snapshots written by 0.6.0 still work with this `drift`. The other direction breaks: `drift` 0.6.0 given a snapshot from this version, for example through `--snapshot` with a file from another machine, exits 2 with a shape reason, because its schema is strict. Accepted and documented: the usual path is one installed version that discovers and checks, and bumping to `v2` would instead break every existing snapshot for this version's readers.
- **D4. `drift` shows the values, never matches on them.** Text: `  runs <program> [<script>]` right after ` (<path>)`, before the annotation. JSON: `program` and `script` right after `path` on every `notDeclared` entry, null outside launchd, following the existing convention that every entry has every field (`title`, `path`).

## Risks / Trade-offs

- An absolute-path first argument that is not a script (a config file, `python3 /path/to/tool --flag`) is recorded as `script`. It is still a path, so the privacy rule holds; the label "script" is approximate. Accepted.
- A token that is also the path of an existing file would be kept; that needs the token to be a real file path, so it is not a secret in practice.
- An interpreter outside the list (`php`, `lua`, `python3.12-intel64`) keeps `script` null. The list can grow in a later change when a real job needs it.
