---
name: stackledger
description: "Use when maintaining a stackledger catalogue: adding a software item or licence, linking a licence to the software that uses it, drawing a journey line, placing a station on the map, or checking catalogue YAML with stackledger validate or the stackledger MCP tools."
---

# stackledger catalogue

A stackledger catalogue is a folder of YAML files in the Backstage format, kept in its own Git repository. You maintain it by editing those files, then checking them with `validate`. The full reference is [docs/catalogue-format.md](../../docs/catalogue-format.md); the MCP tools are in [docs/mcp.md](../../docs/mcp.md). The examples below describe the fictitious Northwind Studio.

## Rules

- **Never write a secret.** No password, token, API key, private key or card number, in any field. To say where a credential lives, name the password-manager item in `spec.licence.vaultItem` (for example `Northwind Editor subscription`).
- **Keep prices and renewal terms in licence fields** (`cost`, `currency`, `cycle`, `renewsOn`, `note`), never in `metadata.description`, titles, tags or annotations: the staff view hides licence fields, not free text.
- **Do not invent facts.** If you do not know a cost, a currency or a renewal date, write `unknown`. Never guess an owner: ask.
- **Names** are 1 to 63 ASCII letters, digits, `.`, `_` and `-`, starting and ending with a letter or digit, unique per kind ignoring case. Prefix licences with `licence-` by convention.
- **References** are `kind:name`: `component:editor`, `resource:licence-editor`. Always write the kind.
- **Check every edit** with `validate` (below) and fix every error before you finish. Warnings are allowed but read them.

## Before you edit

With the MCP server configured, ask it first instead of reading every file:

- `find_items` with a `query` to see whether the item already exists.
- `get_item` with a `ref` to see an item, what depends on it and its lines.
- `impact` before removing an item, to see what would break.
- `gaps` to find components on no line and licences nobody uses.

Without it, search the folder for `name: <name>`.

## Add a software item

Create one file per item, for example `apps/editor.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: editor
  title: Northwind Editor
  description: Shared document editor
spec:
  type: tool
  lifecycle: active
  owner: user:alex
```

`spec.type`, `spec.lifecycle` and `spec.owner` are required free text. To place it in a zone, add the label `stackledger/zone: <zone>` under `metadata.labels`; the zone must be declared in the `MapLayout`.

## Add a licence and link it

A licence is a `Resource` with `spec.type: licence`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: licence-editor
spec:
  type: licence
  owner: user:alex
  licence:
    vendor: Northwind Studio
    status: active
    cycle: yearly
    cost: 120
    currency: GBP
    renewsOn: 2027-06-30
    seats: 2
    paidBy: company
    vaultItem: Northwind Editor subscription
```

- `status`: `active`, `to-confirm`, `to-buy`, `cancelled` or `expired`.
- `cycle`: `monthly`, `yearly`, `one-off`, `none` or `unknown`.
- `cost`: a number of 0 or more, or `unknown`: the price of one `cycle` for the whole licence (all seats), as on the invoice. `currency`: three capital letters, or `unknown`.
- `renewsOn`: a real date `YYYY-MM-DD`, `not-applicable` or `unknown`.
- Only the fields above are allowed inside `spec.licence`; `renews_on` or `price` are errors.

Link it from the software that uses it, in the component's `spec.dependsOn`:

```yaml
spec:
  dependsOn: [resource:licence-editor]
```

Dependencies go on the component only: a licence's own `dependsOn` is ignored.

## Add a line

A line is a journey, an ordered list of components that a piece of work passes through, such as "ship a feature". It is not a category; categories are zones.

```yaml
apiVersion: stackledger/v1alpha1
kind: Line
metadata:
  name: ship
  title: Ship a feature
spec:
  code: S
  color: '#4466FF'
  stops: [component:editor, component:forge]
```

At least two stops, each an existing component, each at most once. Quote the colour: `#` starts a YAML comment.

## Place a station

There is one `MapLayout` per catalogue. Give each stop a free `[column, row]` cell of non-negative integers under `spec.stations`:

```yaml
apiVersion: stackledger/v1alpha1
kind: MapLayout
metadata:
  name: northwind
spec:
  stations:
    component:editor: [0, 0]
    component:forge: [2, 0]
  zones:
    - name: delivery
      title: Delivery
      color: '#4466FF'
```

Two stations cannot share a cell. A stop without a position, or a position for a component on no line, is a warning.

## Validate

Run one of these after every edit:

- MCP: call the `validate` tool (offered in the `full` view only).
- Command line, from a stackledger clone: `node dist/cli.js validate /path/to/catalogue`.

Each problem is `<path>:<line>:<column> <error|warning> <field> <message>`. Exit code 0 means no errors, 1 means errors, 2 means the command or the folder is wrong. Fix the errors, run it again, and report what you changed and the final counts.

To check the costs, print the licence report: `node dist/cli.js report /path/to/catalogue` (renewals in the next 90 days, cost per month and year per currency, and the licences whose cost, currency or cycle is `unknown`; see [docs/reports.md](../../docs/reports.md)).

To see the result as the website, build both sites into a folder outside the catalogue: `node dist/cli.js build /path/to/catalogue --out /path/to/out`. It needs no network; publish only `full/`, `staff/`, `_headers` and `robots.txt` from it ([docs/site.md](../../docs/site.md)).
