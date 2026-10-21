## Scenario to test map

Levels: U unit, I integration (built CLI, packed package, or workflow steps run in bash). "network" marks tests that need the npm registry or the gitleaks download; they run in CI and locally, and are skipped only when `STACKLEDGER_OFFLINE=1`.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| package-release | Packed files; Pack without a build | `test/integration/package.test.ts` | I |
| package-release | Installed package runs; Two installs agree | `test/integration/package-install.test.ts` | I (network) |
| package-release | Metadata | `test/unit/package-metadata.test.ts` | U |
| package-release | Tag and version differ; Tag on an unmerged commit; Tag of another shape | `test/unit/release-tag.test.ts` (runs `scripts/check-release-tag.mjs`) | U |
| package-release | Checks job; Publishing job; Pinned | `test/unit/release-workflow.test.ts` | U |
| package-release | Version absent; Re-run after the release step failed; Same bytes without provenance; Version already published with other bytes; Registry lookup fails; Release lookup fails | `test/unit/release-publish.test.ts` (runs `scripts/release-publish.sh` with fake `npm` and `gh`) | U |
| catalogue-pipeline | Template files; Exact versions; Build date; Pull request does not deploy; Wrangler installed without secrets; Labelled deployment; Least privilege | `test/unit/catalogue-template.test.ts` | U |
| catalogue-pipeline | Build date travels with the files | `test/integration/catalogue-template.test.ts` | I |
| catalogue-pipeline | Copied template passes as is; Catalogue error stops the job; Catalogue warning does not stop the job; Only the four entries; Repository extras are not deployed | `test/integration/catalogue-template.test.ts` | I |
| catalogue-pipeline | Secret stops the job | `test/integration/catalogue-template.test.ts` | I (network) |
| hosting-recipes | Anonymous request; Staff identity; Finance identity; Signed in without an allowed group; Forged group header; Auth service down | `test/integration/hosting-caddy.test.ts` | I (needs `caddy`) |

`actionlint` and `caddy` run inside their tests; CI downloads pinned `actionlint` and Caddy with checksums, and a local run without a binary skips that check and says so. The text checks of `docs/hosting.md` and `docs/release.md` are in `test/unit/hosting-docs.test.ts` (D4).

## 1. Package and release

- [x] 1.1 `package.json` metadata and `prepack`; `package-lock.json` becomes `npm-shrinkwrap.json` (D2); package tests. Check: `npm test`; `npm pack --dry-run` lists what the scenario says.
- [ ] 1.2 `scripts/check-release-tag.mjs`, `scripts/release-publish.sh` and `.github/workflows/release.yml` in two jobs, publish in environment `npm` (D1); release tests; pinned `actionlint` and Caddy in `test.yml`. Check: `npm test`, `actionlint`.
- [ ] 1.3 `docs/release.md`: release steps, the `npm` environment and the tag ruleset, the first-version bootstrap with token scope, expiry, bypass and revocation, the trusted publisher with environment, verifying provenance (`npm audit signatures`) and the SBOM. Check: `test/unit/hosting-docs.test.ts` finds each bootstrap step.

## 2. Catalogue template

- [ ] 2.1 `examples/catalogue-repository/` (D3): workflow with jobs `site` and `deploy`, `.gitignore`, README (with rollback), `catalog/`; template tests. Check: `npm test`, `actionlint`; in a scratch folder, wrangler installed with `--ignore-scripts` runs `pages deploy --help` (if it cannot, stop and ask).

## 3. Access recipes

- [ ] 3.1 `docs/hosting.md` and `examples/hosting/Caddyfile` (D4); `docs/site.md` links them; `test/integration/hosting-caddy.test.ts`. Check: `npm test` with Caddy on `PATH` runs the Caddy tests (not skipped).

## 4. Documentation and roadmap

- [ ] 4.1 README (npm install, template, hosting), AGENTS.md (implemented list, release rule), ADR 6 sentence, roadmap row 7 renamed with the Git URL under Later. Check: `npm test` (docs tests), `openspec validate --all --strict`.

## 5. Demo (D5, before the merge; the owner configures Access, the agent creates the project and deploys with his authorisation)

- [ ] 5.1 Empty Pages project `stackledger-demo`; the owner enables and configures Access from `docs/hosting.md`; `examples/northwind` deployed with the template's commands (`node dist/cli.js` in place of `npx`). Check: anonymous `curl -sI` on `/`, `/staff/`, `/full/`, `/full/renewals.ics` and one asset of each site, on `stackledger-demo.pages.dev` and a preview address, all answer 302 to the Access login; the owner signs in with the staff-only identity and is refused on `/full/`, and with his main identity sees both sites. Then the README links the demo.

## After the merge (owner-controlled; not tasks of this change)

The PR marks roadmap row 7 "Delivered, 0.1.0 not yet released". Then, in order:

1. The owner releases 0.1.0 following `docs/release.md` (environment, token, tag ruleset, tag, approval).
2. The agent checks the release run, `npm view stackledger`, `npm audit signatures` in a scratch install, the SBOM on the GitHub release and `npx --yes stackledger@0.1.0 --help`.
3. The owner configures the trusted publisher, disallows tokens, revokes the token and deletes the secret.
4. A small follow-up commit changes row 7 to "Delivered, 0.1.0 released" and the brain note records v1 closed.
