# 8. A read-only MCP server comes early; no AI model inside the core

- Status: Accepted
- Date: 2026-10-20

## Context

Many people, the main user included, already work with AI agents (Claude, Codex, Hermes). An agent that can ask "what depends on this app?" or "what renews this month?" is useful long before the map exists. Calling an AI model from stackledger itself would add cost, a network dependency and a privacy question, since catalogue data would leave the machine.

## Options considered

1. Call an AI model from stackledger (for example, to describe unknown apps).
2. Expose the catalogue through the [Model Context Protocol](https://modelcontextprotocol.io/) so people use their own agent, and keep the core free of model calls.
3. Leave AI integration to the end of the roadmap.

## Decision

Option 2, delivered right after the catalogue format. The MCP server runs locally over stdio and only reads. Its tools find an item, list what depends on an item, show what breaks if an item is removed, list renewals in the next N days, list gaps (items with no relation, on no journey, licences nobody uses), and validate a catalogue so an agent can check the YAML it wrote. It takes `--view staff` to serve only what the staff view shows ([ADR 7](0007-two-views-built-as-separate-sites.md)). The repository also ships an agent skill that teaches an agent to maintain a catalogue.

## Consequences

- stackledger is ready for AI without depending on it: no model calls, no API keys, no data leaving the machine.
- An agent edits the catalogue as files; the `validate` tool and pull requests check its work.
- A remote MCP server (over HTTP, behind the proxy of [ADR 6](0006-authentication-at-an-identity-aware-proxy.md)) and a tool that proposes edits are later in the roadmap.
