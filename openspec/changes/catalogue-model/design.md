# Design: catalogue-model

## Context

The repository has no code yet. The model follows Bruno's existing register in his private `mac-setup` repository (Backstage `Component` and `Resource` files, one per item), with three differences: licence fields use Backstage's camelCase (`renewsOn`, `vaultItem` instead of `renews_on`), a component points to its licence with `dependsOn: resource:<name>` instead of an app-name annotation, and journeys and map positions become their own kinds. The specs give the rules; this file records the choices behind them.

## Goals / Non-Goals

**Goals:** a loader and validator that later changes reuse as a library (the map, the site and the reports read the validated catalogue, never the raw YAML), and a CLI that a catalogue repository's pipeline can run.

**Non-Goals:** a stable public TypeScript API. Only the CLI and the file format are contracts in v1.

## Decisions

### D1. Our own kinds use `apiVersion: softwaremetro/v1alpha1`

Alternatives: (a) express journeys and positions with Backstage kinds and annotations, for example a `System` per journey with an ordered annotation; (b) a separate non-Backstage file such as `softwaremetro.yaml`.
Chosen: two kinds with their own `apiVersion`. They stay in the same folder and the same descriptor shape, so one parser and one error format serve everything. (a) bends Backstage semantics: a `System` has no order, and positions in annotations would spread one layout over every component file. (b) would need a second format and a second set of errors.
Trade-off: a Backstage instance pointed at the same folder logs unknown kinds. The documented fix is a Backstage location rule that allows only `Component` and `Resource`, or keeping `Line` and `MapLayout` files in a subfolder that Backstage does not read.

### D2. Zones are labels on components, declared in the layout

Alternatives: a `Zone` kind; Backstage `spec.system`.
Chosen: `metadata.labels["softwaremetro/zone"]` with the zone list in `MapLayout`. Labels are the Backstage mechanism for filtering, and a zone is a drawing concern (title and colour), so it lives with the layout. `spec.system` already means "parts that cooperate" in Backstage and would clash with a company that uses it.

### D3. YAML parser: `yaml` (eemeli, ISC)

Alternative: `js-yaml` (MIT).
Chosen: `yaml`, because its document API keeps the source range of every node, which the "Problem position" requirement needs, and it reads multi-document files and reports parse errors with line and column. `js-yaml` loses positions once the data is plain JavaScript.

### D4. Schema library: zod 4

Alternatives: hand-written checks; JSON Schema with ajv.
Chosen: zod. One definition gives both the runtime check and the TypeScript types the later changes use. An issue path from zod (for example `spec.licence.cost`) is mapped back to a node of the `yaml` document to get line and column. Rules across documents (duplicates, references, positions, secret scan) are plain functions over the parsed catalogue, not schema rules. Hand-written checks would duplicate the types; ajv would need a separate type generation step.

### D5. CLI without a framework

Alternative: commander.
Chosen: `node:util` `parseArgs` with `strict: true`, which rejects unknown options (the spec's exit 2). One command with one flag does not justify a dependency. Revisit when the CLI has several commands with their own options.

### D6. Package and tooling

One npm package, `softwaremetro`, ESM, TypeScript compiled with `tsc` to `dist/`, `bin` entry `softwaremetro`. Node.js 22 or later (`engines`). Tests with vitest: unit tests per rule with in-memory documents, and integration tests that run the built CLI on fixture folders under `test/fixtures/` (fictitious data only). The integration tests use real files and symbolic links in a temporary folder for the link and size rules. The CI job runs `npm ci`, `npm run build` and `npm test` on Node 22, 24 and 26 (26 is where the offline check of D7 runs in full). Versions are pinned in `package-lock.json`; GitHub Actions are pinned by commit SHA, as in the existing OpenSpec workflow.

### D7. Offline proof

The "Read-only" and "Offline run" scenarios are tested by running the CLI under Node's permission model: `--permission` with `--allow-fs-read` and no `--allow-fs-write` or `--allow-net`, so a write or a network call fails with `ERR_ACCESS_DENIED` (checked on Node 26: `fetch` and `writeFileSync` are both denied). The permission model covers the network only on Node versions that have `--allow-net`; the test detects that flag in `node --help` and is skipped with a message on older versions. The write check runs on every version.

## Risks / Trade-offs

- [The secret scan misses a secret under an unusual key name] → It is a guard, not a guarantee. The catalogue repository should also run a secret scanner (gitleaks); the format document says so.
- [The scan flags an ordinary number that happens to pass Luhn] → Only 13 to 19 digit runs are checked, the message names the field so it can be reworded, and the case is rare in a software catalogue.
- [zod issue paths do not always map to a YAML node, for example a missing field] → Fall back to the start of the document, as the spec allows.
- [Backstage logs our kinds as unknown] → Covered in D1.

## Migration Plan

Not applicable inside this repository. After the change ships, Bruno's register moves from `mac-setup/registry/` to his private catalogue repository, and the licence fields are renamed; that work is tracked outside this repository.
