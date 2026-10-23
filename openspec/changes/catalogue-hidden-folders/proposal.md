## Why

A catalogue kept in a Git repository with a pipeline has `.github/workflows/stackledger.yml`. The catalogue reader skips only folders named `.git` and `node_modules`, so it reads the workflow as a catalogue document and reports `kind is required`. This happens in 0.2.0, in 0.3.0 and on `main`. It was found while building the owner's catalogue (AB#127) and is tracked as AB#133. The pipeline template in `examples/catalogue-repository/` avoids it only because the catalogue sits in `catalog/`, a sub-folder.

## What Changes

- The catalogue reader skips every folder below the given folder whose name starts with `.` (`.git`, `.github`, `.vscode`, `.idea`…), as the skills walk already does, plus `node_modules` as today.
- The given folder itself is always read, even when its own name starts with `.`.
- Files are unchanged: a YAML file whose name starts with `.` is still read when it is in a folder that is read.
- Symbolic links are unchanged: a link named with a leading `.` still gets the link warning and is not followed.

This affects every command that reads a catalogue (`validate`, `map`, `build`, `report`, `drift`, `mcp`), because they share one reader.

Out of scope: a `.stackledgerignore` for catalogues (the card's other option; nobody asked for patterns, and hidden folders cover the case); listing skipped folders in the output; any change to the skills walk.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue`: "Catalogue files" points to a new requirement, "Skipped folders".

## Impact

- `src/source.ts` (the walk), its tests, `docs/catalogue-format.md`.
- Behaviour change for anyone keeping catalogue files in a hidden folder: they are no longer read. The next release's text says so; moving the files to a folder without a leading `.` restores them.

## Implicit requirements

- Errors and invalid input: a hidden folder that cannot be read no longer gives "Folder cannot be read", because it is skipped before it is opened.
- Limits: unchanged.
- Repetition and idempotency: unchanged; the same folder gives the same documents in the same order.
- Concurrency: n/a.
- Security: fewer files read; a symbolic link is still never followed, hidden or not.
- Logs and observability: the `files` count of `validate` no longer counts YAML files inside hidden folders.

## Documentation

`docs/catalogue-format.md` (skipped folders, with a note on the behaviour change after 0.3.0); `examples/catalogue-repository/README.md` (the reason the catalogue sits in `catalog/`); `docs/roadmap.md` needs no entry (a fix); the GitHub release text of 0.4.0; vault changelog after the merge.
