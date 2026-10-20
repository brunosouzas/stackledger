# Tasks

## 1. Package skeleton and CI

- [ ] 1.1 Create `package.json` (name `softwaremetro`, ESM, `bin`, `engines.node >=22`, scripts `build`, `test`), `tsconfig.json`, and add `yaml`, `zod`, `typescript`, `vitest` and `@types/node` with exact versions in `package-lock.json`; verify `npm ci && npm run build` succeeds and `node dist/cli.js --help` prints usage.
- [ ] 1.2 Add `.github/workflows/test.yml` running `npm ci`, `npm run build` and `npm test` on Node 22, 24 and 26, actions pinned by commit SHA; verify the job passes on the draft pull request.

## 2. Reading files

- [ ] 2.1 Implement folder discovery and file limits. Prove "Nested and multi-document files", "Skipped folders and other files", "Oversized file" and "Link that leaves the folder" in `test/integration/files.test.ts` (integration, real files and symbolic links in a temporary folder).
- [ ] 2.2 Implement YAML parsing with positions. Prove "Broken file among good ones" in `test/integration/files.test.ts` (integration) and "Error on a nested field" in `test/unit/positions.test.ts` (unit).

## 3. Document rules

- [ ] 3.1 Implement identity and kinds. Prove "Missing kind", "Duplicate name across files", "Name too long", "Unsupported pair" and "Backstage catalogue with extra kinds" in `test/unit/identity.test.ts` (unit).
- [ ] 3.2 Implement components and references. Prove "Component without owner", "Minimal valid component", "Dangling dependency", "Reference to an unchecked kind" and "Reference without kind" in `test/unit/components.test.ts` (unit).
- [ ] 3.3 Implement licences. Prove "Licence without vendor", "Zero seats", "Impossible date", "Negative cost" and "Unknown values are valid" in `test/unit/licences.test.ts` (unit).
- [ ] 3.4 Implement lines. Prove "Line with one stop", "Stop visited twice", "Stop that is a licence" and "Shared colour" in `test/unit/lines.test.ts` (unit).
- [ ] 3.5 Implement the layout and zones. Prove "Second layout", "Two stations in one cell", "Fractional position", "Stop without position", "No layout at all" and "Undeclared zone" in `test/unit/layout.test.ts` (unit).
- [ ] 3.6 Implement the secret scan. Prove "Token key in an annotation", "Card number in a note", "Ordinary long number" and "E-mail address" in `test/unit/secrets.test.ts` (unit), including that the message never contains the value.

## 4. The validate command

- [ ] 4.1 Implement `softwaremetro validate` with text output and exit codes. Prove "Default folder", "Warnings only", "One error", "Missing folder", "Unknown option", "Error line" and "Clean catalogue" in `test/integration/cli.test.ts` (integration, runs the built CLI on `test/fixtures/`).
- [ ] 4.2 Implement `--json` and ordering. Prove "JSON for a pipeline" and "Two runs" in `test/integration/cli.test.ts` (integration).
- [ ] 4.3 Prove "Read-only" and "Offline run" in `test/integration/sandbox.test.ts` (integration, Node permission model as in design D7; the network part is skipped with a message where `--allow-net` does not exist).
- [ ] 4.4 Add `test/fixtures/demo/`, a valid catalogue of a fictitious company with every kind, and verify `node dist/cli.js validate test/fixtures/demo` exits 0 with 0 errors.

## 5. Documentation

- [ ] 5.1 Write `docs/catalogue-format.md` (every kind and field with its rule, the Backstage location rule from design D1, and the advice to run a secret scanner) and a "Catalogue format" section in `README.md`; verify each YAML example in them passes `node dist/cli.js validate` when copied into a temporary folder (checked by `test/integration/docs.test.ts`).

## Workflow follow-up

- Run the code review loop, then archive the change in the same branch.
- Mark change 1 as delivered in `docs/roadmap.md` and update the brain project note after the merge.
