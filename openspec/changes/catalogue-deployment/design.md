# Design: catalogue-deployment

## Context

`stackledger build` already writes `full/`, `staff/`, `_headers`, `robots.txt` and a marker, atomically, and prints a proxy reminder; `docs/site.md` says to publish only the four entries and sketches Cloudflare Access per path. `build --date` defaults to today in local time. `test/integration/package.test.ts` already checks the packed file list for test code. The package is `private` and not on npm; the name `stackledger` is free (checked 2026-10-21). The owner's decisions are in the proposal.

## Decisions

### D1. Release from a tag, in two jobs

`.github/workflows/release.yml`, triggered by `push` of tags `v*` (the shape is checked by the script, because a tag filter cannot express it exactly).

**Who can release.** Three controls, so a tag alone never publishes: (1) the tag check also requires the tagged commit to be on `origin/main` (`git merge-base --is-ancestor`), so only merged, reviewed code is released; (2) the `publish` job runs in the GitHub environment `npm`, which requires the owner's approval for every run and holds the bootstrap `NPM_TOKEN` as an environment secret (not a repository secret); (3) the npm trusted publisher names repository, workflow `release.yml` **and** environment `npm`. `docs/release.md` also has the owner add a tag ruleset that lets only him create `v*` tags.

**Job `check`** (`ubuntu-latest`, Node 24, permissions `contents: read`): checkout with `persist-credentials: false` and `fetch-depth: 0`; `node scripts/check-release-tag.mjs "$GITHUB_REF_NAME"` (shape, version, and on `origin/main`); `npm ci`; `npm run build`; `npm test`; `npm audit --audit-level=low` (exits non-zero on any vulnerability or when the audit cannot run); `npm pack --json` (its `prepack` rebuilds `dist/` from the same sources) and keep the reported `integrity`; `npm sbom --sbom-format cyclonedx --omit dev > stackledger-<version>.cdx.json`; upload tarball, integrity and SBOM as one artifact.

**Job `publish`** (`needs: check`, `environment: npm`, permissions `contents: write`, `id-token: write`): checkout of the tagged commit (`persist-credentials: false`) only to get `scripts/release-publish.sh` from reviewed code; setup-node 24 with the npm registry, no cache; download the artifact into its own folder and use it as data only (the tarball, its integrity and the SBOM; nothing from it is executed, and npm publishes with `--ignore-scripts`). No install, no build.

`scripts/release-publish.sh <tarball> <integrity-file> <sbom>`:
- `npm view "stackledger@$VERSION" dist --json`: exit 0 with an object holding `integrity` → compare; exit non-zero with `E404` in its output → absent; anything else (network, auth, empty or malformed output) → exit 1 before any change.
- absent → `npm publish <tarball> --provenance --access public --ignore-scripts`; equal integrity and `dist.attestations.provenance` present → skip; equal without provenance → exit 1 (a release without provenance is not finished by this workflow; the owner deprecates it and releases a new version); different → exit 1.
- `gh release view "$TAG"`: exit 0 → `gh release upload "$TAG" <sbom> --clobber`; failure whose message is `release not found` → `gh release create "$TAG" <sbom> --verify-tag --generate-notes`; any other failure → exit 1. With `GH_TOKEN: ${{ github.token }}` and `GH_REPO: ${{ github.repository }}`.

A unit test runs the script with fake `npm` and `gh` on `PATH` that record their arguments, for each branch.

The publishing identity (`id-token: write`) never exists while dependencies are installed or their scripts run, and the code it runs comes from the tagged commit, not from the job that ran them. What remains: a dependency that compromised the build could alter the tarball itself; the tests ran on the same tree and provenance names the workflow, which is the usual npm trust model. Re-running the workflow after a failure in the release step finishes it without publishing again.

**First version.** npm configures a trusted publisher only for an existing package, so 0.1.0 uses a token. The owner, with two-factor on his npm account, creates a granular access token: packages and scopes read and write, all packages (the package does not exist yet), expiry 7 days, "bypass two-factor authentication" ticked (the job cannot answer a 2FA prompt). He creates the environment `npm` with himself as required reviewer, stores the token as its secret `NPM_TOKEN`, pushes `v0.1.0` and approves the run; after the release he configures the trusted publisher on npmjs.com (repository `brunosouzas/stackledger`, workflow `release.yml`, environment `npm`, publishing allowed), sets the package to "require two-factor authentication and disallow tokens", revokes the token and deletes the secret. The `publish` job passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`; empty after the bootstrap, so npm uses OIDC. `docs/release.md` lists these steps and how to check provenance (`npm audit signatures` in a scratch install) and the SBOM.

Rejected: one job with `id-token: write` from the start (installation scripts would run with the publishing identity); publishing a placeholder package first with a third-party tool (it puts a version on npm that is not ours); pre-releases (no channel in v1; the tag check refuses them).

### D2. Package

`package.json`: remove `private`; add `repository`, `homepage`, `bugs`, `keywords`, `"prepack": "npm run build"`; description becomes "Govern your software stack and licences, drawn as a metro map". `files` becomes `dist`, `site`, `skills`, `examples`, `npm-shrinkwrap.json` (npm 11 does not add the shrinkwrap by itself when `files` is set; found while implementing); npm adds `README.md`, `LICENSE` and `package.json`; `scripts/` is not in `files`.

**Locked dependencies for users.** `package-lock.json` is renamed to `npm-shrinkwrap.json` (`npm shrinkwrap`). npm treats it like the lock file in this repository (`npm ci` reads it) and, unlike the lock file, ships it in the package, so `npx stackledger@0.1.0` installs exactly the dependency versions this repository tested and audited, not whatever the registry resolves that day. This is what lets the template promise the same files on a same-day re-run. Development dependencies in it are marked `dev`; npm 11 still installs them for users, as "extraneous" packages nothing loads, at their locked versions (found while implementing; the install test checks they are locked too).

Tests: the existing package test gains the contents scenarios. A new integration test packs into a temporary folder and installs the tarball twice, into two other temporary folders, and compares `npm ls --all --json` of both with the shrinkwrap's production entries (`npm install --no-audit --no-fund`, with a temporary npm cache so the user's cache is untouched). npm reads a dependency's shrinkwrap only when the registry says the version has one, so the test serves the packed tarball from a small local stand-in registry (`test/integration/registry-stand-in.ts`, which fetches every other package document from the npm registry) and installs `stackledger@<version>` from it, the path `npx` takes; a plain `npm install ./file.tgz` ignores the shrinkwrap. Its dependencies come from the registry, so it needs the network: it runs in CI and locally, and is skipped only when `STACKLEDGER_OFFLINE=1`.

### D3. The catalogue template

`examples/catalogue-repository/` is the root of a catalogue repository: `.github/workflows/stackledger.yml`, `.gitignore`, `README.md`, and the catalogue itself in `catalog/` (the loader reads every YAML file below the folder it is given except `.git` and `node_modules`, so the workflow's own YAML must be outside it). The template ships `catalog/` with one fictitious component so the copied repository validates and builds as is.

Two jobs:

**Job `site`** (`ubuntu-latest`, `permissions: contents: read`): checkout (`persist-credentials: false`, `fetch-depth: 0` so gitleaks scans history); setup-node 22, no cache; gitleaks (curl the pinned release, `sha256sum -c`, `gitleaks git --redact --exit-code 1 .`); `npx --yes "$STACKLEDGER" validate catalog`; `npx --yes "$STACKLEDGER" build catalog --out "$RUNNER_TEMP/site" --date "$(date -u +%F)"`; collect into `$RUNNER_TEMP/publish` only `full`, `staff`, `_headers`, `robots.txt`; write the build date into `$RUNNER_TEMP/build-date`; upload both as the artifact `site` (one-day retention). The date is computed once, in a step that sets `BUILD_DATE`, and used for `--date` and the file.

**Job `deploy`** (`needs: site`, `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`, `permissions: {}`): a fresh runner, so nothing the `site` job ran (stackledger and its dependencies through `npx`) can leave a process or hook behind. No checkout. Steps: setup-node 22; `npm install --prefix "$RUNNER_TEMP/wrangler" --ignore-scripts --no-audit --no-fund "$WRANGLER"` (no secrets); download the artifact into `$RUNNER_TEMP/deploy/site`, an otherwise empty folder; deploy with `working-directory: $RUNNER_TEMP/deploy` running `"$RUNNER_TEMP/wrangler/node_modules/.bin/wrangler" pages deploy site --project-name "$PAGES_PROJECT" --branch main --commit-hash "$GITHUB_SHA" --commit-message "stackledger $BUILD_DATE $GITHUB_SHA"` with `BUILD_DATE` read from the downloaded `build-date` file (the date of the files, even if the deploy runs after midnight); the artifact's `build-date` is moved out of the deploy folder before wrangler runs, the only step with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Running from an empty folder means wrangler finds no `functions/` folder and no `wrangler.toml`, so only the four entries are uploaded, whatever the catalogue repository holds. Wrangler's own code runs with the token, as it must; its install scripts never do.

- triggers: `pull_request`; `push` to `main`; `schedule` weekly (Monday 06:00 UTC), so renewal windows move without a commit; `workflow_dispatch`;
- `concurrency: { group: stackledger-${{ github.ref }}, cancel-in-progress: false }`;
- `env`: `STACKLEDGER: stackledger@0.1.0`, `WRANGLER: wrangler@<exact>`, `GITLEAKS_VERSION`, `GITLEAKS_SHA256` (linux x64 tarball).

The gitleaks binary rather than `gitleaks-action`: the action needs a paid licence for organisation accounts, and a pinned binary with a checksum is as reproducible.

**Same-day re-runs.** The shrinkwrap (D2) fixes stackledger's dependencies, `--date` fixes the date, and the build is deterministic for the same catalogue and date, so two runs on the same UTC day deploy the same files.

**Recovery.** Cloudflare Pages keeps every deployment, labelled here by commit and date. To go back: the project's deployments list → the previous production deployment → "Rollback to this deployment". Fixing forward is a revert commit on `main`. (A `workflow_dispatch` on an older ref does not deploy: the deploy condition requires `refs/heads/main`.) `docs/hosting.md` says so.

**Tests.** `test/unit/catalogue-template.test.ts` reads the YAML with the `yaml` package (already a dependency) and runs `actionlint`. `test/integration/catalogue-template.test.ts` copies the whole template into a temporary folder and runs the `site` job's step scripts in bash with `npx --yes "$STACKLEDGER"` replaced by `node dist/cli.js`, so the commands that ship are the commands tested; the adversarial case adds `functions/`, `wrangler.toml` and a stray YAML-free file at the repository root and checks the deploy folder still holds only `site/` with the four entries. CI downloads pinned `actionlint`; locally the `actionlint` check is skipped when the binary is absent, and says so.

The `.gitignore` ignores nothing the workflow needs (its outputs are in `$RUNNER_TEMP`); it lists `node_modules/` and `.DS_Store`. The README lists the Pages project, the API token (template "Cloudflare Pages: Edit", one account), the account ID, the variable, says to set up Access from `docs/hosting.md` *before* the first deploy, and how to roll back.

### D4. Access recipes

`docs/hosting.md`:

- **Cloudflare Pages and Access.** Order, so the sites are never public: create the Pages project empty (`wrangler pages project create <project> --production-branch main`, no upload); in its settings, "Enable access policy" (Cloudflare creates an Access application for the preview addresses); then edit and add applications so that the two below exist; only then the first deploy. Identity provider: one-time PIN by e-mail (no setup) or Google/Microsoft for a company. Two self-hosted Access applications, each listing **every address** of the project as a destination: the custom domain (if any), `<project>.pages.dev` and `*.<project>.pages.dev` (branch and preview addresses):
  - `stackledger full`: `<address>/full/*` for each address, policy "finance";
  - `stackledger staff`: `<address>` for each address, policy "staff".
  Access applies the most specific path, so `/full/*` always uses the finance policy on every address. The check: anonymous `curl -sI` on `/`, `/staff/`, `/full/`, `/full/renewals.ics` and one asset under `/full/` and `/staff/`, on each address, answers 302 to `<team>.cloudflareaccess.com`; a staff-only identity gets the staff pages and is refused on every `/full/` path.
- **Any host with a generic proxy.** Caddy `forward_auth` to oauth2-proxy: every request is authenticated first; only the groups in the `X-Auth-Request-Groups` header the proxy returns count (Caddy replaces any copy the client sent); `/full/*` requires `finance`, every other path `staff` or `finance`, and anything else answers 403; an unreachable auth service fails closed (502, no content). The example lives in `examples/hosting/Caddyfile` with the oauth2-proxy flags in `docs/hosting.md`, both fictitious.
- What the recipes do not cover: `renewals.ics` cannot be subscribed (already in `docs/site.md`).

Checks: `test/unit/hosting-docs.test.ts` checks that `docs/hosting.md` names the three address patterns under both applications and every path of the anonymous check, and that `docs/release.md` has each bootstrap step. `test/integration/hosting-caddy.test.ts` runs Caddy with the example `Caddyfile` (ports and site root replaced by test values) over a built Northwind site, with a small Node stand-in for oauth2-proxy that answers by a test header (anonymous → 401; signed in → 202 with the groups the test chooses: `staff`, `finance`, `contractors` or none) and can be stopped, and checks the outcomes in the `hosting-recipes` spec. It runs when `caddy` is on `PATH` (CI downloads a pinned Caddy with a checksum); otherwise it is skipped and says so.

### D5. The demo

Proof of the recipe, not of npm. Built from this branch with the template's commands, with `node dist/cli.js` in place of `npx stackledger@0.1.0` (the package is published after the merge), and deployed to a Pages project `stackledger-demo`. Access follows `docs/hosting.md` exactly: both applications cover `stackledger-demo.pages.dev` and `*.stackledger-demo.pages.dev`; finance policy = the owner's e-mail; staff policy = the owner's e-mail plus a second e-mail of his, used only to test the refusal on `/full/`.

Order, following D4 so the demo is never public: (1) with the owner's authorisation, the agent creates the empty project; (2) the owner enables and configures Access from `docs/hosting.md`; (3) with his authorisation, the agent deploys; (4) the anonymous checks run on every address and path; (5) the owner signs in with each identity. The README links the demo only after (4) and (5) pass. All before the merge.

## Risks / Trade-offs

- npm, GitHub or Cloudflare change their screens → recipes name the concepts and link the vendor pages next to each step.
- The install test and the gitleaks test need the network → they run in CI; offline runs skip them with `STACKLEDGER_OFFLINE=1`.
- Access applications are configured by hand → the recipe ends with the anonymous and staff checks, which the demo runs.
- A weekly scheduled deploy changes the published files without a commit → intended: it moves renewal windows; same-day re-runs are identical.
- The shrinkwrap pins users to this repository's tested dependency versions → a security fix in a dependency reaches users only with a new stackledger release; acceptable for a tool released by its maintainer, and `npm audit` runs on every release.
- The release needs the owner's approval in the `npm` environment → slower, intended.

## Open questions

None open. Gate 1 (owner, 2026-10-21) approved every recommendation:

1. **External steps.** The owner does npm (account with two-factor, environment `npm`, token, tag ruleset) from `docs/release.md`, and configures Access from `docs/hosting.md`. He renews `wrangler login` so the agent can create the empty demo project and deploy it.
2. **Demo.** `stackledger-demo.pages.dev` only, login by one-time PIN; finance = the owner's address; staff = the owner's address plus a second identity for the refusal test. The owner has no second mailbox, so the second identity is a plus address of his own mailbox (`<name>+staff@<domain>`): Access treats it as a different identity and the PIN still reaches him. No address is written in the repository.
3. **gitleaks:** pinned binary with checksum.
4. **Weekly scheduled run:** kept.
