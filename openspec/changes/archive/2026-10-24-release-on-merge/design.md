# Design: release-on-merge

The flow is the one `brunosouzas-design-system` runs since its pull request #12 (AB#171): `scripts/release-detect.mjs`, the `[<commit>]` argument of `scripts/check-release-tag.mjs`, and the tag reservation of `scripts/release-publish.sh`. This change ports it and keeps stackledger's own parts (SBOM, scoped tarball, `pack-production.mjs`).

## Decisions

- **Signal: the `version` line of the merged diff**, compared between `github.event.before` and `github.sha`. Rejected: a label (one more thing to forget), a release branch (more ceremony than the owner wants), "every merge" (most merges release nothing).
- **The tag is reserved before npm** with `gh api -X POST repos/<repo>/git/refs` (atomic: GitHub answers 422 when it exists). Rejected: creating it after npm, or `gh release create --target` (GitHub ignores `--target` when the tag exists), because a tag pushed by hand between the checks and the release would attach the release to another commit. Cost: a run stopped after the reservation leaves the tag without an npm version; a re-run publishes on it.
- **A tag created by the workflow's own token does not start the workflow again** (GitHub runs no workflow for events of `GITHUB_TOKEN`), so there is no second run to approve.
- **Event values** (`ref_type`, `ref_name`, `event.before`, `event.forced`, `sha`) reach scripts only through `env`, never interpolated into `run:`.
- **Version from the released commit:** the check job's SBOM step and the publish step read the tag from `detect`'s output, not from `GITHUB_REF_NAME`, which is `main` on a push to the branch.
- **Concurrency per version tag** at job level (`release-<tag>` for checks, `release-<tag>-publish` for publishing), so a branch run and a manual tag run of the same version never publish at the same time.

## Files

`.github/workflows/release.yml`, `scripts/release-detect.mjs` (new), `scripts/check-release-tag.mjs`, `scripts/release-publish.sh`, `test/unit/release-{detect,tag,publish,workflow}.test.ts`, `docs/release.md`, `AGENTS.md`.
