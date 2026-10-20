# Catalogue format

A catalogue is a local folder of `.yaml` and `.yml` files, searched recursively. Keep real inventory in a separate, private repository: it can reveal your attack surface. The examples here describe the fictitious Northwind Studio.

## Validate a folder

Requires Node.js 22 or later. From this checkout:

```sh
npm ci
npm run build
npm test
node dist/cli.js validate test/fixtures/demo
node dist/cli.js validate /path/to/catalogue --json
```

The npm executable is `stackledger validate [folder] [--json]`; the folder defaults to the current directory. `--help` anywhere prints usage and succeeds, even with otherwise invalid arguments. The package is not yet published to npm.

Validation reads only: no writes, network requests or telemetry. Exit codes are **0** for no errors (warnings allowed), **1** for catalogue errors, and **2** for usage errors or an absent, unreadable or non-directory root. Exit 2 leaves stdout empty and reports the reason and usage on stderr.

Text problems are `<path>:<line>:<column> <error|warning> <field> <message>`, followed by `files`, `documents`, `ignored`, `errors` and `warnings` counts. Paths are relative with `/` separators. JSON output is one object with `problems` and `summary`, containing the same fields and counts. Problems sort by Unicode code-point path, line, column, field, severity (error first), then message.

Positions are one-based. Values point at their value; secret keys, unknown fields and station references point at the key. Missing fields point at the document mapping's start; unread files point at 1:1. Field paths join keys with dots and list indexes with `[n]`. Keys outside ASCII letters, digits, `-` and `_` use a bracketed JSON string, for example `metadata.labels["stackledger/zone"]`. Whole-file/document problems use `-` in text and `null` in JSON.

## Files and document order

- `.git` and `node_modules` directories and non-YAML files are skipped.
- Every symbolic link gets a warning and is never followed, including broken links and links inside the folder.
- Files exceeding 1 MiB get an error without being read. Unreadable files or subfolders get errors; other files still run.
- Use `---` between documents. Empty/comment-only documents, including a trailing separator, are skipped silently.
- A syntax error or duplicate YAML key invalidates the entire file; none of its documents is checked. Non-mapping documents get errors.
- Documents sort by relative file path (Unicode code points), then position in the file. Mapping/list entries retain their source order.
- `files` counts regular YAML files found, even unread/oversized ones. `ignored` counts ignored kinds and non-licence resources. `documents` counts other documents read; skipped empties count nowhere.

## Identity and Backstage compatibility

Every checked document has `apiVersion`, `kind`, and `metadata.name`. A name is 1–63 ASCII letters/digits, dots, underscores or hyphens, with an alphanumeric first and last character. Names are unique within a kind ignoring case. Later duplicates get an error naming the earlier file; only the earlier identity is used by cross-document rules.

| Kind (case-sensitive) | Required apiVersion | Meaning |
| --- | --- | --- |
| `Component` | `backstage.io/v1alpha1` | Software item |
| `Resource` | `backstage.io/v1alpha1` | Licence when `spec.type` is exactly `licence` |
| `Line` | `stackledger/v1alpha1` | Ordered journey through components |
| `MapLayout` | `stackledger/v1alpha1` | Station positions and zones |

Any other pair is an error, except `System`, `API`, `Group`, `User`, `Domain`, `Location` and `Template`: these are counted as ignored regardless of apiVersion, without checking names, fields or secrets.

A Resource requires a non-empty string `spec.type`. Other types such as `database` are ignored after identity, but remain reference targets. `license` and non-exact case variants of `licence` also warn that they are not read as licences.

`metadata.namespace` is optional. Any value other than exactly `default` warns and is treated as `default`.

For each document, checks run in order: kind present; ignored kind (stop); supported pair; name; non-licence Resource (stop); kind fields; secret scan. An error stops the remaining stages. Cross-document checks run last on documents that passed identity, excluding later duplicates.

**Backstage location rules:** when Backstage reads the same folder, configure its location rules to allow only `Component` and `Resource`, or keep `Line` and `MapLayout` in a subfolder Backstage does not read. Their stackledger apiVersion is not a native Backstage kind.

## Components

| Field | Rule |
| --- | --- |
| `metadata.name` | Required identity name as above |
| `metadata.namespace` | Optional; non-default warns |
| `metadata.title`, `metadata.description` | Optional non-empty strings |
| `metadata.labels`, `metadata.annotations` | Optional mappings of string keys to string values |
| `metadata.tags` | Optional list of strings |
| `spec.type`, `spec.lifecycle`, `spec.owner` | Required non-empty strings; free text, e.g. `tool`, `active`, `user:alex` |
| `spec.dependsOn` | Optional list of entity references |
| `metadata.labels["stackledger/zone"]` | Optional zone membership; must match a declared zone ignoring case |

Unlisted Component fields are accepted and ignored (for example `metadata.links`, `spec.system`, `spec.providesApis` and other Backstage relations). They still participate in the secret scan.

A reference is `kind:name` or `kind:namespace/name`. Kinds and target names match ignoring case. Omitting the kind is an error. In `dependsOn`, component/resource targets must exist and have passed identity, including ignored non-licence resources. Other kinds and non-default namespaces warn that the reference is not checked. Only `default` is supported in stops and station keys; other namespaces there are errors.

## Licences

A licence is a Resource with `spec.type: licence`. It accepts the same metadata types as a Component. A component uses it through `spec.dependsOn: [resource:<name>]`.

| Field | Rule |
| --- | --- |
| `spec.owner` | Required non-empty string |
| `spec.licence` | Required object; unlisted fields are errors |
| `spec.licence.vendor` | Required non-empty string |
| `spec.licence.status` | Exactly `active`, `to-confirm`, `to-buy`, `cancelled` or `expired` |
| `spec.licence.cycle` | Exactly `monthly`, `yearly`, `one-off`, `none` or `unknown` |
| `spec.licence.cost` | Required number ≥0, or `unknown` |
| `spec.licence.currency` | Required three capital ASCII letters, or `unknown` |
| `spec.licence.renewsOn` | Required real calendar date `YYYY-MM-DD`, `not-applicable` or `unknown` |
| `spec.licence.seats` | Optional integer ≥1 |
| `spec.licence.paidBy`, `spec.licence.vaultItem`, `spec.licence.note` | Optional non-empty strings |

All Resource fields outside `spec.licence` accept Backstage extensions, including `spec.lifecycle` with no rule. Use camelCase `renewsOn`, not `renews_on`. Use `paidBy` for who pays; no `owner_scope` or licence `kind`. Use `cancelled`, not `retired`. A `vaultItem` names an item in a password manager; it never holds the credential itself.

## Lines

Unlisted fields anywhere in a Line are errors.

| Field | Rule |
| --- | --- |
| `metadata.name`, `metadata.namespace` | Identity and namespace rules above |
| `metadata.title` | Optional non-empty string |
| `spec.color` | Required `#` plus six hexadecimal digits (any case) |
| `spec.code` | Optional 1–3 ASCII letters/digits; unique among lines ignoring case |
| `spec.stops` | Required list of at least two component references; each target must exist |

A component may appear only once in a line, even under a different case or explicit default namespace. Two lines sharing a colour ignoring case warn on the later line. Shared codes are errors naming the earlier line. Circle lines are not supported.

## Map layout and zones

At most one MapLayout is allowed. A later layout gets an error and none of its positions/zones is used. Unlisted fields anywhere in a MapLayout are errors.

| Field | Rule |
| --- | --- |
| `metadata.name`, `metadata.namespace` | Identity and namespace rules above |
| `spec.stations` | Required mapping of component references to `[column, row]`, exactly two non-negative integers |
| `spec.zones` | Optional list of zone objects |
| `spec.zones[n].name` | Required non-empty string, unique among zones ignoring case |
| `spec.zones[n].title` | Required non-empty string |
| `spec.zones[n].color` | Required `#` plus six hexadecimal digits |

Station references must match existing components. Two entries cannot occupy the same cell; the later entry gets an error naming the earlier one. A component on a line without a position warns once at its first stop: the map will place it. With no layout, each distinct stop still warns once. A positioned component not on any line warns at its station key: the map will not show it. Zone labels must name a zone in the earliest layout, compared ignoring case.

## Secret and personal-data guard

After kind-field checks pass, every key/value in checked documents is scanned, including accepted Backstage extensions. These are **errors** (messages never include the detected value):

- A key, or the part after its last `/`, equal to `password`, `secret`, `token`, `apikey` or `privatekey`, ignoring case, `-` and `_`.
- Text containing `-----BEGIN` and then `PRIVATE KEY-----` on the same line.
- A run of 13–19 digits that passes Luhn, allowing single spaces/hyphens between digits but no adjacent digit, quoted or not. Invalid field types still fail their field check before the scan.

An e-mail address in a value is a **warning**, not an error: a vendor support address may be legitimate. The address is not repeated in the message. Ignored documents are not scanned.

This guard is not a guarantee. Also run a secret scanner such as **gitleaks in the catalogue repository**. Never commit real credentials or payment-card data; reference a password-manager item instead.

## Complete example

Each supported kind appears below. This is one self-contained catalogue; split it into files or retain the multi-document form.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: editor
  title: Northwind Editor
  labels:
    stackledger/zone: delivery
spec:
  type: tool
  lifecycle: active
  owner: user:alex
  dependsOn: [resource:licence-editor]
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: forge
spec:
  type: service
  lifecycle: active
  owner: group:delivery
---
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
    note: Fictitious licence for the example
---
apiVersion: stackledger/v1alpha1
kind: Line
metadata:
  name: ship
  title: Ship a feature
spec:
  code: S
  color: '#4466FF'
  stops: [component:editor, component:forge]
---
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
