# 7. Two views, built as separate sites

- Status: Accepted
- Date: 2026-10-20

## Context

A company may want every employee to see the map and which tools exist, without seeing what each licence costs or when it renews. The site is static ([ADR 5](0005-static-site-no-server.md)), so anything sent to a browser can be read there: hiding a field with CSS or JavaScript protects nothing.

## Options considered

1. One site that hides fields depending on who signed in.
2. One site per view, each holding only the data its readers may see, each behind its own proxy policy.
3. Many configurable roles.

## Decision

Option 2, with exactly two views:

| View | For | Contents |
|---|---|---|
| `full` | Owners, finance, IT | Everything |
| `staff` | Everyone else | The map, the software list, item pages, owners and relations; no cost, currency, cycle, renewal date, payer, seats, password-manager item or note |

`stackledger build` writes `site/full/` and `site/staff/`. The fields removed from `staff` have a default list that a catalogue can change in its `stackledger.yaml`. With Cloudflare Access, one policy protects `/full/*` for a finance group and another protects the rest for all staff ([ADR 6](0006-authentication-at-an-identity-aware-proxy.md)). The MCP server takes the same `--view` option ([ADR 8](0008-read-only-mcp-early-no-ai-in-the-core.md)).

## Consequences

- A hidden field is absent from every file of the `staff` site, search index and JSON included, so it cannot leak through the browser.
- Two builds instead of one; the cost is seconds.
- Exactly two views keeps the model simple. More roles would need a reason we do not have yet.
- Read access to the catalogue repository equals the `full` view; staff use the website.
- The views arrive with the `catalogue-site` change; see the [roadmap](../roadmap.md).
