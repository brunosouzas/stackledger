# Design: catalogue-deployment

## Context

`stackledger build` already writes `full/`, `staff/`, `_headers`, `robots.txt` and a marker, atomically, and prints a proxy reminder; `docs/site.md` says to publish only the four entries and sketches Cloudflare Access per path. `build --date` defaults to today in local time. `test/integration/package.test.ts` already checks the packed file list for test code. The package is `private` and not on npm; the name `stackledger` is free (checked 2026-10-21). The owner's decisions are in the proposal.

## Decisions

### D1. Release from a tag, in two jobs

`.github/workflows/release.yml`, triggered by `push` of tags `v*` (the shape is checked by the script, because a tag filter cannot express it exactly).

**Job `check`** (`ubuntu-latest`, Node 24, permissions `contents: read`): checkout with `persist-credentials: false`; `node scripts/check-release-tag.mjs "$GITHUB_REF_NAME"`; `npm ci`; `npm run build`; `npm test`; `npm audit --audit-level=low` (exits non-zero on any vulnerability or when the audit cannot run); `npm pack --json` (its `prepack` rebuilds `dist/` from the same sources) and keep the reported `integrity`; `npm sbom --sbom-format cyclonedx --omit dev > stackledger-<version>.cdx.json`; upload tarball, integrity and SBOM as one artifact.

**Job `publish`** (`needs: check`, permissions `contents: write`, `id-token: write`): checkout of the tagged commit (`persist-credentials: false`) only to get `scripts/release-publish.sh` from reviewed code; setup-node 24 with the npm registry, no cache; download the artifact into its own folder and use it as data only (the tarball, its integrity and the SBOM; nothing from it is executed, and npm publishes with `--ignore-scripts`). No install, no build.

`scripts/release-publish.sh <tarball> <integrity-file> <sbom>`:
- `npm view "stackledger@$VERSION" dist.integrity --json`: exit 0 with a string → compare; exit non-zero with `E404` in its output → absent; anything else (network, auth, empty or malformed output) → exit 1 before any change.
- absent → `npm publish <tarball> --provenance --access public --ignore-scripts`; equal → skip; different → exit 1.
- `gh release view "$TAG"`: exit 0 → `gh release upload "$TAG" <sbom> --clobber`; failure whose message is `release not found` → `gh release create "$TAG" <sbom> --verify-tag --generate-notes`; any other failure → exit 1. With `GH_TOKEN: ${{ github.token }}` and `GH_REPO: ${{ github.repository }}`.

A unit test runs the script with fake `npm` and `gh` on `PATH` that record their arguments, for each branch.

The publishing identity (`id-token: write`) never exists while dependencies are installed or their scripts run, and the code it runs comes from the tagged commit, not from the job that ran them. What remains: a dependency that compromised the build could alter the tarball itself; the tests ran on the same tree and provenance names the workflow, which is the usual npm trust model. Re-running the workflow after a failure in the release step finishes it without publishing again.

**First version.** npm configures a trusted publisher only for an existing package, so 0.1.0 uses a token. The owner, with two-factor on his npm account, creates a granular access token: packages and scopes read and write, all packages (the package does not exist yet), expiry 7 days, "bypass two-factor authentication" ticked (the job cannot answer a 2FA prompt). He stores it as the repository secret `NPM_TOKEN`, pushes `v0.1.0`, and after the release: configures the trusted publisher on npmjs.com (repository `brunosouzas/stackledger`, workflow `release.yml`, publishing allowed), sets the package to "require two-factor authentication and disallow tokens", revokes the token and deletes the secret. The `publish` job passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`; empty after the bootstrap, so npm uses OIDC. `docs/release.md` lists these steps and how to check provenance (`npm audit signatures` in a scratch install) and the SBOM.

Rejected: one job with `id-token: write` from the start (installation scripts would run with the publishing identity); publishing a placeholder package first with a third-party tool (it puts a version on npm that is not ours); pre-releases (no channel in v1; the tag check refuses them).

### D2. Package

`package.json`: remove `private`; add `repository`, `homepage`, `bugs`, `keywords`, `"prepack": "npm run build"`; description becomes "Govern your software stack and licences, drawn as a metro map". `files` stays `dist`, `site`, `skills`, `examples`; npm adds `README.md`, `LICENSE` and `package.json`; `scripts/` is not in `files`.

Tests: the existing package test gains the contents scenarios. A new integration test packs into a temporary folder and installs the tarball into another temporary folder (`npm install --no-audit --no-fund`, with a temporary npm cache so the user's cache is untouched). Its dependencies come from the registry, so it needs the network: it runs in CI and locally, and is skipped only when `STACKLEDGER_OFFLINE=1`.

### D3. The catalogue template

`examples/catalogue-repository/.github/workflows/stackledger.yml`, one job `site` on `ubuntu-latest`:

- triggers: `pull_request`; `push` to `main`; `schedule` weekly (Monday 06:00 UTC), so renewal windows move without a commit; `workflow_dispatch`;
- `permissions: contents: read`; `concurrency: { group: stackledger-${{ github.ref }}, cancel-in-progress: false }`;
- `env`: `STACKLEDGER: stackledger@0.1.0`, `WRANGLER: wrangler@<exact>`, `GITLEAKS_VERSION`, `GITLEAKS_SHA256` (linux x64 tarball);
- steps: checkout (`persist-credentials: false`, `fetch-depth: 0` so gitleaks scans history); setup-node 22, no cache; gitleaks (curl the release, `sha256sum -c`, `gitleaks git --redact --exit-code 1 .`); `npx --yes "$STACKLEDGER" validate .`; `npx --yes "$STACKLEDGER" build . --out "$RUNNER_TEMP/site" --date "$(date -u +%F)"`; collect (`mkdir publish` and copy `full`, `staff`, `_headers`, `robots.txt` from the build output);
- deploy, both with `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`: first `npm install --prefix "$RUNNER_TEMP/wrangler" --ignore-scripts --no-audit --no-fund "$WRANGLER"` with no secrets in its environment; then `"$RUNNER_TEMP/wrangler/node_modules/.bin/wrangler" pages deploy publish --project-name "$PAGES_PROJECT" --branch main`, the only step with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from secrets (and `PAGES_PROJECT` from `vars`). Wrangler's own code still runs with the token, as it must; its install scripts never do. Task 2.1 checks that `pages deploy` works from an install with `--ignore-scripts` (wrangler's platform binaries come as optional dependencies); if it does not, the change stops and asks.

The gitleaks binary rather than `gitleaks-action`: the action needs a paid licence for organisation accounts, and a pinned binary with a checksum is as reproducible.

Tests read the YAML with the `yaml` package (already a dependency), run `actionlint` on it, and run the step scripts in bash with `npx --yes "$STACKLEDGER"` replaced by `node dist/cli.js`, so the commands that ship are the commands tested. CI downloads a pinned `actionlint` with a checksum; locally the `actionlint` check is skipped when the binary is absent, and says so.

The `.gitignore` ignores `publish/`. The README lists the Pages project, the API token (template "Cloudflare Pages: Edit", one account), the account ID, the variable, and says to set up Access from `docs/hosting.md` *before* the first deploy.

### D4. Access recipes

`docs/hosting.md`:

- **Cloudflare Pages and Access.** Order, so the sites are never public: create the Pages project empty (`wrangler pages project create <project> --production-branch main`, no upload); in its settings, "Enable access policy" (Cloudflare creates an Access application for the preview addresses); then edit and add applications so that the two below exist; only then the first deploy. Identity provider: one-time PIN by e-mail (no setup) or Google/Microsoft for a company. Two self-hosted Access applications, each listing **every address** of the project as a destination: the custom domain (if any), `<project>.pages.dev` and `*.<project>.pages.dev` (branch and preview addresses):
  - `stackledger full`: `<address>/full/*` for each address, policy "finance";
  - `stackledger staff`: `<address>` for each address, policy "staff".
  Access applies the most specific path, so `/full/*` always uses the finance policy on every address. The check: anonymous `curl -sI` on `/`, `/staff/`, `/full/`, `/full/renewals.ics` and one asset under `/full/` and `/staff/`, on each address, answers 302 to `<team>.cloudflareaccess.com`; a staff-only identity gets the staff pages and is refused on every `/full/` path.
- **Any host with a generic proxy.** Caddy `forward_auth` to oauth2-proxy, one route for `/full/*` requiring the finance group and one for the rest. The example lives in `examples/hosting/Caddyfile` with the oauth2-proxy flags in `docs/hosting.md`, both fictitious.
- What the recipes do not cover: `renewals.ics` cannot be subscribed (already in `docs/site.md`).

Checks, in `test/unit/hosting-docs.test.ts`: `docs/hosting.md` names the three address patterns under both applications, and every path of the anonymous check; `caddy validate --config examples/hosting/Caddyfile` passes when Caddy is installed (it is on the owner's Mac; skipped and reported otherwise).

### D5. The demo

Proof of the recipe, not of npm. Built from this branch with the template's commands, with `node dist/cli.js` in place of `npx stackledger@0.1.0` (the package is published after the merge), and deployed to a Pages project `stackledger-demo`. Access follows `docs/hosting.md` exactly: both applications cover `stackledger-demo.pages.dev` and `*.stackledger-demo.pages.dev`; finance policy = the owner's e-mail; staff policy = the owner's e-mail plus a second e-mail of his, used only to test the refusal on `/full/`.

Order, following D4 so the demo is never public: (1) with the owner's authorisation, the agent creates the empty project; (2) the owner enables and configures Access from `docs/hosting.md`; (3) with his authorisation, the agent deploys; (4) the anonymous checks run on every address and path; (5) the owner signs in with each identity. The README links the demo only after (4) and (5) pass. All before the merge.

## Risks / Trade-offs

- npm, GitHub or Cloudflare change their screens → recipes name the concepts and link the vendor pages next to each step.
- The install test and the gitleaks test need the network → they run in CI; offline runs skip them with `STACKLEDGER_OFFLINE=1`.
- Access applications are configured by hand → the recipe ends with the anonymous and staff checks, which the demo runs.
- A weekly scheduled deploy changes the published files without a commit → intended: it moves renewal windows; same-day re-runs are identical.

## Open questions

The specs are written with the recommended answers below. A different answer at gate 1 changes the specs before any implementation starts.

1. **Who does the external steps.** Recommend: npm account and first token by the owner (D1 steps). For the demo, the owner creates the two Access applications by following `docs/hosting.md` (that also tests the recipe as a reader would), and authorises the agent to create the Pages project and deploy with `wrangler login` again (adds the Pages scope).
2. **Demo addresses and identities.** Recommend `stackledger-demo.pages.dev` only (no custom domain), finance = the owner's e-mail, staff = the owner's e-mail plus a second e-mail of his for the refusal test, login by one-time PIN.
3. **gitleaks in the template.** Recommend the pinned binary with checksum (D3) over `gitleaks-action`.
4. **Weekly scheduled run.** Recommend keeping it (renewal windows stay current); without it, the site only changes on a commit.
