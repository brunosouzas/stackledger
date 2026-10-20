# MCP server

`stackledger mcp` lets the AI agent you already use read your catalogue through the [Model Context Protocol](https://modelcontextprotocol.io/). It runs on your machine over stdio, only reads, makes no network calls and calls no AI model ([ADR 8](adr/0008-read-only-mcp-early-no-ai-in-the-core.md)). The examples here use the fictitious Northwind Studio.

## Run it

The package is not published to npm yet. From a clone, with Node.js 22 or later:

```sh
npm ci
npm run build
node dist/cli.js mcp /path/to/catalogue
node dist/cli.js mcp /path/to/catalogue --view staff
```

`stackledger mcp <folder> [--view full|staff]`:

- The folder is required, because MCP clients often start servers in `/` or the home folder. It is resolved to an absolute path at start.
- `--view` is `full` (the default) or `staff`.
- `--help` anywhere prints usage and exits 0. A missing folder argument, an unknown option, another view, two folders, or a folder that does not exist, is not a folder or cannot be read prints the reason and usage on stderr, nothing on stdout, and exits 2 before serving.
- The server stops with exit 0 when the client closes its input.
- stdout carries only protocol messages. stderr gets one line at start (folder, view, number of tools) and one line per failed tool call (tool and reason). Logs never contain catalogue values.

Every tool call reads and checks the folder again, so an agent that edits a YAML file sees its edit on the next call. The server keeps no state and no cache.

## Views

The two views are those of [ADR 7](adr/0007-two-views-built-as-separate-sites.md):

| View | Shows | Tools |
|---|---|---|
| `full` | Every field | `find_items`, `get_item`, `impact`, `gaps`, `renewals`, `validate` |
| `staff` | Components and licences rebuilt from allow-lists, without the hidden licence fields | `find_items`, `get_item`, `impact`, `gaps` |

In `staff`:

- A component keeps `apiVersion`, `kind`, the listed `metadata` fields (`name`, `namespace`, `title`, `description`, `labels`, `annotations`, `tags`), `spec.type`, `spec.lifecycle`, `spec.owner` and `spec.dependsOn`. Anything else, such as a `spec.licence` block on a component, is dropped.
- A licence keeps `apiVersion`, `kind`, the listed `metadata` fields, `spec.type`, `spec.owner` and the `spec.licence` fields that are not hidden. By default `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note` are hidden. A catalogue changes that list in a `Settings` document ([format](catalogue-format.md#settings-and-views)); a broken `Settings`, or YAML that could not be read, hides every licence field.
- Hidden fields are absent, not masked. Search does not match them, counts and order do not depend on them, and `renewals` and `validate` are not offered. Results carry no error counts, because problems can point at hidden fields.
- A licence with an error in any field, hidden ones included, is served in neither view.

Free text is not hidden: a price written in `metadata.description` or an annotation reaches `staff`. Keep prices and renewal terms in licence fields.

## What is served

Each call serves only documents that passed every document check, the secret scan included, and are not later duplicates. A document whose only errors come from cross-document rules (for example a `dependsOn` that matches nothing) is still served. A `Resource` that is not a licence, such as a database, is served as its reference and its `spec.type` only. `MapLayout` and `Settings` documents are not items. Only a component's `spec.dependsOn` creates a dependency.

## Tools

Every tool is marked read-only (`readOnlyHint: true`, `openWorldHint: false`) and declares an output schema. A result is one JSON object, sent as text and as structured content, with `catalogue`: `{ "view": "full", "errors": 1, "warnings": 0 }` in `full` (the counts `stackledger validate` gives) and `{ "view": "staff" }` in `staff`. The same call on unchanged files returns the same bytes.

References are `component:<name>`, `resource:<name>` or `line:<name>`, kind and name in any case, with an optional `default/` namespace. Results write the kind in lower case and the name as written in the catalogue. Lists are sorted by name by Unicode code point, ties component, resource, line, unless said otherwise.

| Tool | Arguments | Answers | Result |
|---|---|---|---|
| `find_items` | `query`, `kind` (`component`, `licence`, `resource`, `line`), `zone`, `limit` (1 to 200, default 50); all optional | "Which tools do we have from Northwind?" `query` matches, ignoring case, part of the name, title, description, a tag or a visible licence text field; for a resource that is not a licence, only its name. `zone` matches the `stackledger/zone` label ignoring case | `items` (each `ref`, `kind`, and when present `title`, `type`, `lifecycle`, `owner`, `zone`), `total` before the limit, `truncated` |
| `get_item` | `ref` | "What is this and what uses it?" | Component or licence: `metadata`, `spec`, `dependants`, `lines`; a component adds `zone`, `dependsOn` (matching items, file order) and `unresolved` (other references, as written). Line: `metadata`, `spec`, `stops`. Other resource: `ref`, `kind`, `type`, `dependants` |
| `impact` | `ref` of a component or resource | "What breaks if I remove it?" | `dependants`: every item depending on it directly or through others, each with its smallest `depth`, sorted by depth then reference, at most 500; `lines`: every line stopping at the item or a dependant; `truncated` |
| `gaps` | none | "What is loose?" | `isolated` (components with no dependency that matches an item and no dependant; line stops do not count), `offMap` (components on no line), `unusedLicences` |
| `renewals` (full only) | `days` (0 to 366, default 30), `from` (`YYYY-MM-DD`, default today on this machine) | "What renews this month?" | `from`, `to` (`from` plus `days`), `licences` renewing in the window, both ends included, and `overdue` (only `active` and `to-confirm` licences; each `ref`, `vendor`, `status`, `renewsOn`, `cycle`, `cost`, `currency`, sorted by date then reference), `unknown` (references whose `renewsOn` is `unknown`) |
| `validate` (full only) | none | "Is the YAML I wrote valid?" | The `problems` and `summary` of `stackledger validate --json` |

A failed call returns a tool error: a result marked `isError` with one text giving the reason, for example `No item matches component:ghost` or `limit must be an integer from 1 to 200`. Arguments of the wrong type, out of range or missing are tool errors, not protocol errors. If the folder disappears while the server runs, calls return `Catalogue folder was not found` and the server keeps answering.

## Client configuration

Use absolute paths: the client may start the server from any folder. Replace `/path/to/stackledger` with your clone and `/path/to/catalogue` with your catalogue folder. Add `--view staff` to serve the staff view, for example on a machine you hand to a colleague who should not see costs.

### Claude Code

```sh
claude mcp add stackledger -- node /path/to/stackledger/dist/cli.js mcp /path/to/catalogue
claude mcp add stackledger-staff -- node /path/to/stackledger/dist/cli.js mcp /path/to/catalogue --view staff
```

Add `--scope project` to write the server to `.mcp.json` in the project, which you can commit when the paths are the same for everyone:

```json
{
  "mcpServers": {
    "stackledger": {
      "command": "node",
      "args": ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue"]
    },
    "stackledger-staff": {
      "command": "node",
      "args": ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue", "--view", "staff"]
    }
  }
}
```

### Codex

```sh
codex mcp add stackledger -- node /path/to/stackledger/dist/cli.js mcp /path/to/catalogue
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.stackledger]
command = "node"
args = ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue"]

[mcp_servers.stackledger-staff]
command = "node"
args = ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue", "--view", "staff"]
```

### Hermes

In `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  stackledger:
    command: node
    args: ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue"]
  stackledger-staff:
    command: node
    args: ["/path/to/stackledger/dist/cli.js", "mcp", "/path/to/catalogue", "--view", "staff"]
```

Configure only the server a person should have: anyone who can run the `full` server, or read the catalogue folder, sees every field.

## Agent skill

[`skills/stackledger/SKILL.md`](../skills/stackledger/SKILL.md) teaches an agent to maintain a catalogue: add an item, link a licence, add a line, place a station, and check its work with `validate`. Copy it into your agent's skills folder.
