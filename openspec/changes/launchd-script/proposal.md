## Why

A launchd job whose program is an interpreter says nothing about what it runs. On the owner's Mac, macOS Login Items listed a job as "python", and `stackledger discover` recorded only `program` = `.../.venv/bin/python`: neither the snapshot nor `drift` could tell which script the job starts, so the person keeping the catalogue could not identify it (AB#223). The script is the second entry of `ProgramArguments`, which discovery deliberately does not read today (launchd privacy).

## What Changes

- **Discovery records the script of an interpreter job.** When a launchd job's `program` is a known interpreter (`sh`, `bash`, `zsh`, `dash`, `ksh`, `python`, `python3`, `python3.<n>`, `node`, `ruby`, `perl`, `osascript`), discovery also reads `ProgramArguments.1` and records it as the item's `script` when it is an absolute path to an existing file. Otherwise `script` is null. No other argument is read.
- **The snapshot carries `script`** on every launchd item (a path or null). The format stays `stackledger-snapshot/v1`; a snapshot written before this change, whose launchd items have no `script`, is still read.
- **`drift` shows what a job runs.** A not-declared launchd item shows `runs <program> [<script>]` in the text output. In the JSON output every `notDeclared` entry gains `program` and `script` (null outside launchd, as `title` and `path` already are).
- **A snapshot written by this version is rejected by `drift` 0.6.0** (strict shape, exit 2): additive for readers of this version, not for older ones. Recorded in `docs/discovery.md` and the vault changelog.

Out of scope:

- jobs started through `/usr/bin/env` (`env python3 script.py`): the interpreter is then `ProgramArguments.1` and the script `ProgramArguments.2`; not read;
- interpreter flags before the script (`python3 -u script.py`, `bash -c "..."`, `python -m module`): `script` is null;
- Login Items and background items that are not launchd files (AB#222, a separate change);
- matching and scaffold content: `script` is shown, never used to match, and never copied into a draft ("Scaffold content" names it);

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mac-discovery`: "launchd script" and "launchd script reading" added; "launchd jobs" (scenario only) and "launchd privacy" (`ProgramArguments.1` read for interpreter jobs only) modified.
- `drift-command`: "What a launchd job runs" and "Snapshot without script" added; "Scaffold content" modified (`script` never copied).

## Implicit requirements

- Errors and invalid input: a missing, non-string, empty, relative or flag `ProgramArguments.1`, or one that names no existing file, gives `script` null and keeps the item ("launchd script", "launchd script reading"); a wrong `script` type in an edited snapshot exits 2 ("Snapshot without script").
- Limits: the existing per-program limits apply to the extra `plutil` run, which happens once per interpreter job only (scenario "Plist reader that hangs on the script key").
- Repetition and idempotency: discovery stays deterministic; same files, same snapshot.
- Concurrency: n/a, the extra run joins the existing `plutil` pool.
- Security: privacy is the point of the change. Only interpreter jobs get one more key read, and only the path of an existing file is kept, so a token passed as the first argument, even one starting with `/`, is dropped (scenarios "Token as first argument", "Token that looks like a path"); the snapshot secret guard applies to `script` like every other string (scenario "Card number in a script path").
- Logs and observability: n/a, discovery prints only per-source counts, unchanged.

## Impact

`src/discovery/sources/launchd.ts`, `src/discovery/types.ts`, `src/discovery/snapshot.ts` (schema, strings checked by the secret guard), `src/drift.ts` and `src/drift-formats.ts` (not-declared launchd entries), tests in `test/unit` and `test/integration` with fictitious jobs, `examples/northwind-machine/snapshot.json`.

## Documentation

- `docs/discovery.md`: the launchd source row, the privacy paragraph ("label and program only" becomes "and, for an interpreter job, its script"), the snapshot item fields (and that older files may lack `script`), the drift text and JSON examples, and the note that 0.6.0 rejects new snapshots.
- `skills/stackledger/SKILL.md`: the drift JSON guide gains `program` and `script`.
- Vault `10-personal/projects/stackledger/`: changelog (the new field and the older-reader incompatibility), roadmap and architecture, after the merge.
- No ADR: no project-wide decision; the privacy trade-off is recorded in design.md.
