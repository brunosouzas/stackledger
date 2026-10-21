# package-release

## Purpose
Defines what the stackledger npm package contains and how a version is released: a tag, checks without publishing rights, then publication of the checked bytes with provenance and a software bill of materials.

## ADDED Requirements

### Requirement: Package contents
The npm package SHALL contain `dist/`, `site/`, `skills/`, `examples/`, `README.md`, `LICENSE`, `package.json` and `npm-shrinkwrap.json`, and nothing from `src/`, `test/`, `scripts/`, `openspec/`, `docs/` or `.github/`. Packing SHALL build `dist/` first, so a package never ships an old or missing build.

#### Scenario: Packed files
- **WHEN** `npm pack --dry-run --json` runs on a clean checkout
- **THEN** it lists `dist/cli.js`, `site/`, `skills/stackledger/SKILL.md`, `examples/northwind/`, `README.md`, `LICENSE` and `npm-shrinkwrap.json`, and no path under `src/`, `test/`, `scripts/`, `openspec/`, `docs/` or `.github/`

#### Scenario: Pack without a build
- **WHEN** `dist/` does not exist and `npm pack` runs
- **THEN** the tarball holds `dist/cli.js`

#### Scenario: Installed package runs
- **WHEN** the packed tarball is installed into an empty folder and `stackledger --help` runs from it
- **THEN** the exit code is 0 and stdout lists the seven commands

### Requirement: Locked dependencies
The repository SHALL keep its development lock file as `npm-shrinkwrap.json` for `npm ci`. Release packing SHALL copy built package files into a temporary staging directory and derive a production-only shrinkwrap from the locked production graph, without changing the repository lock. The shipped shrinkwrap SHALL agree with the staged `package.json` and omit development-only and unreachable optional packages; the release SHALL upload the exact tarball produced by this staging pack.

#### Scenario: Two installs agree
- **WHEN** the packed tarball is installed into two empty folders
- **THEN** `npm ls --all --json` gives the same production dependency versions in both, equal to the repository shrinkwrap's production entries, with no development-only or untracked packages (npm may label locked optional platform packages extraneous), the tarball's shrinkwrap has no development-only entries

### Requirement: Package metadata
`package.json` SHALL NOT be private and SHALL name the package `stackledger`, its `bin`, the Apache-2.0 licence, `engines.node` `>=22.12`, and the `repository`, `homepage` and `bugs` of `github.com/brunosouzas/stackledger`, so npm can link the provenance to this repository.

#### Scenario: Metadata
- **WHEN** `package.json` is read
- **THEN** `private` is absent, `repository.url` is `git+https://github.com/brunosouzas/stackledger.git` and `bin.stackledger` is `dist/cli.js`

### Requirement: Release tags
A release SHALL start only from a pushed tag `v<major>.<minor>.<patch>` of digits, without a pre-release suffix (v1 has no pre-release channel). The first step SHALL fail, before anything else runs, when the tag has another shape, differs from `v` plus `package.json` `version`, or names a commit that is not on `origin/main`.

#### Scenario: Tag and version differ
- **WHEN** the release starts from tag `v0.2.0` while `package.json` says `0.1.0`
- **THEN** the tag check exits 1 with one line naming both values and no later step runs

#### Scenario: Tag on an unmerged commit
- **WHEN** the tag `v0.1.0` names a commit that is not an ancestor of `origin/main`
- **THEN** the tag check exits 1 saying the tag must be on `main`

#### Scenario: Tag of another shape
- **WHEN** the tag check receives `v0.1.0-beta.1` or `vnotes`
- **THEN** it exits 1 saying the tag must be `v<major>.<minor>.<patch>`

### Requirement: Checks without publishing rights
A first job with only `contents: read` SHALL run the tag check, `npm ci`, the build, the full test suite and `npm audit` (any vulnerability, or an audit that cannot run, fails it), then pack the tarball and write its CycloneDX SBOM from the manifest and production shrinkwrap extracted from that exact tarball (`npm sbom --package-lock-only --sbom-format cyclonedx`), and hand both to the publishing job as an artifact.

#### Scenario: Checks job
- **WHEN** the release workflow file is read
- **THEN** the first job has permissions exactly `contents: read` and runs tag check, `npm ci`, build, tests, `npm audit`, pack and SBOM in that order

### Requirement: Publication of the checked tarball
A second job SHALL run only after the first succeeds, in the GitHub environment `npm` (owner approval), with `contents: write` and `id-token: write`. It SHALL check out the tagged commit to get `scripts/release-publish.sh`, treat the downloaded artifact as data only, install and build nothing, and publish that tarball with `npm publish <tarball> --provenance --access public --ignore-scripts` through OIDC; `NPM_TOKEN` is read only for the first version.

#### Scenario: Publishing job
- **WHEN** the release workflow file is read
- **THEN** the second job `needs` the first, uses environment `npm`, checks out without credentials, runs the script from the checkout, has no install or build step, and the script publishes with `--provenance` and `--ignore-scripts`

### Requirement: Completing a partial release
The script SHALL ask npm for the version: a 404 means absent and it publishes; the same integrity with a provenance attestation skips publishing; another integrity, no attestation, or any other npm error fails with nothing changed. For the GitHub release, "not found" creates it with the SBOM, an existing one gets the SBOM replaced, and any other error fails.

#### Scenario: Version absent
- **WHEN** npm answers 404 for the version
- **THEN** the script publishes the tarball with `--provenance`, `--access public` and `--ignore-scripts`

#### Scenario: Re-run after the release step failed
- **WHEN** the version is already on npm with the same integrity as the packed tarball and a provenance attestation
- **THEN** the publish step is skipped and the GitHub release is created or its SBOM replaced

#### Scenario: Same bytes without provenance
- **WHEN** the version is on npm with the same integrity but no provenance attestation
- **THEN** the script exits 1 without touching the GitHub release

#### Scenario: Version already published with other bytes
- **WHEN** the version is on npm with a different integrity
- **THEN** the script exits 1 without publishing or touching the GitHub release

#### Scenario: Registry lookup fails
- **WHEN** npm fails for a reason other than 404, or answers with no integrity
- **THEN** the script exits 1 without publishing or touching the GitHub release

#### Scenario: Release lookup fails
- **WHEN** `gh release view` fails for a reason other than "release not found"
- **THEN** the script exits 1 without creating or changing a release

### Requirement: Release workflow hardening
The release workflow SHALL pin every action by full commit SHA, check out without persisting credentials, use no npm cache, and pass `actionlint`.

#### Scenario: Pinned
- **WHEN** the release workflow file is read
- **THEN** every `uses` names a 40-character commit SHA, no step enables a package cache, and `actionlint` reports nothing
