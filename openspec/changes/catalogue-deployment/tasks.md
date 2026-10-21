## Scenario to test map

Levels: U unit, I integration (built CLI, packed package, or workflow steps run in bash). "network" marks tests that need the npm registry or the gitleaks download; they run in CI and locally, and are skipped when `STACKLEDGER_OFFLINE=1`.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| package-release | Packed files; Pack without a build | `test/integration/package.test.ts` | I |
| package-release | Installed package runs | `test/integration/package-install.test.ts` | I (network) |
| package-release | Metadata | `test/unit/package-metadata.test.ts` | U |
| package-release | Tag and version differ | `test/unit/release-tag.test.ts` (runs `scripts/check-release-tag.mjs`) | U |
| package-release | Only tags trigger a release; Publication comes last; SBOM attached; Pinned and least privilege | `test/unit/release-workflow.test.ts` | U |
| catalogue-pipeline | Template files; Exact versions; Pull request does not deploy; Least privilege | `test/unit/catalogue-template.test.ts` | U |
| catalogue-pipeline | Catalogue error stops the job; Only the four entries | `test/integration/catalogue-template.test.ts` | I |
| catalogue-pipeline | Secret stops the job | `test/integration/catalogue-template.test.ts` | I (network) |

`actionlint` runs inside the workflow tests when the binary is on `PATH`; CI downloads a pinned `actionlint` with a checksum so it always runs there.

## 1. Package and release

- [ ] 1.1 `package.json` metadata and `prepack` (D2); package tests. Check: `npm test`, `npm pack --dry-run` lists what the scenario says.
- [ ] 1.2 `scripts/check-release-tag.mjs` and `.github/workflows/release.yml` (D1); release tests; pinned `actionlint` in `test.yml`. Check: `npm test`, `actionlint`.
- [ ] 1.3 `docs/release.md`: the release steps, the first-version bootstrap, verifying provenance (`npm audit signatures`) and the SBOM. Check: docs tests.

## 2. Catalogue template

- [ ] 2.1 `examples/catalogue-repository/` (D3): workflow, `.gitignore`, README; template tests. Check: `npm test`, `actionlint`.

## 3. Access recipes

- [ ] 3.1 `docs/hosting.md` (D4) with the fictitious `Caddyfile` and oauth2-proxy flags; `docs/site.md` links it; `caddy validate` of the example when Caddy is installed. Check: docs tests.

## 4. Demo (with the owner's accounts, after gate 1)

- [ ] 4.1 The owner sets up Cloudflare Access by following `docs/hosting.md`; the agent deploys `examples/northwind` to `stackledger-demo` with the template's commands. Check: `curl -sI` on each demo address answers 302 to the Access login; the owner signs in and sees `/full/` and `/staff/`.

## 5. Documentation and roadmap

- [ ] 5.1 README (npm install, demo link, template), AGENTS.md, ADR 6 sentence, roadmap row 7 renamed and Git URL under Later. Check: docs tests, `openspec validate --all --strict`.


The release of 0.1.0 itself happens after the merge (the archived change must have every task done): the owner creates the npm token and secret and pushes `v0.1.0`, the agent checks the run, `npm view stackledger`, `npm audit signatures` in a scratch install and the SBOM, and the owner then configures the trusted publisher and deletes the token (`docs/release.md`).
