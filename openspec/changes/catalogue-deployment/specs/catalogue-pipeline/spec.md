# catalogue-pipeline

## Purpose
Defines the template a separate catalogue repository copies to check its catalogue and publish the two sites with GitHub Actions: the checks, the build, what is published and when.

## ADDED Requirements

### Requirement: Template
`examples/catalogue-repository/` SHALL hold `.github/workflows/stackledger.yml`, a `.gitignore` that ignores the build output, and a `README.md` naming the secrets and variables to set and linking `docs/hosting.md`. The workflow SHALL run on every pull request and on every push to `main`.

#### Scenario: Template files
- **WHEN** the template folder is listed
- **THEN** it holds the workflow, `.gitignore` and `README.md`, and the workflow's triggers are `pull_request` and `push` to `main`

### Requirement: Pinned tools
The workflow SHALL run stackledger as `npx --yes stackledger@<version>` with one exact version set once in the file, pin every action by full commit SHA, and download gitleaks as one pinned release whose SHA-256 checksum it verifies before use.

#### Scenario: Exact versions
- **WHEN** the template workflow is read
- **THEN** every `uses` names a 40-character SHA, the stackledger version is an exact `x.y.z`, and the gitleaks download is followed by a checksum check that fails on a mismatch

### Requirement: Checks before the build
The workflow SHALL scan the repository with gitleaks and then run `stackledger validate .`; a finding or a catalogue error SHALL fail the job before the build. Warnings do not fail it.

#### Scenario: Catalogue error stops the job
- **WHEN** the template's check commands run on a catalogue with one error
- **THEN** `stackledger validate .` exits 1 and the build command does not run

#### Scenario: Secret stops the job
- **WHEN** the template's gitleaks step runs on a repository holding a fictitious private key
- **THEN** the step fails and the validate step does not run

### Requirement: What is published
The workflow SHALL build into a fresh folder and copy only `full/`, `staff/`, `_headers` and `robots.txt` into the folder it deploys. No other entry of the build output SHALL be deployed.

#### Scenario: Only the four entries
- **WHEN** the template's build and collect commands run on the Northwind example
- **THEN** the deploy folder holds exactly `full`, `staff`, `_headers` and `robots.txt`

### Requirement: When it deploys
Only a push to `main` SHALL deploy, with `wrangler pages deploy` of the collected folder to the Cloudflare Pages project named by a repository variable, using the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that step only. Pull requests SHALL run the checks and the build and never deploy.

#### Scenario: Pull request does not deploy
- **WHEN** the template workflow is read
- **THEN** the deploy step's condition is a push to `refs/heads/main`, and no other step reads a Cloudflare secret

### Requirement: Template hardening
The workflow SHALL check out without persisting credentials, grant only `contents: read`, use one concurrency group per branch that does not cancel a running deploy, and pass `actionlint`.

#### Scenario: Least privilege
- **WHEN** the template workflow is read
- **THEN** permissions are exactly `contents: read`, checkout sets `persist-credentials: false`, the concurrency group includes the ref, and `actionlint` reports nothing
