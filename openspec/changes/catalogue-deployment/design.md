# Design: catalogue-deployment

## Context

`stackledger build` already writes `full/`, `staff/`, `_headers`, `robots.txt` and a marker, atomically, and prints a proxy reminder; `docs/site.md` says to publish only the four entries and sketches Cloudflare Access per path. `test/integration/package.test.ts` already checks the packed file list for test code. The package is `private` and not on npm; the name `stackledger` is free (checked 2026-10-21). The owner's decisions are in the proposal.

## Decisions

### D1. Release from a tag, with provenance

`.github/workflows/release.yml`, one job on `ubuntu-latest`, Node 24 (needed for a current npm with trusted publishing):

1. checkout (`persist-credentials: false`), setup-node with `registry-url: https://registry.npmjs.org` and no cache;
2. `node scripts/check-release-tag.mjs "$GITHUB_REF_NAME"`: a 20-line script (not shipped) that exits 1 with one line when the tag is not `v` + `package.json` version;
3. `npm ci`, `npm run build`, `npm test`;
4. `npm publish --provenance --access public`, with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (empty after the first release, so npm uses OIDC);
5. `npm sbom --sbom-format cyclonedx --omit dev > stackledger-<version>.cdx.json`;
6. `gh release create "$GITHUB_REF_NAME" stackledger-<version>.cdx.json --generate-notes --verify-tag` with `GH_TOKEN: ${{ github.token }}`.

Permissions `contents: write` (the release) and `id-token: write` (OIDC and provenance). No environment protection beyond the tag: only the owner can push tags.

**First version.** npm can only configure a trusted publisher for a package that exists. So the owner creates a granular access token limited to publishing, stores it as `NPM_TOKEN`, pushes `v0.1.0`, then configures the trusted publisher (repository `brunosouzas/stackledger`, workflow `release.yml`) on npmjs.com, sets "require two-factor and disallow tokens", and deletes the token and the secret. `docs/release.md` lists these steps. Alternative rejected: publishing a placeholder package first with a third-party tool (it puts a version on npm that is not ours).

### D2. Package

`package.json`: remove `private`; add `repository`, `homepage`, `bugs`, `keywords`, `"prepack": "npm run build"`; description becomes "Govern your software stack and licences, drawn as a metro map". `files` stays `dist`, `site`, `skills`, `examples`; npm adds `README.md`, `LICENSE` and `package.json`. Tests: the existing package test gains the contents scenario; a new integration test packs into a temporary folder and installs the tarball into another temporary folder (`npm install --no-audit --no-fund`, with a temporary npm cache so the user's cache is untouched). Its dependencies come from the registry, so the test needs the network: it runs in CI and locally, and is skipped when `STACKLEDGER_OFFLINE=1`.

### D3. The catalogue template

`examples/catalogue-repository/.github/workflows/stackledger.yml`:

```yaml
name: stackledger
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: stackledger-${{ github.ref }}
  cancel-in-progress: false
env:
  STACKLEDGER: stackledger@0.1.0
  GITLEAKS_VERSION: 8.x.y
  GITLEAKS_SHA256: <checksum of the linux x64 tarball>
jobs:
  site:
    runs-on: ubuntu-latest
    steps:
      - checkout (persist-credentials: false, fetch-depth: 0 so gitleaks scans history)
      - setup-node 22
      - gitleaks: curl the release tarball, `sha256sum -c`, `gitleaks git --redact --exit-code 1 .`
      - run: npx --yes "$STACKLEDGER" validate .
      - run: npx --yes "$STACKLEDGER" build . --out "$RUNNER_TEMP/site"
      - collect: mkdir publish; cp -R full staff _headers robots.txt from the build output into publish
      - deploy (if push to refs/heads/main): npx --yes wrangler@<pinned> pages deploy publish --project-name "$PAGES_PROJECT" --branch main
```

`PAGES_PROJECT` is a repository variable; the two Cloudflare secrets appear only in the deploy step's `env`. The gitleaks binary rather than `gitleaks-action`: the action needs a paid licence for organisation accounts, and a pinned binary with a checksum is as reproducible. Tests read the YAML with the `yaml` package (dev use only), run `actionlint` on it when installed (it is in CI through a pinned download), and run the step scripts in bash with `npx --yes "$STACKLEDGER"` replaced by `node dist/cli.js`, so the commands that ship are the commands tested.

The `.gitignore` ignores `publish/` and `site-out/`. The README lists: the Pages project, the API token (template "Cloudflare Pages: Edit", limited to the account), the account ID, the variable, and the Access step from `docs/hosting.md` to do *before* the first deploy.

### D4. Access recipes

`docs/hosting.md`:

- **Cloudflare Pages and Access**: create the Pages project; in Zero Trust, an identity provider (one-time PIN by e-mail works with no setup; Google or Microsoft for a company); two self-hosted applications on the custom domain, `<domain>/full/*` with the finance policy and `<domain>` with the staff policy (Access picks the most specific path); a third application for `<project>.pages.dev` and `*.<project>.pages.dev`, so preview and default addresses are not open; check with `curl -sI` that each address answers 302 to `<team>.cloudflareaccess.com`.
- **Any host with a generic proxy**: Caddy with `forward_auth` to oauth2-proxy, one route for `/full/*` requiring the finance group and one for the rest; a complete, fictitious `Caddyfile` and the oauth2-proxy flags; `caddy validate` in the test when Caddy is installed.
- What each recipe does not cover: `renewals.ics` cannot be subscribed (already in `docs/site.md`).

### D5. The demo

Build `examples/northwind` with the same commands as the template, deploy to a Pages project `stackledger-demo`, protect `stackledger-demo.pages.dev`, `*.stackledger-demo.pages.dev` and, if the owner wants a custom domain, `stackledger-demo.brunosouzas.com`, with `/full/*` allowed only for the owner's e-mail and the rest for a staff list he chooses. The README links the demo and says it needs a sign-in. Verified by `curl -sI` from the agent (302 to the Access login on every address) and by the owner signing in.

## Risks / Trade-offs

- npm, GitHub or Cloudflare change their trusted-publishing or Access screens → recipes name the concepts and link the vendor pages next to each step.
- The install test needs the npm registry → it runs in CI; offline runs can skip it with `STACKLEDGER_OFFLINE=1`.
- Access applications are configured by hand in the dashboard → the recipe ends with a `curl` check for every address, which the demo proves.

## Open questions

1. **External pieces.** Recommend: the owner creates the npm account (with two-factor) and the one-time token; I write the exact steps. For Cloudflare, the owner follows `docs/hosting.md` in the dashboard for the Access applications (that also tests the recipe as a reader would), and either logs in again with `wrangler login` (to grant Pages) so I can deploy the demo, or gives an API token "Cloudflare Pages: Edit" stored in the Keychain.
2. **Demo address and policies.** Recommend `stackledger-demo.pages.dev` only (no custom domain for now), `/full/*` for the owner's e-mail, the rest for the owner's e-mail plus anyone he adds later, login by one-time PIN.
3. **gitleaks in the template.** Recommend the pinned binary with checksum (D3) over `gitleaks-action`.
