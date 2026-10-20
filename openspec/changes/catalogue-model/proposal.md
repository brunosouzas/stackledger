# Proposal: catalogue-model

## Why

Every later feature (the metro map, the software list, item pages, licence reports, drift) reads the same catalogue. Before any of them can be built, the catalogue format has to be fixed and checked, so that a mistake in a YAML file is reported once, clearly, instead of breaking the map or a report later. This is the first change of the roadmap (`docs/roadmap.md`).

## What Changes

- Define the catalogue: the YAML files in one folder that stackledger reads. It accepts a subset of the Backstage descriptor format (`Component` for software items, `Resource` with `spec.type: licence` for licences) plus two kinds of its own: `Line` (a journey: an ordered list of components) and `MapLayout` (grid positions of stations and the zones).
- Other Backstage kinds (`System`, `API`, `Group`, `User`, `Domain`, `Location`, `Template`) are counted and ignored, so a folder that also feeds a Backstage instance can be read as it is.
- Add the `stackledger validate [folder]` command. It reads every YAML file in the folder, checks the rules in the specs and prints each problem with its file, line and field. It exits 0 when there is no error, 1 when there is at least one, and 2 when it cannot run (for example, the folder does not exist). `--json` prints the same result as JSON.
- Add the npm package skeleton (TypeScript, Node.js 22 or later), the test setup and a CI job that runs the tests.

## Capabilities

### New Capabilities

- `catalogue`: what a catalogue is, which documents it accepts, which fields each kind has, how entities reference each other, and which rules make a catalogue valid.
- `validate-command`: the command-line behaviour of `stackledger validate`: input, output in text and JSON, exit codes and ordering.

### Modified Capabilities

None. This is the first change.

## Impact

- New code: the package skeleton, the catalogue loader and validator, the `validate` command.
- New dependencies: a YAML parser that keeps line numbers, a schema library, the test runner (see `design.md`).
- CI: a GitHub Actions job runs the tests on pull requests, next to the existing OpenSpec job.
- Users: Bruno's catalogue (today `registry/` in his private `mac-setup` repository) is migrated to this format in a separate private repository after this change ships. That migration is outside this repository.

## Out of scope

- Reading a catalogue from a Git URL (change `catalogue-git-source`). This change reads a local folder.
- Drawing the map, suggesting station positions (change `metro-map-engine`), the website (change `catalogue-site`), reports, discovery and drift.
- Publishing a JSON Schema for editors, `--strict` mode that turns warnings into errors, and fixing files automatically.
- Lines that visit the same station twice (circle lines).
- Any Backstage kind beyond counting and ignoring it, and Backstage relations other than `dependsOn` (`partOf`, `providesApi`, `consumesApi`, `memberOf`). Their fields are accepted and ignored on components.
- Backstage namespaces other than `default`: a document in another namespace gets a warning and is treated as `default`.
- Publishing to npm. The package is built and tested, not released.

## Implicit requirements

- **Errors and invalid input:** requirement. Every problem is reported with file, line and field, and validation never stops at the first error (`validate-command`). Malformed YAML is an error for that file only; the other files are still checked.
- **Limits:** requirement. A file larger than 1 MiB is rejected as an error without being parsed. Symbolic links are never followed, so a link cannot leave the folder, loop or make a file count twice. Folders named `.git` and `node_modules` are skipped.
- **Repetition and idempotency:** requirement. Validation only reads; running it twice on the same files gives the same output in the same order.
- **Concurrency:** n/a. One process reads files; nothing is written.
- **Security:** requirement. A key that names a secret (`password`, `secret`, `token`, `apiKey`, `privateKey`, any case, anywhere in a document) and a value that looks like a private key or a payment-card number are errors. The catalogue may name a password-manager item, never hold a credential. An e-mail address in a value is a warning.
- **Logs and observability:** requirement. Output goes only to stdout (results) and stderr (usage errors). No network access and no telemetry.

## Open questions

These choices become part of the public file format. The specs are written with the recommended answer; Bruno confirms or changes them at the proposal review.

1. **Our own kinds use `apiVersion: stackledger/v1alpha1`** (`Line`, `MapLayout`), and a component joins a zone with the label `stackledger/zone`. Recommended: yes (design D1, D2).
2. **Licence fields from the `mac-setup` register.** `kind` (subscription, perpetual, free) is dropped because `cycle` and `cost` already say it. `owner_scope` becomes the optional free-text `paidBy` (for example `self`, `employer`). `status: retired` becomes `cancelled`. `spec.lifecycle` on a licence is kept as an accepted Backstage field with no rule. Recommended: yes (design D8).
3. **An e-mail address in a value is a warning, not an error.** Recommended: warning, because a vendor's support address is legitimate; the rule exists so a personal address is noticed.

## Documentation

- `README.md`: a short "Catalogue format" section with one example per kind and the `validate` command.
- `docs/catalogue-format.md` (new): every kind and field, with its rule.
- `docs/roadmap.md`: mark change 1 delivered when it merges.
- Brain vault: `10-personal/projects/stackledger/_index.md`, status line.
