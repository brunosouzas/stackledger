## Scenario to test map

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Nested and multi-document files; Skipped folders and other files; Skills map file in the catalogue folder (unchanged tests); Pipeline folder in a catalogue repository; Hidden file and hidden given folder; Unreadable hidden folder; Hidden link | `test/integration/files.test.ts` | I |

## 1. Hidden folders

- [x] 1.1 Tests first: "Pipeline folder in a catalogue repository", "Hidden file and hidden given folder", "Unreadable hidden folder" and "Hidden link" in `test/integration/files.test.ts`. Verify: "Pipeline folder…" and "Unreadable hidden folder" fail on `main`; "Hidden file…" and "Hidden link" pass on `main` and stay as guards against skipping too much.
- [x] 1.2 `src/source.ts`: after the link check, skip a folder whose name starts with `.` or is `node_modules`, before checking that it can be read. Verify: `npm test`.

## 2. Documentation

- [x] 2.1 `docs/catalogue-format.md`: the skipped folders, and a note that releases after 0.3.0 stop reading hidden folders (the repository has no CHANGELOG; the next release's text repeats it). `examples/catalogue-repository/README.md`: keep `catalog/` and its reason, adding "(needed up to 0.3.0, which the template pins; later releases skip hidden folders)". Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
