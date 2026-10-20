# 2. The catalogue uses the Backstage format and lives in its own repository

- Status: Accepted
- Date: 2026-10-20

## Context

stackledger needs a record of every software item, its owner, its licence and how items relate. That record holds sensitive data (costs, renewal dates, which VPN or secret store a company uses), while the tool is open source. Companies may also already describe their software for [Backstage](https://backstage.io/docs/features/software-catalog/descriptor-format).

## Options considered

1. Our own file format, stored inside the tool's repository.
2. Our own format, stored in a separate repository.
3. The Backstage `catalog-info.yaml` format (a subset), stored in a separate Git repository or a local folder, plus two kinds of our own for what Backstage cannot express.
4. A database.

## Decision

Option 3. Software items are Backstage `Component` documents and licences are `Resource` documents with `spec.type: licence`. Journeys (`Line`) and map positions (`MapLayout`) use `apiVersion: stackledger/v1alpha1`. The catalogue lives in its own repository (for example `<company>-catalog`), private when it holds real data, and stackledger reads it from a folder; reading from a Git URL comes later in the roadmap.

## Consequences

- The tool never holds anyone's data, and the open-source repository uses fictitious data only.
- Git gives history, review through pull requests and backups at no cost.
- A company that runs Backstage can point stackledger at the same files. Backstage logs our two kinds as unknown unless its location rules allow only `Component` and `Resource`; the catalogue format document explains how.
- Anyone with read access to the catalogue repository sees everything, costs included. People who should not see costs get the website instead (see [ADR 7](0007-two-views-built-as-separate-sites.md)).
- The exact rules are specified by the OpenSpec change `catalogue-model` ([pull request #1](https://github.com/brunosouzas/stackledger/pull/1)); once delivered they live in `openspec/specs/catalogue/`.
