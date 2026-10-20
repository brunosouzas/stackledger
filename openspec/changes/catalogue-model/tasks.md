# Tasks

## 1. Package skeleton and CI

- [x] 1.1 Create `package.json` (name `stackledger`, ESM, `bin`, `engines.node >=22`, scripts `build`, `test`), `tsconfig.json`, and add `yaml`, `zod`, `typescript`, `vitest` and `@types/node` with exact versions in `package-lock.json`; verify `npm ci && npm run build` succeeds.
- [ ] 1.2 Add `.github/workflows/test.yml` running `npm ci`, `npm run build` and `npm test` on Node 22, 24 and 26, actions pinned by commit SHA; verify the job passes on the draft pull request.

## 2. Reading files

- [x] 2.1 Implement folder discovery, link handling and file limits. Prove "Nested and multi-document files", "Skipped folders and other files", "Link that leaves the folder", "Link to a folder inside", "Oversized file" and "Unreadable file" in `test/integration/files.test.ts` (integration, real files, permissions and symbolic links in a temporary folder).
- [x] 2.2 Implement YAML parsing with positions and document order. Prove "Broken file among good ones", "Duplicate key" and "Document that is a list" in `test/integration/files.test.ts` (integration), and "Case in paths" and "Two documents in one file" in `test/unit/order.test.ts` (unit).

## 3. Document rules

- [x] 3.1 Implement the check order, identity and kinds. Prove "Unmarked rule is an error", "Ignored kind without a name", "Unsupported pair without a name", "Nothing but a name", "Invalid name stops the checks", "Missing kind", "Duplicate name across files", "Name too long", "Name with an accent", "Unsupported pair", "Kind in the wrong case", "Backstage catalogue with extra kinds", "Database resource", "US spelling", "Resource without type" and "Team namespace" in `test/unit/identity.test.ts` (unit).
- [x] 3.2 Implement components, fields outside the format and references. Prove "Backstage fields on a component", "Component without owner", "Minimal valid component", "Labels that are a number", "Reference without kind", "Case and default namespace", "Dependency in another namespace", "Dangling dependency", "Dependency on a database" and "Reference to an unchecked kind" in `test/unit/components.test.ts` (unit).
- [x] 3.3 Implement licences. Prove "Typo in a licence", "Owner that is a list", "Licence without vendor", "Zero seats", "Fractional seats", "Unknown status", "Impossible date", "Negative cost", "Lower-case currency" and "Unknown values are valid" in `test/unit/licences.test.ts` (unit).
- [x] 3.4 Implement lines. Prove "Typo in a line", "Line with one stop", "Short colour", "Shared code", "Stop visited twice", "Stop that is a licence", "Missing stop", "Stop in another namespace", "References use the earlier duplicate" and "Shared colour" in `test/unit/lines.test.ts` (unit).
- [x] 3.5 Implement the layout and zones. Prove "Second layout", "Two stations in one cell", "Fractional position", "Station for a missing component", "Stop without position", "No layout at all", "Zone name in another case", "Undeclared zone" and "Duplicate zone" in `test/unit/layout.test.ts` (unit).
- [x] 3.6 Implement the secret scan. Prove "Token key in an annotation", "Card number in a note", "Unquoted card number", "Private key", "Ordinary long number" and "E-mail address" in `test/unit/secrets.test.ts` (unit), each asserting that the message does not contain the value.

## 4. The validate command

- [x] 4.1 Implement `stackledger validate`, usage and exit codes. Prove "Default folder", "Help", "Help wins", "Unknown option", "Two folders", "No command", "Warnings only", "One error" and "Missing folder" in `test/integration/cli.test.ts` (integration, runs the built CLI on `test/fixtures/`).
- [x] 4.2 Implement text output, field paths, positions and counts. Prove "Error line", "Clean catalogue", "Annotation key with a slash", "Key with a quote", "Problem about a file", "Error on a nested field", "Error on a station key" and "Mixed folder" in `test/integration/output.test.ts` (integration).
- [x] 4.3 Implement `--json` and ordering. Prove "JSON for a pipeline" and "Two runs" in `test/integration/output.test.ts` (integration).
- [x] 4.4 Prove "Read-only" and "Offline run" in `test/integration/sandbox.test.ts` (integration, Node permission model plus the comparison with an unrestricted run and the file hashes, as in design D7; the network part is skipped with a message where `--allow-net` does not exist).
- [x] 4.5 Add `test/fixtures/demo/`, a valid catalogue of a fictitious company with every kind, and verify `node dist/cli.js validate test/fixtures/demo` exits 0 with 0 errors.

## 5. Documentation

- [ ] 5.1 Write `docs/catalogue-format.md` (every kind and field with its rule, the Backstage location rule from design D1, and the advice to run a secret scanner such as gitleaks) and a "Catalogue format" section in `README.md`; verify each YAML example in them passes `node dist/cli.js validate` when copied into a temporary folder (checked by `test/integration/docs.test.ts`).

## Workflow follow-up

- Run the code review loop, then archive the change in the same branch.
- Mark change 1 as delivered in `docs/roadmap.md` and update the brain project note after the merge.
