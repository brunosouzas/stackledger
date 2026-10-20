# Design: mcp-server

## Context

`catalogue-model` delivered a library (`validateFolder` returns the valid entities and the problems) and the `validate` command. This change adds the first consumer of the catalogue beyond validation. It relies on [ADR 7](../../../docs/adr/0007-two-views-built-as-separate-sites.md) (two views, hidden fields removed, never masked), [ADR 8](../../../docs/adr/0008-read-only-mcp-early-no-ai-in-the-core.md) (read-only MCP over stdio, no AI in the core) and [ADR 9](../../../docs/adr/0009-typescript-end-to-end.md).

## Goals / Non-goals

Goals: answer the questions an owner asks an agent about their stack; make the views a library the website will reuse; keep the server stateless and read-only.

Non-goals: HTTP transport, authentication, writing tools, MCP resources or prompts, file watching.

## Decisions

### D1. Layers: view, graph, tools

```mermaid
flowchart LR
    folder["Catalogue folder"] --> validate["validateFolder()"]
    validate --> view["applyView(catalogue, view)"]
    view --> graph["buildGraph()"]
    graph --> tools["MCP tools"]
    view --> tools
```

- `src/views.ts`: `resolveHidden(catalogue)` reads the `Settings` document and returns the hidden list; `applyView(entities, view, hidden)` returns deep copies with hidden `spec.licence` fields deleted. Every consumer gets entities only through `applyView`, so a tool cannot see a hidden value even by mistake.
- `src/graph.ts`: indexes by reference, `dependsOn`, `dependants`, `linesAt`, `impact` (breadth-first search with a visited set, cap 500), `gaps`. Pure functions over view entities; the website will reuse them.
- `src/mcp.ts`: the server, tool registration per view and the result envelope.

Alternative rejected: filtering hidden fields in each tool's output. One forgotten field leaks; deleting before any tool sees the data makes leaking structurally impossible.

### D2. Official SDK, stdio only

`@modelcontextprotocol/sdk` (MIT), `McpServer` with `StdioServerTransport`; input schemas in zod, which the project already uses. The SDK is pinned to an exact version like the other dependencies. Tool annotations set `readOnlyHint: true`, `openWorldHint: false`.

### D3. Results are JSON

Each tool returns one JSON object as text content and as `structuredContent`, with an `outputSchema`. Agents read JSON reliably and tests can compare objects. Lists are sorted (by reference, or as each requirement says), so the same call on the same files gives the same bytes.

### D4. Read the folder on every call

No cache and no watcher. A personal or small-company catalogue is under a few hundred files; `validate` on 82 real files takes well under a second. Reading on each call means an agent that edits YAML and calls a tool sees its own edit, and the server holds no state.

### D5. Tools per view

`renewals` and `validate` are not registered in the `staff` view. `renewals` is about hidden fields by nature. `validate` problems point at hidden fields and staff do not maintain the catalogue. Not registering is clearer to a client than registering a tool that always fails.

### D6. Settings as a new kind

The hidden-field list must live in the catalogue repository (ADR 7). A `Settings` document of `apiVersion: stackledger/v1alpha1` keeps one file format and reuses the loader, positions and error reporting. Its schema is strict. The name `stackledger.yaml` is a convention only, so the loader stays "every YAML file in the folder". An invalid `Settings` falls back to the default list: it errs on the side of hiding.

### D7. Default view `full` (open question 1)

Whoever runs `stackledger mcp` locally already has the folder, which is the `full` view by ADR 2. A company that gives the server to staff passes `--view staff` in the client configuration; `docs/mcp.md` shows both.

### D8. CLI

`src/cli.ts` dispatches `validate` and `mcp`; each command has its own `parseArgs` options. Global `--help` keeps printing the combined usage. The folder is checked before the transport starts so that exit 2 happens before any protocol output.

### D9. Tests

- Unit: `views`, `graph` (cycles, depth, cap, gaps), settings rules.
- Integration: start `dist/cli.js mcp` as a child process and talk to it with the SDK's `Client` and `StdioClientTransport`; one test per scenario.
- Leak test: a fixture with distinctive hidden values (for example cost `98765`, note `ZETA-NOTE`); call every staff tool with several arguments and assert none of the values appears in any raw response.
- Sandbox: the same child process under `node --permission --allow-fs-read=<dist,node_modules,fixture>`; all tools succeed, fixture hashes unchanged.

## Risks / Trade-offs

- **Free-text fields can still mention prices** (`metadata.description`, annotations). Hiding works on licence fields only. Mitigation: `docs/catalogue-format.md` says to keep prices and terms in licence fields, and `note` is hidden by default.
- **SDK churn.** The SDK moves fast; pinning and the integration tests catch breaking upgrades.
- **Large catalogues.** Re-reading on every call is linear in files; fine for the target size. Caching can come later without changing the tool contract.
