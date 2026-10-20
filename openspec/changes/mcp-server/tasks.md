## 1. Settings, served documents and views

- [ ] 1.1 Add the `Settings` kind to the schemas and the validator (supported pair, strict fields, metadata, allowed and unique hide names, one settings document with the `MapLayout` duplicate rule); tests for every scenario of the `catalogue` delta in `test/unit/settings.test.ts`; update the supported-kinds message.
- [ ] 1.2 Return `served` from `validateLoaded`: documents that passed every document check, secret scan included, and are not later duplicates, plus non-licence resources as `ref` and `type`; keep every existing `validate` test passing.
- [ ] 1.3 Add `src/views.ts` (`resolveHidden`, `applyView`) with the default list, the invalid-settings rule and the staff licence allow-list; tests for every `catalogue-views` scenario in `test/unit/views.test.ts`.

## 2. Graph queries

- [ ] 2.1 Add `src/graph.ts`: reference parsing and lookup, `dependsOn` and `unresolved`, `dependants`, `linesAt`, `impact` (visited set, smallest depth, cap 500 with lines from every dependant), `gaps`, renewals window with `overdue`; unit tests in `test/unit/graph.test.ts` for chains, cycles, the cap, gaps, sort order and window edges.

## 3. MCP server

- [ ] 3.1 Add `@modelcontextprotocol/sdk` at an exact version; record it in `package-lock.json`; `npm audit` clean.
- [ ] 3.2 Add `src/mcp.ts` with the six tools, permissive input schemas with checks in the handlers, output schemas, read-only annotations, the result envelope (`catalogue` per view), tool errors and stderr logs; register tools per view.
- [ ] 3.3 Extend `src/cli.ts` with the `mcp` command (folder required, absolute path), its options and usage errors, and global help listing both commands; keep every `validate-command` scenario passing.
- [ ] 3.4 Integration tests in `test/integration/mcp.test.ts`: one test per `mcp-server` scenario, named after it, through the SDK client over stdio against the built CLI.
- [ ] 3.5 Leak test in `test/integration/staff-leak.test.ts`: distinctive hidden values, including one placed outside `spec.licence`, never appear in any raw `staff` response.
- [ ] 3.6 Sandbox test: the server under the Node.js permission model (read-only; no network where supported); every tool succeeds and fixture hashes do not change.

## 4. Documentation and agent skill

- [ ] 4.1 `docs/mcp.md`: what each tool answers, views, and configuration examples for Claude Code, Codex and Hermes, with and without `--view staff`.
- [ ] 4.2 `docs/catalogue-format.md`: the `Settings` document and the advice to keep prices in licence fields; add `Settings` to the kinds checked by `test/integration/docs.test.ts`.
- [ ] 4.3 `skills/stackledger/SKILL.md`: maintain a catalogue with an agent (add an item, link a licence, add a line, place a station, run `validate`), fictitious examples only.
- [ ] 4.4 README: Usage table (`stackledger mcp` available from source) and the AI agents section linking `docs/mcp.md` and the skill.
