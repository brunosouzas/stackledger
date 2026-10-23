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

To let an AI agent query the catalogue, see the [MCP server](mcp.md).

The npm executable is `stackledger validate [folder] [--json]`; the folder defaults to the current directory. `--help` anywhere prints usage and succeeds, even with otherwise invalid arguments. The package is not yet published to npm.

Validation reads only: no writes, network requests or telemetry. Exit codes are **0** for no errors (warnings allowed), **1** for catalogue errors, and **2** for usage errors or an absent, unreadable or non-directory root. Exit 2 leaves stdout empty and reports the reason and usage on stderr.

Text problems are `<path>:<line>:<column> <error|warning> <field> <message>`, followed by `files`, `documents`, `ignored`, `errors` and `warnings` counts. Paths are relative with `/` separators. JSON output is one object with `problems` and `summary`, containing the same fields and counts. Problems sort by Unicode code-point path, line, column, field, severity (error first), then message.

Positions are one-based. Values point at their value; secret keys, unknown fields and station references point at the key. Missing fields point at the document mapping's start; unread files point at 1:1. Field paths join keys with dots and list indexes with `[n]`. Keys outside ASCII letters, digits, `-` and `_` use a bracketed JSON string, for example `metadata.labels["stackledger/zone"]`. Inside the brackets, characters U+0000 to U+001F and U+007F to U+009F are always written as `\u` escapes, in text and JSON output, so a hostile annotation key can neither break a line nor send a terminal escape. Whole-file/document problems use `-` in text and `null` in JSON.

## Files and document order

- Folders whose name starts with `.` (`.git`, `.github`, `.vscode`…) and `node_modules` folders are skipped, as are non-YAML files. The folder you pass is read whatever its name, and a YAML file whose own name starts with `.` is read. Up to 0.3.0 only `.git` was skipped, so a catalogue kept at the top of a repository read `.github/workflows/*.yml` and reported `kind is required`; later releases skip every hidden folder.
- A file named exactly `stackledger-skills.yaml` is never read: it is a [skills map file](skills.md#the-skills-map-file), so a skills repository can hold the catalogue. Since 0.3.0; a catalogue that used this name for its own documents must rename the file.
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
| `Settings` | `stackledger/v1alpha1` | Fields hidden from the staff view; the site's title and colours |

Any other pair is an error, except `System`, `API`, `Group`, `User`, `Domain`, `Location` and `Template`: these are counted as ignored regardless of apiVersion, without checking names, fields or secrets. The one use of them is the [site](site.md#pages): it shows an owner such as `group:northwind` by the title of the `Group` or `User` document of that name, when that document has apiVersion `backstage.io/v1alpha1`, a valid name and nothing the secret scan rejects.

A Resource requires a non-empty string `spec.type`. Other types such as `database` are ignored after identity, but remain reference targets. `license` and non-exact case variants of `licence` also warn that they are not read as licences.

`metadata.namespace` is optional. Any value other than exactly `default` warns and is treated as `default`.

For each document, checks run in order: kind present; ignored kind (stop); supported pair; name; non-licence Resource (stop); kind fields; secret scan. An error stops the remaining stages. Cross-document checks run last on documents that passed identity, excluding later duplicates.

**Backstage location rules:** when Backstage reads the same folder, configure its location rules to allow only `Component` and `Resource`, or keep `Line`, `MapLayout` and `Settings` in a subfolder Backstage does not read. Their stackledger apiVersion is not a native Backstage kind.

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

## Discovery annotations

`stackledger drift` ([docs/discovery.md](discovery.md)) matches what is installed on a Mac to components only through these annotations, never through names or titles. Each key names one discovery source; its value is a list of identifiers separated by commas, with spaces around each one ignored.

| Key | Identifier | Compared |
| --- | --- | --- |
| `stackledger/brew` | Homebrew formula full name: `git`, or `northwind/tools/ledger` for a tap formula | Exactly |
| `stackledger/cask` | Homebrew cask full token | Exactly |
| `stackledger/mas` | App Store identifier (digits); quote it, or YAML reads a number and the field is an error | Exactly |
| `stackledger/app` | Bundle identifier (`CFBundleIdentifier`) | Ignoring ASCII case |
| `stackledger/launchd` | launchd job `Label` | Exactly |
| `stackledger/mise` | mise tool name | Exactly |
| `stackledger/npm` | Global npm package name | Exactly |
| `stackledger/pipx` | pipx package name | Lower case, each run of `-`, `_` and `.` read as one `-` |

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: editor
  title: Northwind Editor
  annotations:
    stackledger/cask: northwind-editor
    stackledger/app: com.northwind.editor
    stackledger/launchd: com.northwind.sync, com.northwind.helper
    stackledger/mas: "1234567890"
spec:
  type: tool
  lifecycle: active
  owner: user:alex
```

These are **warnings**, never errors:

- A key that starts with `stackledger/` but is none of the eight above, for example `stackledger/brews`. The warning is on the key and names the allowed keys. `stackledger/zone` is a label, not an annotation, and is not affected.
- An empty identifier in the list, such as `git,,gh`, a trailing comma or a blank value. The other identifiers are still read.
- An identifier that an earlier component, in document order, already lists for the same source, compared as drift compares them. The later component gets the warning, naming the earlier one. The same identifier for two sources (`stackledger/brew: forge` and `stackledger/npm: forge`) is fine.

Only components that passed every check are read for discovery; annotations on other kinds are not. An identifier with a comma, a control character or white space at either end cannot be written here; drift lists such an item with the note `cannot be annotated`.

## Licences

A licence is a Resource with `spec.type: licence`. It accepts the same metadata types as a Component. A component uses it through `spec.dependsOn: [resource:<name>]`.

| Field | Rule |
| --- | --- |
| `spec.owner` | Required non-empty string |
| `spec.licence` | Required object; unlisted fields are errors |
| `spec.licence.vendor` | Required non-empty string |
| `spec.licence.status` | Exactly `active`, `to-confirm`, `to-buy`, `cancelled` or `expired` |
| `spec.licence.cycle` | Exactly `monthly`, `yearly`, `one-off`, `none` or `unknown` |
| `spec.licence.cost` | Required number ≥0, or `unknown`: the price of one cycle for the whole licence (all seats), as on the invoice |
| `spec.licence.currency` | Required three capital ASCII letters, or `unknown` |
| `spec.licence.renewsOn` | Required real calendar date `YYYY-MM-DD`, `not-applicable` or `unknown` |
| `spec.licence.seats` | Optional integer ≥1 |
| `spec.licence.paidBy`, `spec.licence.vaultItem`, `spec.licence.note` | Optional non-empty strings |

All Resource fields outside `spec.licence` accept Backstage extensions, including `spec.lifecycle` with no rule. Use camelCase `renewsOn`, not `renews_on`. Use `paidBy` for who pays; no `owner_scope` or licence `kind`. Use `cancelled`, not `retired`. A `vaultItem` names an item in a password manager; it never holds the credential itself.

`cost` is what one `cycle` costs for the whole licence: a `monthly` licence for 3 seats at 10 per seat has `cost: 30`, and `seats` never multiplies it. The [licence reports](reports.md) count `monthly` costs 12 times a year, `yearly` costs a twelfth a month, `none` as zero and `one-off` costs apart, one total per `currency` without conversion.

## Lines

See [the map guide](map.md) for routing, terminal badges and how journeys are drawn.

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

See [the map guide](map.md) for grid units, zone areas, conflicts and suggested positions.

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

## Settings and views

stackledger has two views ([ADR 7](adr/0007-two-views-built-as-separate-sites.md)): `full` shows every field, and `staff` drops licence fields so that everyone can see the software without seeing what it costs. By default `staff` hides `cost`, `currency`, `cycle`, `renewsOn`, `paidBy`, `seats`, `vaultItem` and `note`. One `Settings` document changes that list. Keep it by convention in `stackledger.yaml` at the top of the catalogue; any file name works.

```yaml
apiVersion: stackledger/v1alpha1
kind: Settings
metadata:
  name: settings
spec:
  views:
    staff:
      hide: [cost, currency, renewsOn, paidBy, vaultItem, note]
  site:
    title: Northwind software
    colors:
      accent: '#E4002B'
```

| Field | Rule |
| --- | --- |
| `metadata.name`, `metadata.namespace` | Identity and namespace rules above |
| `metadata.title` | Optional non-empty string |
| `spec` | Required mapping; may be empty (`spec: {}`) |
| `spec.views.staff.hide` | Optional list of licence field names without repeats, each one of `vendor`, `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`, `vaultItem` and `note` |
| `spec.site.title` | Optional title of both [sites](site.md), a non-empty string of at most 60 characters; default `Software map` |
| `spec.site.colors` | Optional mapping with any of `primary`, `accent`, `body` and `text`, each `#` and six hexadecimal digits (quote it: `#` starts a YAML comment). They replace the matching colours of the light theme only; the dark theme keeps its own |
| `spec.skills.folders` | Optional list of 1 to 20 skills folders for `stackledger build`, without repeats, each relative to the catalogue folder (`..` allowed; no leading `/`, `\\` or `~`, and no drive letter such as `C:`). `--skills` replaces it. From 0.3.0; 0.2.0 reads it as an error: pin one version everywhere. See [Skills on the site](../README.md#skills-on-the-site) |
| `spec.sites` | Optional list of the sites `stackledger build` writes: `[full]` (personal mode) or `[full, staff]` (corporate mode, the default), in any order, without repeats. `[staff]` alone, an empty list or any other value is an error |

Unlisted fields anywhere in a Settings document are errors, so `spec.view` instead of `spec.views` is reported, and so is `spec.site.logo`. While the Settings document has an error, the sites use the default title and colours. When `hide` is given it replaces the default list entirely: `[cost]` hides only the cost, and `[]` hides nothing. Without `hide`, the default list applies.

**Personal or corporate.** Without `spec.sites`, `stackledger build` writes both sites: the corporate mode, where finance reads `full` and everyone else `staff`. When you are the only reader, `sites: [full]` is the personal mode: only the `full` site is built and published, and `/` leads to it. While the Settings document has an error, the build uses the default and writes both sites. See [docs/hosting.md](hosting.md) for the access setup of each mode.

At most one Settings document is allowed; the earliest is used. A later one with another name gets an error naming the earlier file; one with the same name gets only the duplicate-name error.

**Broken settings hide everything.** While any document whose kind is `Settings` in any case has an error, or any file named `stackledger.yaml` or `stackledger.yml` has an error, the `staff` view hides every licence field above, until it is fixed. A document that reads as `Settings` in a file with a YAML syntax error, or that cannot be expanded, counts too. A typo can never hide less than you asked for. Keep the document in `stackledger.yaml`: any error in that file, even one that stops it from being read at all (too large, unreadable), also hides everything, whereas a broken file of another name is recognised only on a best-effort reading of its `kind`, and a symbolic link is never followed.

In `staff`, components and licences are rebuilt from the fields this reference lists, so a field written in the wrong place (for example `spec.cost` next to `spec.licence`, or a `spec.licence` block on a component) never reaches staff. Free text is not filtered: **keep prices, renewal terms and payment details in licence fields**, not in `metadata.description`, annotations, tags or titles, which staff can read.

## Secret and personal-data guard

After kind-field checks pass, every key/value in checked documents is scanned, including accepted Backstage extensions. These are **errors** (messages never include the detected value):

- A key, or the part after its last `/`, equal to `password`, `secret`, `token`, `apikey` or `privatekey`, ignoring case, `-` and `_`.
- Text containing `-----BEGIN` and then `PRIVATE KEY-----` on the same line.
- A run of 13–19 digits that passes Luhn, allowing single spaces/hyphens between digits but no adjacent digit, quoted or not. Invalid field types still fail their field check before the scan.

An e-mail address in a value is a **warning**, not an error: a vendor support address may be legitimate. The domain must end in a label of two or more letters, so a versioned Homebrew name such as `python@3.12` is not taken for an address. The address is not repeated in the message. Ignored documents are not scanned.

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
