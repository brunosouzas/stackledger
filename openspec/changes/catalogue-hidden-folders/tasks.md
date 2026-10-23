## Scenario to test map

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Nested and multi-document files; Skipped folders and other files; Skills map file in the catalogue folder (unchanged tests); Pipeline folder in a catalogue repository; Hidden file and hidden given folder; Unreadable hidden folder | `test/integration/files.test.ts` | I |

## 1. Hidden folders

- [ ] 1.1 Tests first: "Pipeline folder in a catalogue repository", "Hidden file and hidden given folder", "Unreadable hidden folder" in `test/integration/files.test.ts`. Verify: they fail on `main` (the workflow gives `kind is required`; the unreadable hidden folder gives "Folder cannot be read").
- [ ] 1.2 `src/source.ts`: skip a folder below the given folder whose name starts with `.` or is `node_modules`, before checking that it can be read. Verify: `npm test`.

## 2. Documentation

- [ ] 2.1 `docs/catalogue-format.md`: skipped folders, and a note that 0.4.0 stops reading hidden folders (the repository has no CHANGELOG; the release text of 0.4.0 repeats it). Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
