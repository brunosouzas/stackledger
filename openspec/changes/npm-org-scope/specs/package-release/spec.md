## MODIFIED Requirements

### Requirement: Package metadata
`package.json` SHALL NOT be private and SHALL name the package `@brunosouzas/stackledger`, its `bin` `stackledger`, the Apache-2.0 licence, `engines.node` `>=22.12`, and the `repository`, `homepage` and `bugs` of `github.com/brunosouzas/stackledger`, so npm can link the provenance to this repository. The shrinkwrap SHALL carry the same name.

#### Scenario: Metadata
- **WHEN** `package.json` is read
- **THEN** `name` is `@brunosouzas/stackledger`, `private` is absent, `repository.url` is `git+https://github.com/brunosouzas/stackledger.git` and `bin.stackledger` is `dist/cli.js`

#### Scenario: Command name under the scoped package
- **WHEN** the packed tarball is installed from a registry as `@brunosouzas/stackledger@<version>` into an empty folder
- **THEN** it lands in `node_modules/@brunosouzas/stackledger` and `node_modules/.bin/stackledger --help` lists the seven commands

### Requirement: SBOM product identity
The manifest and shrinkwrap extracted from the tarball SHALL be placed in a directory path named after the scoped package, `@brunosouzas/stackledger`, before `npm sbom` runs, so the metadata component identifies the package rather than the tar entry `package` or a bare `stackledger`.

#### Scenario: SBOM product identity
- **WHEN** the SBOM is generated from the packed tarball
- **THEN** its metadata component has the name `@brunosouzas/stackledger`, the version from the packed manifest and the purl `pkg:npm/%40brunosouzas/stackledger@<version>`

## ADDED Requirements

### Requirement: Scoped release files
The check job SHALL hand the publish job the tarball npm packs for the scoped name, `brunosouzas-stackledger-<version>.tgz`, and the SBOM `stackledger-<version>.cdx.json`. `scripts/release-publish.sh` SHALL look up, publish and report `@brunosouzas/stackledger@<version>`, never the unscoped `stackledger`, whose versions belong to another npm account.

#### Scenario: Scoped tarball in the workflow
- **WHEN** the release workflow file is read
- **THEN** the SBOM step extracts `brunosouzas-stackledger-<version>.tgz` and the publish step passes that file and `stackledger-<version>.cdx.json` to the script

#### Scenario: Lookup under the scoped name
- **WHEN** the publish script runs for version 0.1.0
- **THEN** its first npm call is `npm view @brunosouzas/stackledger@0.1.0 dist --json`, and no npm call names the unscoped `stackledger@0.1.0`
