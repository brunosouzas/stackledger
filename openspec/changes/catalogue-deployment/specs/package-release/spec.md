# package-release

## Purpose
Defines what the stackledger npm package contains and how a version is released: a tag, checks, publication with provenance and a software bill of materials.

## ADDED Requirements

### Requirement: Package contents
The npm package SHALL contain `dist/`, `site/`, `skills/`, `examples/`, `README.md`, `LICENSE` and `package.json`, and nothing from `src/`, `test/`, `openspec/`, `docs/` or `.github/`. Packing SHALL build `dist/` first, so a package never ships an old or missing build.

#### Scenario: Packed files
- **WHEN** `npm pack --dry-run --json` runs on a clean checkout
- **THEN** it lists `dist/cli.js`, `site/`, `skills/stackledger/SKILL.md`, `examples/northwind/`, `README.md` and `LICENSE`, and no path under `src/`, `test/`, `openspec/`, `docs/` or `.github/`

#### Scenario: Pack without a build
- **WHEN** `dist/` does not exist and `npm pack` runs
- **THEN** the tarball holds `dist/cli.js`

#### Scenario: Installed package runs
- **WHEN** the packed tarball is installed into an empty folder and `stackledger --help` runs from it
- **THEN** the exit code is 0 and stdout lists the seven commands

### Requirement: Package metadata
`package.json` SHALL NOT be private and SHALL name the package `stackledger`, its `bin`, the Apache-2.0 licence, `engines.node` `>=22.12`, and the `repository`, `homepage` and `bugs` of `github.com/brunosouzas/stackledger`, so npm can link the provenance to this repository.

#### Scenario: Metadata
- **WHEN** `package.json` is read
- **THEN** `private` is absent, `repository.url` is `git+https://github.com/brunosouzas/stackledger.git` and `bin.stackledger` is `dist/cli.js`

### Requirement: Release trigger and version check
The release workflow SHALL run only when a tag `v<major>.<minor>.<patch>` (with an optional pre-release suffix) is pushed. Before building, it SHALL fail when the tag without `v` differs from `package.json` `version`, and nothing SHALL be published.

#### Scenario: Tag and version differ
- **WHEN** the tag `v0.2.0` is pushed while `package.json` says `0.1.0`
- **THEN** the version check step fails and no later step runs

#### Scenario: Only tags trigger a release
- **WHEN** the release workflow file is read
- **THEN** its only trigger is `push` of tags matching `v*`

### Requirement: Release checks and publication
After the version check, the release SHALL run `npm ci`, the build and the full test suite, and only then `npm publish --provenance --access public`. It SHALL authenticate to npm through OIDC trusted publishing; a token is read only from the secret `NPM_TOKEN`, used for the first version and deleted afterwards (`docs/release.md`).

#### Scenario: Publication comes last
- **WHEN** the release workflow file is read
- **THEN** the steps run in the order version check, `npm ci`, build, tests, publish, and the publish step has `--provenance`

### Requirement: Software bill of materials
After publishing, the release SHALL write the package's CycloneDX SBOM without development dependencies (`npm sbom --sbom-format cyclonedx --omit dev`) and create a GitHub release for the tag with that file attached.

#### Scenario: SBOM attached
- **WHEN** the release workflow file is read
- **THEN** a step after publish runs `npm sbom --sbom-format cyclonedx --omit dev` and another creates the GitHub release with the SBOM file

### Requirement: Release workflow hardening
The release workflow SHALL pin every action by full commit SHA, check out without persisting credentials, grant only `contents: write` and `id-token: write`, disable the npm cache and pass `actionlint`.

#### Scenario: Pinned and least privilege
- **WHEN** the release workflow file is read
- **THEN** every `uses` names a 40-character commit SHA, the permissions are exactly `contents: write` and `id-token: write`, and `actionlint` reports nothing
