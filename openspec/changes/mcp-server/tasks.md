## 1. Settings and views

- [ ] 1.1 Add the `Settings` kind to the schemas and the validator (supported pair, at most one, strict fields, allowed and unique hide names); tests for every scenario of the `catalogue` delta in `test/unit/settings.test.ts`.
- [ ] 1.2 Add `src/views.ts` (`resolveHidden`, `applyView`) with the default list; tests for every `catalogue-views` scenario in `test/unit/views.test.ts`.

## 2. Graph queries

- [ ] 2.1 Add `src/graph.ts`: reference parsing and lookup, `dependsOn`, `dependants`, `linesAt`, `impact` (visited set, depth, cap 500), `gaps`, renewals window; unit tests in `test/unit/graph.test.ts` for chains, cycles, the cap, gaps and window edges.

## 3. MCP server

- [ ] 3.1 Add `@modelcontextprotocol/sdk` at an exact version; record it in `package-lock.json`; `npm audit` clean.
- [ ] 3.2 Add `src/mcp.ts` with the six tools, input and output schemas, read-only annotations, the result envelope, tool errors and stderr logs; register tools per view.
- [ ] 3.3 Extend `src/cli.ts` with the `mcp` command, its options and usage errors; keep every `validate-command` scenario passing.
- [ ] 3.4 Integration tests in `test/integration/mcp.test.ts`: one test per `mcp-server` scenario, through the SDK client over stdio against the built CLI.
- [ ] 3.5 Leak test in `test/integration/staff-leak.test.ts`: distinctive hidden values never appear in any raw `staff` response.
- [ ] 3.6 Sandbox test: the server under the Node.js permission model (read-only, no network); every tool succeeds and fixture hashes do not change.

## 4. Documentation and agent skill

- [ ] 4.1 `docs/mcp.md`: what each tool answers, views, and configuration examples for Claude Code, Codex and Hermes, with and without `--view staff`.
- [ ] 4.2 `docs/catalogue-format.md`: the `Settings` document and the advice to keep prices in licence fields.
- [ ] 4.3 `skills/stackledger/SKILL.md`: maintain a catalogue with an agent (add an item, link a licence, add a line, place a station, run `validate`), fictitious examples only.
- [ ] 4.4 README: Usage table (`stackledger mcp` available from source) and the AI agents section linking `docs/mcp.md` and the skill.
