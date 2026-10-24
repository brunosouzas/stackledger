# Tasks

Requested by the owner (AB#172), the same flow as brunosouzas-design-system #12. Gate 1, then tests before code; Codex reviews, Claude implements. Test level: **unit** (vitest; scripts run in temporary Git repositories or with fake `npm` and `gh` on `PATH`; the workflow read as YAML and with `actionlint`).

Scenarios carried unchanged keep their tests (unit):
- `test/unit/release-tag.test.ts`: "Tag and version differ", "Tag on an unmerged commit", "Tag of another shape".
- `test/unit/release-publish.test.ts`: "Version absent", "Re-run after the release step failed", "Same bytes without provenance", "Version already published with other bytes", "Registry lookup fails", "Release lookup fails", "Lookup under the scoped name" (inside the "Version absent" test).
- `test/unit/release-workflow.test.ts`: "Pinned" (with `actionlint`), "Scoped tarball in the workflow" (inside the "Checks job" test, which now reads the tag from `detect`), and "SBOM product identity" in `test/integration/package.test.ts` (integration, unchanged).

## 1. Detection

- [ ] 1.1 Tests first in `test/unit/release-detect.test.ts`: "The version merge releases", "A later merge with the same version" (detector output), "Version whose tag exists", "Several commits in one push", "Forced or rewritten main", "Pushed tag and other refs", "Unreadable version", "Forced push wins over an unreadable version", "Previous version missing or unreadable", "Git fails", "Wrong arguments". Then `scripts/release-detect.mjs` (design: ported from the sibling, with the error rules of "Detection errors"). Check: the eleven pass.

## 2. Tag check

- [ ] 2.1 Tests first in `test/unit/release-tag.test.ts`: "From main before the tag exists", "From main with the tag on another commit". Then the `[<commit>]` argument in `scripts/check-release-tag.mjs`. Check: the five tag tests pass.

## 3. Publishing script

- [ ] 3.1 Tests first in `test/unit/release-publish.test.ts`, with a `gh` fake that keeps the tag and the release in files: "Reserve, publish, release", "Tag pushed meanwhile on another commit", "Tag already on the released commit", "GitHub cannot answer for the tag", "Registry fails after the reservation". Then the reservation in `scripts/release-publish.sh` (`RELEASE_TAG`, `RELEASE_COMMIT`). Check: all publish tests pass and `shellcheck` is clean.

## 4. Workflow

- [ ] 4.1 Tests first in `test/unit/release-workflow.test.ts`: "Release on the version merge" (`on` is `main` and `v*`; the detect job has `contents: read`, gets `ref_type`, `ref_name`, `event.before`, `event.forced` only through `env`, outputs `release` and `tag`); "A later merge with the same version" (workflow side: `check` needs `detect` with `if: needs.detect.outputs.release == 'true'`, `publish` needs `detect` and `check`); "Checks job" and "Publishing job" with the new graph; "Concurrency groups"; the SBOM and publish steps read the tag from `detect`, never `GITHUB_REF_NAME`. Then `.github/workflows/release.yml`. Check: workflow tests pass, `actionlint` reports nothing.

## 5. Documentation

- [ ] 5.1 `docs/release.md` (what the workflow does, releasing a version with "Re-run failed jobs" as recovery and the tag recovery of the proposal, who can release, the tag ruleset, "Moving to release on merge") and `AGENTS.md`. Vault notes on the vault's `main` after the pull request is ready. Check: `npm run build && npm test` exits 0 and `openspec validate --all --strict` passes.
