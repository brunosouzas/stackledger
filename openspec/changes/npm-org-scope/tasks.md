## Scenario to test map

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| package-release | Metadata | `test/unit/package-metadata.test.ts` | U |
| package-release | Command name under the scoped package | `test/integration/package-install.test.ts` ("Installed package runs", through `test/integration/registry-stand-in.ts`) | I |
| package-release | SBOM product identity | `test/integration/package.test.ts` | I |
| package-release | Scoped tarball in the workflow | `test/unit/release-workflow.test.ts` (checks job, publishing job) | U |
| package-release | Lookup under the scoped name | `test/unit/release-publish.test.ts` | U |
| catalogue-pipeline | Exact versions; Scoped value parses | `test/unit/catalogue-template.test.ts`, `test/integration/catalogue-template.test.ts` ("Copied template passes as is") | U, I |

## 1. Package name and release files

- [ ] 1.1 Tests first: the scenarios above with the scoped name (metadata, SBOM name and encoded purl, scoped tarball in the workflow, scoped lookups and no unscoped call, `STACKLEDGER` quoted and parsed). The registry stand-in decodes `/@brunosouzas%2fstackledger`. Verify: they fail on `main`.
- [ ] 1.2 `package.json` and `npm-shrinkwrap.json` named `@brunosouzas/stackledger`, version 0.4.1 (`npm version 0.4.1 --no-git-tag-version`); `scripts/release-publish.sh` with one `package` variable; `.github/workflows/release.yml` with the scoped tarball and the SBOM folder `@brunosouzas/stackledger`. Verify: `npm test`; `npm pack --dry-run` names `brunosouzas-stackledger-0.4.1.tgz`.

## 2. Template and documentation

- [ ] 2.1 `examples/catalogue-repository/.github/workflows/stackledger.yml` (`STACKLEDGER: "@brunosouzas/stackledger@0.4.1"`) and its README; README, `docs/mcp.md`, `docs/skills.md`, `docs/demo.md`, `docs/release.md` commands with the new name at 0.4.1; README line on what 0.4.1 changes; `AGENTS.md` released versions. Verify: `test/unit/deployment-docs.test.ts`, `test/integration/docs.test.ts`.
- [ ] 2.2 `docs/release.md`: a section "Moving to the npm organisation" with the owner's steps (token limited to the scope `@brunosouzas`, read and write but not stage-only, no organisation access, 7 days; environment secret; tag `v0.4.1`; trusted publisher and "disallow tokens" on the new package; revoke the token and delete the secret; `npm deprecate stackledger "Moved to @brunosouzas/stackledger"` with the owner's login). Verify: `git diff --check`, `openspec validate --all --strict --no-interactive`.
