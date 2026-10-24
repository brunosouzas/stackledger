## MODIFIED Requirements

### Requirement: Release tags
A release SHALL start from a push to `main` that `Release on the version merge` accepts, or from a pushed tag `v<major>.<minor>.<patch>` of digits without a pre-release suffix. The tag check SHALL be the first step of the checks job and fail when the tag has another shape, differs from `v` plus `package.json` `version`, or its commit is not on `origin/main`. From `main` the commit is the pushed one, and an existing tag on another commit fails.

#### Scenario: Tag and version differ
- **WHEN** the release starts from tag `v0.2.0` while `package.json` says `0.1.0`
- **THEN** the tag check exits 1 with one line naming both values and no later step runs

#### Scenario: Tag on an unmerged commit
- **WHEN** the tag `v0.1.0` names a commit that is not an ancestor of `origin/main`
- **THEN** the tag check exits 1 saying the tag must be on `main`

#### Scenario: Tag of another shape
- **WHEN** the tag check receives `v0.1.0-beta.1` or `vnotes`
- **THEN** it exits 1 saying the tag must be `v<major>.<minor>.<patch>`

#### Scenario: From main before the tag exists
- **WHEN** the tag check receives `v0.1.0` and the commit of `main`, `package.json` says `0.1.0` and no tag `v0.1.0` exists
- **THEN** it exits 0; with a commit that is not on `origin/main` it exits 1 saying the tag must be on `main`

#### Scenario: From main with the tag on another commit
- **WHEN** the tag check receives `v0.1.0` and the commit of `main`, while `v0.1.0` already names another commit
- **THEN** it exits 1 saying the tag already exists on that other commit

### Requirement: Checks without publishing rights
A checks job, after `Release on the version merge` and only when it answers `release=true`, with only `contents: read`, SHALL run the tag check, `npm ci`, the build, the full test suite and `npm audit` (any vulnerability or an audit failure stops it), then pack the tarball and write its CycloneDX SBOM from the manifest and production shrinkwrap extracted from that exact tarball (`npm sbom --package-lock-only --sbom-format cyclonedx`), and hand both on as an artifact.

#### Scenario: Checks job
- **WHEN** the release workflow file is read
- **THEN** the checks job `needs` the detection job, runs only when its output `release` is `true`, has permissions exactly `contents: read`, and runs tag check, `npm ci`, build, tests, `npm audit`, pack and SBOM in that order

### Requirement: Publication of the checked tarball
A publishing job SHALL run only after the checks succeed, in the GitHub environment `npm` (owner approval), with `contents: write` and `id-token: write`. It SHALL check out the released commit to get `scripts/release-publish.sh`, treat the downloaded artifact as data only, install and build nothing, and publish that tarball with `npm publish <tarball> --provenance --access public --ignore-scripts` through OIDC; `NPM_TOKEN` is read only for the first version.

#### Scenario: Publishing job
- **WHEN** the release workflow file is read
- **THEN** the publishing job `needs` the detection and checks jobs, uses environment `npm`, checks out without credentials, runs the script from the checkout, has no install or build step, and the script publishes with `--provenance` and `--ignore-scripts`

### Requirement: Completing a partial release
After `Tag reserved before publishing`, the script SHALL ask npm: a 404 publishes; the same integrity with a provenance attestation skips publishing; another integrity, no attestation, or any other npm error fails without publishing or touching the GitHub release (a tag reserved before stays). For the GitHub release, "not found" creates it with the SBOM, an existing one gets the SBOM replaced, any other error fails. Recovery is "Re-run failed jobs".

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

#### Scenario: Registry fails after the reservation
- **WHEN** the script runs from `main`, reserves the tag and npm then answers E401
- **THEN** it exits 1; the tag stays on the released commit, nothing is published and no GitHub release is created

## ADDED Requirements

### Requirement: Release on the version merge
`release.yml` SHALL run on pushes to `main` and on pushed tags `v*`. A first job with only `contents: read`, given the event values through `env`, SHALL answer `release` and `tag`: a pushed tag goes on; a push to `main` goes on only when it is neither forced nor a non-fast-forward, changes `version` against the commit before the push, and `v<version>` does not exist. It prints one line saying why.

#### Scenario: The version merge releases
- **WHEN** a push to `main` moves `version` from `0.1.0` to `0.2.0` and no tag `v0.2.0` exists
- **THEN** the detection answers `release=true` and `tag=v0.2.0`

#### Scenario: A later merge with the same version
- **WHEN** a push to `main` leaves `version` at `0.2.0`, with or without the tag `v0.2.0`
- **THEN** the detection answers `release=false`, and the workflow runs neither the checks nor the publishing job

#### Scenario: Version whose tag exists
- **WHEN** a push to `main` changes `version` to `0.2.0` but the tag `v0.2.0` already exists
- **THEN** the detection answers `release=false`

#### Scenario: Several commits in one push
- **WHEN** one push to `main` carries the version change and a later commit
- **THEN** the detection answers `release=true` for the new version

#### Scenario: Forced or rewritten main
- **WHEN** the push to `main` is forced, or its previous tip is not an ancestor of the new one
- **THEN** the detection answers `release=false`

#### Scenario: Pushed tag and other refs
- **WHEN** the push is the tag `v0.2.0`, a push to another branch, or a push to `main` whose previous commit is all zeros or not in the checkout
- **THEN** the tag goes on with `tag=v0.2.0`; the others answer `release=false`

### Requirement: Detection errors
The detection SHALL decide in this order, the first match winning: fewer than four arguments exit 1; a tag or another branch answers; a forced push answers `release=false`; an all-zero or missing previous commit answers `release=false`; a non-fast-forward answers `release=false`; `package.json` at the pushed commit missing, not JSON or without a string `version` exits 1; at the previous commit, missing or without a string `version` counts as changed, not JSON exits 1. A Git failure exits 1.

#### Scenario: Unreadable version
- **WHEN** the pushed commit of `main` has no `package.json`, one that is not JSON, or one without `version`, on a fast-forward push
- **THEN** the detection exits 1 with one line naming the commit

#### Scenario: Forced push wins over an unreadable version
- **WHEN** a forced push to `main` has a pushed commit without `package.json`
- **THEN** the detection answers `release=false`

#### Scenario: Previous version missing or unreadable
- **WHEN** the previous commit has no `package.json` or one without `version`, and the pushed one says `0.2.0` with no tag `v0.2.0`
- **THEN** the detection answers `release=true`; when the previous `package.json` is not JSON it exits 1

#### Scenario: Git fails
- **WHEN** the detection runs outside a Git repository
- **THEN** it exits 1 with Git's message, not as a missing file

#### Scenario: Wrong arguments
- **WHEN** the detection runs with fewer than four arguments
- **THEN** it exits 1 with its usage line

### Requirement: Tag reserved before publishing
From `main`, the publishing script SHALL create the tag on the released commit through the GitHub API before asking npm. When GitHub answers that it exists, the tag must name that commit, or the script exits 1 with nothing published; any other GitHub error exits 1 the same way. Then `Completing a partial release` applies, and the GitHub release is created on that tag with `--verify-tag`.

#### Scenario: Reserve, publish, release
- **WHEN** the script runs from `main` for `v0.1.0` on commit `abc123`, the tag does not exist and npm answers 404
- **THEN** it creates the tag on `abc123`, then publishes, then creates the release `v0.1.0` with the SBOM and `--verify-tag`, in that order

#### Scenario: Tag pushed meanwhile on another commit
- **WHEN** the tag `v0.1.0` already names commit `def456`
- **THEN** the script exits 1 naming both commits, without publishing or touching the GitHub release

#### Scenario: Tag already on the released commit
- **WHEN** the tag `v0.1.0` already names `abc123` (a re-run of the failed publishing job) and npm answers 404
- **THEN** the script goes on and publishes

#### Scenario: GitHub cannot answer for the tag
- **WHEN** creating the tag fails for a reason other than "already exists"
- **THEN** the script exits 1 without publishing

### Requirement: One release of a version at a time
The checks job and the publishing job SHALL each have a concurrency group named after the release tag (`release-<tag>` and `release-<tag>-publish`) that never cancels a running job, so a run from `main` and a run from the pushed tag of the same version never publish at the same time.

#### Scenario: Concurrency groups
- **WHEN** the release workflow file is read
- **THEN** the checks job's group is `release-${{ needs.detect.outputs.tag }}`, the publishing job's is `release-${{ needs.detect.outputs.tag }}-publish`, both with `cancel-in-progress: false`, and the workflow has no other concurrency group
