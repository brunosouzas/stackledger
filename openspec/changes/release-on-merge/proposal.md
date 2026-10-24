# Proposal: release-on-merge

## Why

A version reaches npm only when the owner, after merging the pull request that bumps `package.json`, types `git tag v<version>` and `git push origin v<version>` by hand (`package-release`, "Release tags"; `docs/release.md`). The tag adds nothing the merge did not already decide, and a typo or a forgotten push delays the release. `brunosouzas-design-system` moved to releasing on the merge (its pull request #12, AB#171) and released 0.3.2 that way (run 40030380053). The owner asked for the same flow here (AB#172).

## What Changes

- **Release on the version merge.** `release.yml` also runs on every push to `main`. A first read-only job releases only when the push moves `main` forward (not forced, a fast-forward), changes `version` in `package.json` compared with the commit before the push, and the tag `v<version>` does not exist. Any other push to `main` stops there, green.
- **The pushed tag stays** as the manual path (retry, or a version whose run the owner rejected), checked as today.
- **Tag check from `main`:** it takes the pushed commit, and refuses a tag that already exists on another commit.
- **The tag is reserved before npm.** From `main`, the publishing job creates `v<version>` on the released commit through the GitHub API before asking npm; a tag that already exists must name that commit, or nothing is published. The GitHub release is then created on that tag with the SBOM, as today.
- **Unchanged:** the owner's approval in the environment `npm`, the checks, the SBOM, the scoped tarball, trusted publishing (it names the workflow file and the environment, not the trigger).
- Two one-time GitHub settings for the owner, documented in `docs/release.md`: the environment `npm` accepts the branch `main`; the tag ruleset no longer restricts creations (the workflow's token creates the tag).

## Capabilities

### Modified Capabilities

- `package-release`: how a release starts (detection and its errors), the tag check, the job graph of the checks and publishing jobs, the tag reservation, the partial-release rules after it, and concurrency per version.

## Out of scope

- Releasing 0.5.0. That is a separate version pull request, after this one or by the old flow.
- A label, a release branch or a changelog generator.
- A GitHub App to keep "Restrict creations" (design-system `docs/release.md` explains why not while the owner is the only writer).
- Any change to what the package contains or how it is checked.

## Implicit requirements

- **Errors and invalid input:** requirement ("Detection errors"). A forced or non-fast-forward push releases nothing; an unreadable `package.json` at the pushed commit, wrong arguments or a Git failure exit 1 in `detect`; a tag on another commit stops the release before npm. A previous commit that is all zeros or missing from the checkout releases nothing.
- **Limits:** n/a. One version per push.
- **Repetition and idempotency:** requirement. A later push with the same version releases nothing. Recovery is "Re-run failed jobs": GitHub keeps the successful `detect` and `check` jobs with their outputs and artifact, and the publishing script finds its own tag on the same commit and the same bytes on npm and only finishes what is missing. "Re-run all jobs" would stop in `detect` (the tag exists); then push the tag by hand.
- **Concurrency:** requirement. Runs of the same version (from `main` and from a pushed tag) share one concurrency group per job; a tag pushed by hand meanwhile is caught by the atomic reservation.
- **Security:** requirement. Untrusted event values reach scripts only through environment variables; `detect` and the checks keep read-only permissions; the publishing job keeps the owner's approval.
- **Logs and observability:** requirement. `detect` prints one line saying why it releases or not.

## Documentation

- `docs/release.md`: what the workflow does, releasing a version, who can release, the tag ruleset, and a section "Moving to release on merge".
- `AGENTS.md`: the release sentence.
- Vault: `10-personal/projects/stackledger/runbooks/publicar-versao-no-npm.md`, `architecture.md`, `roadmap.md`, `changelog.md`, after the pull request is ready.
