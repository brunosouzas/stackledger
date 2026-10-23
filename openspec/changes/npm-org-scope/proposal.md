## Why

The package `stackledger` is published under the npm user `bruno_souza`. The owner presents all his work as `brunosouzas` and has an npm organisation of that name, still empty. An unscoped package shows no organisation; adding it to an organisation team changes who may publish, not whose package it is. A scoped name, `@brunosouzas/stackledger`, says it in the name, and the coming `@brunosouzas/design-system` will follow the same pattern.

## What Changes

- The package is named `@brunosouzas/stackledger`. The command stays `stackledger` (`bin`).
- Version 0.4.1: the code of 0.4.0 under the new name. The tag `v0.4.0` is taken, and nothing else changes, so a patch version.
- The release workflow passes the tarball npm packs for a scoped name, `brunosouzas-stackledger-<version>.tgz`, from the check job to the publish job. The SBOM is generated in a folder named `@brunosouzas/stackledger`, because `npm sbom` names the product after the folder. The SBOM asset keeps its name, `stackledger-<version>.cdx.json`.
- `scripts/release-publish.sh` looks up and publishes `@brunosouzas/stackledger@<version>`.
- Every `npx`/`npm` command in the docs, the catalogue-repository template and its README uses the new name. In the template's YAML the value is quoted, because a YAML plain value cannot start with `@`.
- `docs/release.md` gets a section on the move: the first version of the scoped package with a short-lived token, then the trusted publisher, then the old package deprecated.

**BREAKING (for users):** `npx stackledger` keeps resolving to the old, deprecated package (at most 0.4.0). New versions come only as `@brunosouzas/stackledger`.

Out of scope: unpublishing or transferring the old package (its versions stay installable); `@brunosouzas/design-system`; the owner's catalogue repository (its own PR after 0.4.1 is on npm); every step on npmjs.com, done by the owner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `package-release`: the package name, the SBOM folder and purl, and the scoped tarball and registry lookups.
- `catalogue-pipeline`: the template runs the scoped package, quoted in YAML.

## Impact

`package.json`, `npm-shrinkwrap.json`, `.github/workflows/release.yml`, `scripts/release-publish.sh`, the catalogue-repository template, docs, and the tests that name the package. No source under `src/` or `site/` changes.

## Implicit requirements

- Errors and invalid input: a token without the right permission makes `npm publish` fail with 403 before anything is published; the existing "Registry lookup fails" and "Version absent" scenarios cover the script, now under the scoped name.
- Limits: n/a, no size or count changes.
- Repetition and idempotency: unchanged; re-running the publish job for 0.4.1 follows "Completing a partial release" under the scoped name.
- Concurrency: n/a, one release at a time as before.
- Security: the first-version token is limited to the scope `@brunosouzas`, with no organisation access, kept only as an environment secret of `npm`, and revoked after the trusted publisher is set; the old package is deprecated by the owner with his own login.
- Logs and observability: n/a, the script's messages only change the package name they print.

## Documentation

`README.md` (install lines, what 0.4.1 changes), `docs/release.md` (the move to the organisation; commands with the new name), `docs/mcp.md`, `docs/skills.md`, `docs/demo.md`, `examples/catalogue-repository/README.md`, `AGENTS.md` (released versions). Brain: the stackledger changelog and the npm runbook after the release.
