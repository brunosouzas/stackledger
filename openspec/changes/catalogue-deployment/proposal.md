# Proposal: catalogue-deployment

## Why

stackledger works from a clone of this repository, but nobody can use it from a catalogue repository yet: the package is not on npm, there is no pipeline that builds and publishes the two sites, and the access recipes promised by [ADR 6](../../../docs/adr/0006-authentication-at-an-identity-aware-proxy.md) are a paragraph in `docs/site.md`. Roadmap item 7, the last of v1.

The roadmap planned this item as `catalogue-git-source`, with building from a Git URL. The owner dropped the Git URL on 2026-10-21: a catalogue repository's own pipeline already has its files checked out, so `stackledger build .` is enough, and a Git URL would bring network access, credentials and Git's riskier transports into the tool for little gain. It moves to "Later", next to merging several catalogues.

## What Changes

- **Publishable package.** `package.json` drops `private`, gains the npm metadata (repository, homepage, bugs, keywords) and a `prepack` build, so `npm publish` always ships a fresh `dist/`. The lock file becomes `npm-shrinkwrap.json`, which npm ships, so users get the tested dependency versions.
- **Release workflow** (`.github/workflows/release.yml`): on a pushed tag `v<major>.<minor>.<patch>` equal to the package version, and on a commit already on `main`, a job without publishing rights builds, tests, audits, packs and writes a CycloneDX SBOM; a second job, in an environment that needs the owner's approval, publishes that same tarball to npm with provenance (OIDC trusted publishing; a one-time token only for the very first version) and attaches the SBOM to a GitHub release. A re-run finishes a partial release without publishing twice.
- **Catalogue repository template** (`examples/catalogue-repository/`, catalogue in `catalog/`): a GitHub Actions workflow for a separate catalogue repository that, on every pull request, push to `main`, weekly schedule and manual start, scans for secrets with gitleaks, runs `stackledger validate` (errors fail), builds both sites dated today in UTC and keeps only the four publishable entries; for runs on `main` that are not pull requests, a separate job on a fresh runner deploys them to Cloudflare Pages from an empty folder, labelled by commit and date. Plus a README with the setup.
- **Access recipes** (`docs/hosting.md`): Cloudflare Pages behind Cloudflare Access with one application for `/full/*` and one for the rest, each covering every address of the project (custom domain, `<project>.pages.dev`, `*.<project>.pages.dev`), with the anonymous and staff checks; and a generic recipe with Caddy in front of oauth2-proxy, whose example is tested against a stand-in auth service (anonymous, staff, finance, forged header, auth down).
- **A live demo**: the fictitious Northwind sites on Cloudflare Pages (`stackledger-demo`) behind Cloudflare Access on the owner's account, built from this branch with the template's commands, as proof of the recipe, before the merge. The owner configures Access; the agent creates the project and deploys only with his authorisation.
- Roadmap: row 7 becomes `catalogue-deployment`; "Build from a Git URL" moves to Later.

## Capabilities

### New Capabilities

- `package-release`: what the npm package contains and how a version is released.
- `catalogue-pipeline`: the catalogue repository template and what its workflow does.
- `hosting-recipes`: what the generic proxy example must allow and refuse.

### Modified Capabilities

None. The Cloudflare recipe and the demo are documentation and operations, checked by a docs test and by requests against the demo.

## Impact

- Files: `package.json`, `package-lock.json` → `npm-shrinkwrap.json`, `.github/workflows/release.yml`, `scripts/check-release-tag.mjs`, `scripts/release-publish.sh`, `examples/catalogue-repository/` (workflow, README, `.gitignore`), `examples/hosting/Caddyfile`, `docs/hosting.md` (new), `docs/release.md` (new), `docs/site.md`, `docs/roadmap.md`, README, AGENTS.md, ADR 6 (one sentence naming the change).
- No new runtime dependency and no change to any command.
- Outside the repository, done by the owner or with his credentials: the npm account and trusted publisher, the Cloudflare Pages project and Access applications of the demo.

## Out of scope

- Building from a Git URL, and merging several catalogues (moved to Later).
- Other CI platforms (Azure Pipelines, GitLab), other hosts beyond the two recipes.
- Publishing PR previews of a catalogue site (they would need the same protection; the template deploys `main` only).
- The owner's real catalogue repository (`stackledger-catalog`): created after v1 is closed.
- Changing `stackledger build` itself.

## Implicit requirements

- **Errors and invalid input:** requirement. A tag that does not match the package version stops the release before anything is published; a catalogue with errors fails the template workflow before the build; a leaked secret fails it before anything else.
- **Limits:** n/a. No new runtime behaviour.
- **Repetition and idempotency:** requirement. Re-running the release skips publishing when npm already has the same bytes, fails when it has other bytes, and completes the GitHub release either way; re-running the template on the same UTC day deploys the same files, and a later run moves renewal windows to its date.
- **Concurrency:** requirement. The template uses one concurrency group per branch, so two deploys of `main` never overlap.
- **Security:** requirement. Actions pinned by commit SHA; least permissions per job; the publishing identity never present while dependencies install, and the publish job runs only code from the tagged commit; releases only from commits on `main`, approved by the owner in the `npm` environment; the deploy runs in its own fresh job, from an empty folder, with wrangler installed with `--ignore-scripts` before the Cloudflare token is present; the published tarball is the tested one; `npm audit` must be clean before publishing; no long-lived npm token after the first release; Cloudflare secrets only in the deploy step; PRs never deploy; only `full/`, `staff/`, `_headers` and `robots.txt` are published; both Access applications cover every address of the project.
- **Logs and observability:** requirement. The release attaches its SBOM and npm shows provenance; the template's job log names the stackledger version it used.

## Open questions

Decided by the owner on 2026-10-21: drop the Git URL from v1; publish 0.1.0 to npm with provenance and SBOM as part of closing v1, and the template uses `npx stackledger@0.1.0`; GitHub Actions only; a live demo on his Cloudflare account, kept behind Access.

Gate 1 approved by the owner on 2026-10-21 with every recommendation in `design.md`, Open questions. None open.

## Documentation

- `docs/hosting.md` (new): the two access recipes and the template.
- `docs/release.md` (new): how a version is released, the first-release bootstrap, what provenance and the SBOM prove.
- `docs/site.md`: the hosting paragraph links to `docs/hosting.md`.
- `docs/roadmap.md`: row 7 renamed and delivered; Git URL under Later.
- `README.md`: install with `npm`, the demo link, the template; `AGENTS.md`: implemented list and the release rule.
- ADR 6: the recipes arrive with `catalogue-deployment`.
- Brain vault: `10-personal/projects/stackledger/_index.md`.
