# catalogue-pipeline Specification

## Purpose
Defines the template a separate catalogue repository copies to check its catalogue and publish its sites with GitHub Actions: the layout, the checks, the build, what is published and when.

## Requirements

### Requirement: Template
`examples/catalogue-repository/` SHALL be a working catalogue repository root: `.github/workflows/stackledger.yml`, `.gitignore`, a `README.md` naming the secrets and the variable to set and linking `docs/hosting.md`, and the catalogue in `catalog/` with one fictitious component. The workflow SHALL run on pull requests, pushes to `main`, a weekly schedule and a manual start.

#### Scenario: Template files
- **WHEN** the template folder is listed and its workflow read
- **THEN** it holds the workflow, `.gitignore`, `README.md` and `catalog/`, and the triggers are `pull_request`, `push` to `main`, `schedule` and `workflow_dispatch`

#### Scenario: Copied template passes as is
- **WHEN** the whole template is copied to an empty folder and the `site` job's commands run there
- **THEN** every command exits 0, though the folder also holds the workflow's YAML

### Requirement: Pinned tools
The workflow SHALL run stackledger as `npx --yes "$STACKLEDGER"`, with `STACKLEDGER` set once in the file to `"@brunosouzas/stackledger@<version>"` (quoted: a YAML plain value cannot start with `@`) at one exact version, pin every action by full commit SHA, install `wrangler` at one exact version, and download gitleaks as one pinned release whose SHA-256 checksum it verifies before use.

#### Scenario: Exact versions
- **WHEN** the template workflow is read
- **THEN** every `uses` names a 40-character SHA, `STACKLEDGER` is `@brunosouzas/stackledger@x.y.z`, wrangler has an exact `x.y.z` version, and the gitleaks download is followed by a checksum check that fails on a mismatch

#### Scenario: Scoped value parses
- **WHEN** the template workflow is parsed as YAML
- **THEN** parsing succeeds and `env.STACKLEDGER` is the string `@brunosouzas/stackledger@x.y.z`

### Requirement: Checks before the build
The `site` job SHALL scan the repository and its history with gitleaks and then run `stackledger validate catalog`; a finding or a catalogue error SHALL fail the job before the build. Catalogue warnings SHALL NOT fail it.

#### Scenario: Catalogue error stops the job
- **WHEN** the `site` job's commands run on a catalogue with one error
- **THEN** `stackledger validate catalog` exits 1 and the build command does not run

#### Scenario: Catalogue warning does not stop the job
- **WHEN** the `site` job's commands run on a catalogue whose only problem is a warning
- **THEN** every command exits 0 and the publish folder is filled

#### Scenario: Secret stops the job
- **WHEN** the gitleaks step runs on a repository holding a fictitious private key
- **THEN** the step fails and the validate step does not run

### Requirement: Build date
The `site` job SHALL build with `--date` set to the run's date in UTC, so a re-run on the same day deploys the same files and the weekly run moves renewal windows.

#### Scenario: Build date
- **WHEN** the template workflow is read
- **THEN** the build command passes `--date` with the UTC date of the run

### Requirement: What is published
The `site` job SHALL build into a fresh folder outside the repository and hand on only `full/`, `staff/` when the build wrote it (the corporate mode), `_headers`, `robots.txt` and `_redirects`. The `deploy` job SHALL run wrangler from an otherwise empty folder, so no `functions/` folder or wrangler configuration of the catalogue repository can be uploaded.

#### Scenario: Only the publishable entries
- **WHEN** the `site` job's commands run on the Northwind example
- **THEN** the publish folder holds exactly `full`, `staff`, `_headers`, `robots.txt` and `_redirects`, which sends `/` to `/staff/`

#### Scenario: Personal mode publishes no staff site
- **WHEN** the `site` and deploy commands run on the template with `spec.sites: [full]` in `catalog/stackledger.yaml`
- **THEN** the publish and deploy folders hold exactly `full`, `_headers`, `robots.txt` and `_redirects`, which sends `/` to `/full/`

#### Scenario: Repository extras are not deployed
- **WHEN** the catalogue repository also holds `functions/` and `wrangler.toml` and the `site` and collect commands run
- **THEN** the deploy folder holds only `site/` with the publishable entries, and the deploy step's working directory is that folder

### Requirement: Deploy job
A separate `deploy` job, on a fresh runner, SHALL run only after `site` succeeds, on `refs/heads/main`, and not for a pull request. With no checkout, it SHALL install wrangler with `--ignore-scripts` before any secret is present, then run that binary in the only step given `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

#### Scenario: Pull request does not deploy
- **WHEN** the template workflow is read
- **THEN** the `deploy` job needs `site`, its condition requires `refs/heads/main` and an event other than `pull_request`, and the `site` job reads no Cloudflare secret

#### Scenario: Wrangler installed without secrets
- **WHEN** the template workflow is read
- **THEN** the `deploy` job has no checkout, installs wrangler with `--ignore-scripts` in a step without secrets, and its deploy step contains no `npx`, `npm install` or `npm exec`

### Requirement: Deployment identity
Each deployment SHALL be labelled with the commit and the build date, the date the `site` job computed once and handed on with the files, so a previous deployment can be found and rolled back to in Cloudflare Pages.

#### Scenario: Labelled deployment
- **WHEN** the template workflow is read
- **THEN** the deploy command passes `--commit-hash` with the run's commit and a `--commit-message` holding the date read from the file the `site` job wrote, not a new date

#### Scenario: Build date travels with the files
- **WHEN** the `site` job's commands run with the date fixed to `2026-10-21` and the deploy command is printed with the date fixed to `2026-10-22`
- **THEN** the build used `2026-10-21` and the label says `2026-10-21`

### Requirement: Template hardening
The workflow SHALL check out without persisting credentials, grant `site` only `contents: read` and `deploy` no permissions, use one concurrency group per ref that does not cancel a running deploy, and pass `actionlint`.

#### Scenario: Least privilege
- **WHEN** the template workflow is read
- **THEN** `site` has exactly `contents: read`, `deploy` has none, checkout sets `persist-credentials: false`, the concurrency group includes the ref, and `actionlint` reports nothing
