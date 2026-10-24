# Tasks

Requested by the owner (AB#172), the same flow as brunosouzas-design-system #12. Gate 1, then tests before code; Codex reviews, Claude implements. Test level: **unit** (vitest, scripts run in temporary Git repositories or with fake `npm` and `gh` on `PATH`; the workflow read as YAML and with `actionlint`).

Scenarios carried unchanged keep their tests: "Tag and version differ", "Tag on an unmerged commit", "Tag of another shape" (`test/unit/release-tag.test.ts`); "Publishing job" (`test/unit/release-workflow.test.ts`); the "Completing a partial release", "Release workflow hardening" and "Scoped release files" scenarios (`test/unit/release-publish.test.ts`, `release-workflow.test.ts`).

## 1. Detection

- [ ] 1.1 Tests first in `test/unit/release-detect.test.ts`: "The version merge releases", "A later merge with the same version", "Version whose tag exists", "Several commits in one push", "Forced or rewritten main", "Pushed tag and other refs". Then `scripts/release-detect.mjs`. Check: the six pass.

## 2. Tag check

- [ ] 2.1 Tests first in `test/unit/release-tag.test.ts`: "From main before the tag exists", "From main with the tag on another commit". Then the `[<commit>]` argument in `scripts/check-release-tag.mjs`. Check: the five tag tests pass.

## 3. Publishing script

- [ ] 3.1 Tests first in `test/unit/release-publish.test.ts`, with a `gh` fake that keeps the tag and the release in files: "Reserve, publish, release", "Tag pushed meanwhile on another commit", "Tag already on the released commit", "GitHub cannot answer for the tag". Then the reservation in `scripts/release-publish.sh` (`RELEASE_TAG`, `RELEASE_COMMIT`). Check: all publish tests pass and `shellcheck` is clean.

## 4. Workflow

- [ ] 4.1 Tests first in `test/unit/release-workflow.test.ts`: the trigger test becomes "Release on the version merge" reading `on` (`main` and `v*`) and the detect job (read-only, values through `env`, outputs `release` and `tag`); "Checks job" keeps its order with the tag check fed by `detect`; the SBOM and publish steps read the tag from `detect`. Then `.github/workflows/release.yml`. Check: workflow tests pass, `actionlint` reports nothing.

## 5. Documentation

- [ ] 5.1 `docs/release.md` and `AGENTS.md` (proposal, Documentation). Vault notes on the vault's `main` after the pull request is ready. Check: `npm run build && npm test` exits 0 and `openspec validate --all --strict` passes.
