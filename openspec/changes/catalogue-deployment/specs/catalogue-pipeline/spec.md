# catalogue-pipeline

## Purpose
Defines the template a separate catalogue repository copies to check its catalogue and publish the two sites with GitHub Actions: the checks, the build, what is published and when.

## ADDED Requirements

### Requirement: Template
`examples/catalogue-repository/` SHALL hold `.github/workflows/stackledger.yml`, a `.gitignore` that ignores the build output, and a `README.md` naming the secrets and the variable to set and linking `docs/hosting.md`. The workflow SHALL run on every pull request, every push to `main`, a weekly schedule and a manual start.

#### Scenario: Template files
- **WHEN** the template folder is listed and its workflow read
- **THEN** it holds the workflow, `.gitignore` and `README.md`, and the triggers are `pull_request`, `push` to `main`, `schedule` and `workflow_dispatch`

### Requirement: Pinned tools
The workflow SHALL run stackledger as `npx --yes stackledger@<version>` with one exact version set once in the file, pin every action by full commit SHA, run `wrangler` at one exact version, and download gitleaks as one pinned release whose SHA-256 checksum it verifies before use.

#### Scenario: Exact versions
- **WHEN** the template workflow is read
- **THEN** every `uses` names a 40-character SHA, stackledger and wrangler have exact `x.y.z` versions, and the gitleaks download is followed by a checksum check that fails on a mismatch

### Requirement: Checks before the build
The workflow SHALL scan the repository and its history with gitleaks and then run `stackledger validate .`; a finding or a catalogue error SHALL fail the job before the build. Catalogue warnings SHALL NOT fail it.

#### Scenario: Catalogue error stops the job
- **WHEN** the template's check commands run on a catalogue with one error
- **THEN** `stackledger validate .` exits 1 and the build command does not run

#### Scenario: Catalogue warning does not stop the job
- **WHEN** the template's check, build and collect commands run on a catalogue whose only problem is a warning
- **THEN** every command exits 0 and the deploy folder is filled

#### Scenario: Secret stops the job
- **WHEN** the template's gitleaks step runs on a repository holding a fictitious private key
- **THEN** the step fails and the validate step does not run

### Requirement: Build date
The workflow SHALL build with `--date` set to the run's date in UTC. A re-run on the same day deploys the same files; a later run moves the renewal windows to its own date, and the weekly run keeps them current.

#### Scenario: Build date
- **WHEN** the template workflow is read
- **THEN** the build command passes `--date` with the UTC date of the run

### Requirement: What is published
The workflow SHALL build into a fresh folder and copy only `full/`, `staff/`, `_headers` and `robots.txt` into the folder it deploys. No other entry of the build output SHALL be deployed.

#### Scenario: Only the four entries
- **WHEN** the template's build and collect commands run on the Northwind example
- **THEN** the deploy folder holds exactly `full`, `staff`, `_headers` and `robots.txt`

### Requirement: When it deploys
Only a run on `refs/heads/main` that is not a pull request (push, schedule or manual start) SHALL deploy, with `wrangler pages deploy` of the collected folder to the Pages project in a repository variable and `--branch main`, using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that step only.

#### Scenario: Pull request does not deploy
- **WHEN** the template workflow is read
- **THEN** the deploy step's condition requires `refs/heads/main` and an event other than `pull_request`, and no other step reads a Cloudflare secret

### Requirement: Template hardening
The workflow SHALL check out without persisting credentials, grant only `contents: read`, use one concurrency group per ref that does not cancel a running deploy, and pass `actionlint`.

#### Scenario: Least privilege
- **WHEN** the template workflow is read
- **THEN** permissions are exactly `contents: read`, checkout sets `persist-credentials: false`, the concurrency group includes the ref, and `actionlint` reports nothing
