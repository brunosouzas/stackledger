## Context

The package moves from the npm user `bruno_souza` to the organisation `brunosouzas`.

## Decisions

- **A scoped name, not team access to the old name.** Adding `stackledger` to a team of the organisation grants publishing rights but leaves the package unscoped and its maintainer `bruno_souza`; a real transfer needs npm support. `@brunosouzas/stackledger` shows the owner in the name.
- **0.4.1, not 0.4.0 again.** The release tag must equal the version, and `v0.4.0` exists. 0.4.1 is the 0.4.0 code under the new name.
- **The scoped tarball name written in the workflow,** like the unscoped one before, rather than read from `npm pack`'s JSON: one name to read in review, and `test/unit/release-workflow.test.ts` pins it.
- **The SBOM folder carries the scoped name.** `npm sbom --package-lock-only` names the metadata component after the folder it runs in; a folder `@brunosouzas/stackledger` gives the name `@brunosouzas/stackledger` and the purl `pkg:npm/%40brunosouzas/stackledger@<version>` (checked locally with npm 11). The asset keeps the name `stackledger-<version>.cdx.json` so its download pattern in `docs/release.md` holds for old and new versions.
- **The old package is deprecated, not unpublished.** npm does not allow unpublishing a package others may depend on after 72 hours, and pinned users keep working.

## Risks

- Users typing `npx stackledger` get the old package with a deprecation warning. Mitigation: every doc uses the new name, and the deprecation message names it.
- The first publish under the organisation could need organisation permission on the token. Mitigation: the job fails with 403 before publishing; the owner makes a new token and re-runs.
