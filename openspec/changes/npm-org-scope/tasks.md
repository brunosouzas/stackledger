## Scenario to test map

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| package-release | Metadata | `test/unit/package-metadata.test.ts` | U |
| package-release | Command name under the scoped package | `test/integration/package-install.test.ts` ("Installed package runs" for the command, "Two installs agree" for `node_modules/@brunosouzas/stackledger`, both through `test/integration/registry-stand-in.ts`) | I |
| package-release | SBOM product identity | `test/integration/package.test.ts` | I |
| package-release | Scoped tarball in the workflow | `test/unit/release-workflow.test.ts` (checks job, publishing job) | U |
| package-release | Lookup under the scoped name | `test/unit/release-publish.test.ts` | U |
| catalogue-pipeline | Exact versions; Scoped value parses | `test/unit/catalogue-template.test.ts`, `test/integration/catalogue-template.test.ts` ("Copied template passes as is") | U, I |

## 1. Package name and release files

- [ ] 1.1 Tests first: the scenarios above with the scoped name (metadata, SBOM name and encoded purl, scoped tarball in the workflow, scoped lookups and no unscoped call, `STACKLEDGER` quoted and parsed). The registry stand-in decodes `/@brunosouzas%2fstackledger`. Verify: they fail on `main`.
- [ ] 1.2 `package.json` and `npm-shrinkwrap.json` named `@brunosouzas/stackledger`, version 0.4.1 (`npm version 0.4.1 --no-git-tag-version`); `scripts/release-publish.sh` with one `package` variable; `.github/workflows/release.yml` with the scoped tarball and the SBOM folder `@brunosouzas/stackledger`. Verify: `npm test`; `npm pack --dry-run` names `brunosouzas-stackledger-0.4.1.tgz`.

## 2. Template and documentation

- [ ] 2.1 `examples/catalogue-repository/.github/workflows/stackledger.yml` (`STACKLEDGER: "@brunosouzas/stackledger@0.4.1"`) and its README; README, `docs/mcp.md`, `docs/skills.md`, `docs/demo.md`, `docs/release.md` commands with the new name at 0.4.1 (`docs/release.md` examples that name a version use 0.4.1, the first scoped one); `docs/how-it-works.md` (the npm registry box, line 18, and the `npx` edge, line 28) and `scripts/how-it-works-diagram.py` (the registry box, line 105, and the `npx` label, line 112) with the new name, the SVG redrawn; README line on what 0.4.1 changes; `AGENTS.md` released versions. Verify: `test/unit/deployment-docs.test.ts`, `test/integration/docs.test.ts`.
- [ ] 2.2 `docs/release.md`: fold "Setting up the first version" (today lines 47–101: version 0.1.0, a token for All packages, the trusted publisher on the package `stackledger` at line 96) into one section for the scoped package, with a short note that 0.1.0–0.4.0 were published unscoped as `stackledger`. The section gives the owner's steps (token limited to the scope `@brunosouzas`, read and write but not stage-only, **Bypass two-factor authentication** ticked because the job cannot answer a 2FA prompt, no organisation access, 7 days; if the publish fails with 403 or 404 on the PUT, a new token with organisation read access; environment secret; tag `v0.4.1`; trusted publisher and "disallow tokens" on the new package; revoke the token and delete the secret; `npm deprecate stackledger "Moved to @brunosouzas/stackledger"` with the owner's login). Verify: `git diff --check`, `openspec validate --all --strict --no-interactive`.
