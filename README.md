# stackledger

Govern your software stack and licences, drawn as a metro map.

stackledger is a small, local-first tool for people and small companies who want to know what software they run, which licences they pay for and when those renew. You describe your software in YAML files kept in Git. stackledger turns them into a static website:

- **A metro map.** Each line is a journey, such as "ship a feature" or "send an invoice", and each station is a piece of software. Interchanges are the tools several journeys depend on.
- **A software list.** Each item has its own page with its licence, owner, renewal date, the journeys it serves and a diagram of what it depends on and what depends on it.
- **Reports.** Renewals, cost per month and year, items nobody owns, and drift between what a machine has installed and what the catalogue declares.

![A fictitious company's software as a metro map](docs/spikes/2026-10-20-map-engine/demo-light.png)

*Spike output with fictitious data. The tool itself is not built yet.*

## Status

Early design. Nothing is released. The scope is in [docs/roadmap.md](docs/roadmap.md), and each piece of work is an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change under `openspec/changes/`.

## How it is meant to work

1. Keep your catalogue in its own Git repository, private if it holds real data, or in a local folder. It uses the [Backstage](https://backstage.io/docs/features/software-catalog/descriptor-format) `catalog-info.yaml` format, so a company that already runs Backstage can point stackledger at the same files.
2. Run `stackledger build` in that repository's pipeline. It produces a static site you can host anywhere. Put it behind a login when it holds real data.
3. On each Mac, `stackledger discover` records what is installed. `stackledger drift` shows what differs from the catalogue.

stackledger never stores secrets, needs no server or database, sends no telemetry and only reads the machines it inspects.

## Catalogue format

`stackledger validate` checks a local folder of YAML files: Backstage `Component` software items and `Resource` licences, plus `Line` journeys and a `MapLayout`. The [format reference](docs/catalogue-format.md) describes every field, references, warnings and Backstage location rules. Keep real inventory in its own private repository; the example below is fictitious.

Build and check a catalogue with Node.js 22 or later:

```sh
npm ci
npm run build
npm test
node dist/cli.js validate /path/to/catalogue
node dist/cli.js validate /path/to/catalogue --json
```

The npm executable is `stackledger validate [folder]`; without a folder it checks the current directory. Exit 0 means no errors (warnings allowed), 1 means catalogue errors, and 2 means usage/folder failure. Validation only reads, makes no network calls and sends no telemetry. The package is not yet published to npm.

Save this self-contained example as `catalogue.yaml` in a separate folder:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: editor
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
    vaultItem: Northwind Editor subscription
---
apiVersion: stackledger/v1alpha1
kind: Line
metadata:
  name: ship
spec:
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
```

## Licence

[Apache-2.0](LICENSE)
