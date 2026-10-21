# package-release

## Purpose
Defines what the stackledger npm package contains and how a version is released: a tag, checks without publishing rights, then publication of the checked bytes with provenance and a software bill of materials.

## ADDED Requirements

### Requirement: Package contents
The npm package SHALL contain `dist/`, `site/`, `skills/`, `examples/`, `README.md`, `LICENSE` and `package.json`, and nothing from `src/`, `test/`, `scripts/`, `openspec/`, `docs/` or `.github/`. Packing SHALL build `dist/` first, so a package never ships an old or missing build.

#### Scenario: Packed files
- **WHEN** `npm pack --dry-run --json` runs on a clean checkout
- **THEN** it lists `dist/cli.js`, `site/`, `skills/stackledger/SKILL.md`, `examples/northwind/`, `README.md` and `LICENSE`, and no path under `src/`, `test/`, `scripts/`, `openspec/`, `docs/` or `.github/`

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

### Requirement: Release tags
A release SHALL start only from a pushed tag `v<major>.<minor>.<patch>` of digits, without a pre-release suffix (v1 has no pre-release channel). The first step SHALL fail, before anything else runs, when the tag has another shape or differs from `v` plus `package.json` `version`.

#### Scenario: Tag and version differ
- **WHEN** the release starts from tag `v0.2.0` while `package.json` says `0.1.0`
- **THEN** the tag check exits 1 with one line naming both values and no later step runs

#### Scenario: Tag of another shape
- **WHEN** the tag check receives `v0.1.0-beta.1` or `vnotes`
- **THEN** it exits 1 saying the tag must be `v<major>.<minor>.<patch>`

### Requirement: Checks without publishing rights
A first job with only `contents: read` SHALL run the tag check, `npm ci`, the build, the full test suite and `npm audit` (any vulnerability, or an audit that cannot run, fails it), then pack the tarball and write its CycloneDX SBOM (`npm sbom --sbom-format cyclonedx --omit dev`), and hand both to the publishing job as an artifact.

#### Scenario: Checks job
- **WHEN** the release workflow file is read
- **THEN** the first job has permissions exactly `contents: read` and runs tag check, `npm ci`, build, tests, `npm audit`, pack and SBOM in that order

### Requirement: Publication of the checked tarball
A second job SHALL run only after the first succeeds, with `contents: write` and `id-token: write`, and SHALL publish the tarball the first job packed with `npm publish <tarball> --provenance --access public --ignore-scripts`, without checking out or building again. It SHALL authenticate through OIDC trusted publishing; the secret `NPM_TOKEN` is read only for the first version.

#### Scenario: Publishing job
- **WHEN** the release workflow file is read
- **THEN** the second job `needs` the first, has no checkout or build step, and publishes the downloaded tarball with `--provenance` and `--ignore-scripts`

### Requirement: Completing a partial release
Before publishing, the second job SHALL compare the tarball's integrity with the registry's for that version: when equal it SHALL skip publishing, when different it SHALL fail. Then it SHALL create the GitHub release for the tag with the SBOM, or replace the SBOM of an existing one, so a re-run completes a release whose publish succeeded and later step failed.

#### Scenario: Re-run after the release step failed
- **WHEN** the version is already on npm with the same integrity as the packed tarball
- **THEN** the publish step is skipped and the GitHub release is created or its SBOM replaced

#### Scenario: Version already published with other bytes
- **WHEN** the version is on npm with a different integrity
- **THEN** the publish step fails and the release is not touched

### Requirement: Release workflow hardening
The release workflow SHALL pin every action by full commit SHA, check out without persisting credentials, use no npm cache, and pass `actionlint`.

#### Scenario: Pinned
- **WHEN** the release workflow file is read
- **THEN** every `uses` names a 40-character commit SHA, no step enables a package cache, and `actionlint` reports nothing
