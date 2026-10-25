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

### Requirement: How it works diagram
`docs/images/how-it-works.svg`, shown by `docs/how-it-works.md` and the README, SHALL be the design system's body diagram (`coverTree`, `"format": "diagram"`) of `scripts/how-it-works.json`, drawn by the pinned package, which `validateCoverSpec` accepts with no problem. The spec SHALL use the design system's pieces and token colours only, and the SVG SHALL be inert.

#### Scenario: Diagram file is the design system's drawing
- **GIVEN** the repository
- **WHEN** `scripts/how-it-works.json` is validated and drawn with `coverTree`
- **THEN** `validateCoverSpec` returns no problem, the spec's `format` is `diagram`, and the shapes of `docs/images/how-it-works.svg` (every element with its attributes and text) equal those of the drawing

#### Scenario: Stale diagram file
- **GIVEN** a copy of the drawing in which one attribute of one shape differs
- **WHEN** it is compared with the drawing as in "Diagram file is the design system's drawing"
- **THEN** the comparison fails

#### Scenario: Colour literal refused
- **GIVEN** the spec with one box's `fill` set to a colour literal
- **WHEN** it is validated
- **THEN** `validateCoverSpec` reports a problem at that box's `fill` path

#### Scenario: Diagram is inert
- **WHEN** `docs/images/how-it-works.svg` is parsed
- **THEN** it has no `script`, `style` or `foreignObject` element, no event, `style` or link attribute, and no reference other than an internal `url(#id)`

### Requirement: How it works diagram content
The spec SHALL draw the Mermaid block of `docs/how-it-works.md` and nothing else, with these four pieces only and no `custom`: per node a `diagramBox` with its lines (backticks removed), inside only its subgraph's `taggedContainer`; per edge a `messageArrow` whose ends are within 8 units of only its source and target boxes, head at the target, dashed only if dotted; per edge label an `edgeLabel` with its words. A Mermaid line the comparison does not understand is a problem.

#### Scenario: Mermaid content kept
- **GIVEN** the Mermaid block of `docs/how-it-works.md` and `scripts/how-it-works.json`
- **WHEN** they are compared as the requirement says
- **THEN** no problem is found

#### Scenario: Lost line or edge
- **GIVEN** the spec with one line removed from one box, or one arrow or edge label removed, or one box added
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison reports a problem naming that node, that edge, that edge label or that box

#### Scenario: Rewired edge
- **GIVEN** the spec with one arrow reversed, sent to another box, with its head off or at its start, of another `kind`, or dashed instead of the dotted edge's arrow; or one box moved out of its container; or a piece of another kind or a `custom` drawing added; or an edge label's words run together
- **WHEN** it is compared with the Mermaid block
- **THEN** the comparison reports a problem naming that edge, that node, that piece, `custom` or that edge label

#### Scenario: Unknown Mermaid line
- **GIVEN** the Mermaid block with one more line in a syntax the comparison does not read (a node without quotes, a thick arrow, a `click`)
- **WHEN** it is compared with the spec
- **THEN** the comparison reports that line as not understood

### Requirement: How it works generation
`scripts/site-art.mjs` SHALL write `docs/images/how-it-works.svg` from `scripts/how-it-works.json`, with the site art, after checking every spec it reads with `validateCoverSpec`; when one is refused it SHALL fail naming that spec and write no file. `scripts/how-it-works-diagram.py` is removed and `docs/how-it-works.md` names `node scripts/site-art.mjs`. The spec and the SVG SHALL stay out of the npm package.

#### Scenario: Invalid spec writes nothing
- **GIVEN** a copy of the script in an empty repository whose diagram spec, or whose banner spec, the package refuses
- **WHEN** the script runs
- **THEN** it exits with an error naming that spec file and the problem's path, and the repository holds no `docs` or `site` folder; with both specs valid it writes both

#### Scenario: No hand-drawn generator
- **WHEN** `scripts/` is listed and `docs/how-it-works.md` read
- **THEN** there is no `how-it-works-diagram.py`, and the page names `node scripts/site-art.mjs` and no Python command

#### Scenario: Diagram sources not published
- **WHEN** `package.json` is read
- **THEN** its `files` list includes neither `scripts` nor `docs`, nor any path under them
