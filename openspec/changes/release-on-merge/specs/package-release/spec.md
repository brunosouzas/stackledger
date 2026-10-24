## MODIFIED Requirements

### Requirement: Release tags
A release SHALL start from a push to `main` that `Release on the version merge` accepts, or from a pushed tag `v<major>.<minor>.<patch>` of digits without a pre-release suffix. The tag check SHALL be the first step of the checks and fail when the tag has another shape, differs from `v` plus `package.json` `version`, or its commit is not on `origin/main`. From `main` the commit is the pushed one, and an existing tag on another commit fails.

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

### Requirement: Publication of the checked tarball
A second job SHALL run only after the first succeeds, in the GitHub environment `npm` (owner approval), with `contents: write` and `id-token: write`. It SHALL check out the released commit to get `scripts/release-publish.sh`, treat the downloaded artifact as data only, install and build nothing, and publish that tarball with `npm publish <tarball> --provenance --access public --ignore-scripts` through OIDC; `NPM_TOKEN` is read only for the first version.

#### Scenario: Publishing job
- **WHEN** the release workflow file is read
- **THEN** the second job `needs` the first, uses environment `npm`, checks out without credentials, runs the script from the checkout, has no install or build step, and the script publishes with `--provenance` and `--ignore-scripts`

## ADDED Requirements

### Requirement: Release on the version merge
`release.yml` SHALL run on pushes to `main` and on pushed tags `v*`. A first job with only `contents: read` SHALL decide: a pushed tag goes on; a push to `main` goes on only when it is neither forced nor a non-fast-forward, changes `version` against the commit before the push, and `v<version>` does not exist. Otherwise no later job runs. It prints one line saying why.

#### Scenario: The version merge releases
- **WHEN** a push to `main` moves `version` from `0.1.0` to `0.2.0` and no tag `v0.2.0` exists
- **THEN** the detection answers `release=true` and `tag=v0.2.0`

#### Scenario: A later merge with the same version
- **WHEN** a push to `main` leaves `version` at `0.2.0`, with or without the tag `v0.2.0`
- **THEN** the detection answers `release=false` and no check or publish job runs

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
- **WHEN** the push is the tag `v0.2.0`, a push to another branch, or a push to `main` with no previous commit
- **THEN** the tag goes on with `tag=v0.2.0`; the others answer `release=false`; missing arguments exit 1

### Requirement: Tag reserved before publishing
From `main`, the publishing script SHALL create the tag on the released commit through the GitHub API before asking npm. When GitHub answers that it exists, the tag must name that commit, or the script exits 1 with nothing published; any other GitHub error exits 1 the same way. The GitHub release is then created on that tag with `--verify-tag`.

#### Scenario: Reserve, publish, release
- **WHEN** the script runs from `main` for `v0.1.0` on commit `abc123`, the tag does not exist and npm answers 404
- **THEN** it creates the tag on `abc123`, then publishes, then creates the release `v0.1.0` with the SBOM and `--verify-tag`, in that order

#### Scenario: Tag pushed meanwhile on another commit
- **WHEN** the tag `v0.1.0` already names commit `def456`
- **THEN** the script exits 1 naming both commits, without publishing or touching the GitHub release

#### Scenario: Tag already on the released commit
- **WHEN** the tag `v0.1.0` already names `abc123` (a re-run after the reservation)
- **THEN** the script goes on and publishes

#### Scenario: GitHub cannot answer for the tag
- **WHEN** creating the tag fails for a reason other than "already exists"
- **THEN** the script exits 1 without publishing
