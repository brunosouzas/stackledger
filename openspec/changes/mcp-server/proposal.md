# Proposal: mcp-server

## Why

People already work with AI agents, and the main user of stackledger uses one every day. An agent that can ask "what depends on this app?", "what breaks if I remove it?" or "what renews this month?", and check the YAML it writes, is useful long before the map and the website exist. [ADR 8](../../../docs/adr/0008-read-only-mcp-early-no-ai-in-the-core.md) moved this change to second place for that reason. [ADR 7](../../../docs/adr/0007-two-views-built-as-separate-sites.md) requires every consumer of the catalogue to respect the `full` and `staff` views, so this change also introduces the views, which the website will reuse.

## What Changes

- Add `stackledger mcp [folder] [--view full|staff]`: a read-only [Model Context Protocol](https://modelcontextprotocol.io/) server over stdio. Its tools find items, show one item with its relations, show what breaks if an item is removed, list renewals in the next N days, list gaps (items with no relation, on no journey, licences nobody uses) and validate the catalogue.
- Add the two views. `full` shows everything. `staff` removes a list of fields, by default the licence's cost, currency, cycle, renewal date, payer, seats, password-manager item and note. A catalogue can replace that list in a new `Settings` document, kept by convention in `stackledger.yaml`.
- Add a `Settings` kind (`stackledger/v1alpha1`) to the catalogue format. This modifies the "Supported kinds" requirement of the `catalogue` spec.
- Ship an agent skill (`skills/stackledger/SKILL.md`) that teaches an agent to maintain a catalogue: add an item, link a licence, draw a line, place a station, and run `validate`.
- Add the official MCP TypeScript SDK as a dependency.

## Capabilities

### New Capabilities

- `catalogue-views`: what the `full` and `staff` views contain, how the hidden fields are configured, and the guarantee that a hidden value never reaches a `staff` consumer.
- `mcp-server`: the `stackledger mcp` command, its tools, their inputs and outputs, and its read-only behaviour.

### Modified Capabilities

- `catalogue`: "Supported kinds" adds `stackledger/v1alpha1` `Settings`; a new requirement defines the `Settings` document.

## Impact

- New code: views, the relation queries (dependants, impact, renewals, gaps) and the MCP server; the queries are written as a library so the website can reuse them.
- New dependency: `@modelcontextprotocol/sdk` (MIT).
- Documentation: README (Usage, AI agents), `docs/catalogue-format.md` (`Settings`), a new `docs/mcp.md` with client set-up examples, and the agent skill.
- No change to existing `validate` behaviour except accepting the new `Settings` kind.

## Out of scope

- A remote MCP server over HTTP, authentication for it, and tools that write or propose edits (later in the roadmap).
- MCP resources and prompts; this change exposes tools only.
- Any AI model call from stackledger.
- More than two views, or per-person rules.
- Watching files for changes; each tool call reads the folder again.
- The website and the reports (changes `catalogue-site` and `licence-reports`), which will reuse the views and queries.

## Implicit requirements

- **Errors and invalid input:** requirement. Usage errors stop the command before serving, with exit 2. A tool with a bad argument or an unknown item returns a tool error, not a crash. A catalogue with errors is still served from its usable documents, and every tool result says how many errors the catalogue has.
- **Limits:** requirement. `find_items` returns at most 200 items (default 50); `impact` stops at 500 items; `renewals` accepts 0 to 366 days. Results that hit a limit say so.
- **Repetition and idempotency:** requirement. Tools only read; the same call on unchanged files gives the same result, sorted.
- **Concurrency:** n/a. Each call reads the folder on its own; the server keeps no state between calls.
- **Security:** requirement. No tool writes files or uses the network. In the `staff` view no hidden value appears in any tool result, search does not match on hidden fields, and tools that need hidden fields (`renewals`, `validate`) are not offered. Logs go to stderr and never contain catalogue values.
- **Logs and observability:** requirement. One stderr line when the server starts (folder, view, tool count) and one per failed call; stdout carries only the protocol.

## Open questions

Both answered by the owner on 2026-10-20: the default view is `full`, and `note` is hidden in `staff` by default.

1. **Default view when `--view` is omitted.** Recommended: `full`, because whoever runs the server locally already reads the catalogue folder, which is the `full` view by [ADR 2](../../../docs/adr/0002-catalogue-in-backstage-format-in-its-own-repository.md). The alternative, `staff` by default, is safer when a company hands the command to staff, at the cost of one flag for the owner.
2. **Is `note` hidden in `staff` by default?** Recommended: yes. Notes often mention prices or renewal terms. ADR 7 lists the other fields; this adds `note`.

## Documentation

- `README.md`: Usage table (`stackledger mcp` available) and the AI agents section.
- `docs/catalogue-format.md`: the `Settings` document.
- `docs/mcp.md` (new): tools, views and client configuration examples (Claude, Codex, Hermes).
- `docs/roadmap.md`: mark change 2 delivered after merge.
- `skills/stackledger/SKILL.md` (new).
- Brain vault: `10-personal/projects/stackledger/_index.md`, status line.
