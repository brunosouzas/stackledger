# The demo

<https://stackledger-demo.pages.dev/> shows the fictitious Northwind example in the corporate mode: the `full` and `staff` sites, each with the Software and Skills divisions. It is built from the files in this repository, never from real data:

- `examples/northwind/`: the software and licence catalogue;
- `examples/northwind-skills/`: the skill set, its playbooks and agents, and its skills map file.

It sits behind Cloudflare Access as described in [Hosting](hosting.md#corporate-mode-two-applications). Only the owner can sign in, so everyone else sees the sign-in page, which is the point.

## Rebuild and deploy

The owner deploys by hand with the released package and the same handoff as the [pipeline template](../examples/catalogue-repository/): only `full/`, `staff/`, `_headers`, `robots.txt` and `_redirects` are uploaded.

You need Node.js 22.12 or later and a wrangler sign-in to the account that owns the `stackledger-demo` Pages project (`wrangler login`, or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment). Run the block from the top of this repository, on `main`, with no local changes.

The package is installed into a temporary folder because, inside this repository, `npx @brunosouzas/stackledger@<version>` runs the local package of the same name instead of the released one.

```sh
(
  set -eu
  git fetch --quiet origin main
  test -z "$(git status --porcelain)" || { echo "Local changes: commit or stash them first" >&2; exit 1; }
  commit=$(git rev-parse HEAD)
  [ "$commit" = "$(git rev-parse origin/main)" ] || { echo "HEAD is not origin/main" >&2; exit 1; }
  date=$(date -u +%F)
  out=$(mktemp -d)
  npm install --prefix "$out/tool" --ignore-scripts --no-audit --no-fund @brunosouzas/stackledger@0.7.0 wrangler@4.151.3
  bin="$out/tool/node_modules/.bin"
  "$bin/stackledger" validate examples/northwind
  "$bin/stackledger" skills validate examples/northwind-skills
  "$bin/stackledger" build examples/northwind --out "$out/site" --date "$date" --skills examples/northwind-skills
  mkdir -p "$out/deploy/site"
  for entry in full staff _headers robots.txt _redirects; do cp -R "$out/site/$entry" "$out/deploy/site/"; done
  cd "$out/deploy"
  WRANGLER_SEND_METRICS=false "$bin/wrangler" pages deploy site --project-name stackledger-demo --branch main \
    --commit-hash "$commit" --commit-message "demo $date $commit"
)
```

`set -eu` stops the block at the first failure, so a failed validation or build never reaches the deploy. `validate` and `skills validate` exit 1 on errors only; warnings do not stop it.

## Check after the deploy

Run the anonymous checks of [Check the corporate sites](hosting.md#check-the-corporate-sites) on `stackledger-demo.pages.dev` and on the preview address wrangler printed: `/`, `/staff/`, `/full/`, `/full/renewals.ics` and one real asset below `/full/_astro/` and `/staff/_astro/` (take the file names from the built HTML). Every request must answer `302` to the Access sign-in. The staff-only sign-in check is skipped for the demo: only the owner's identity is allowed, so there is no staff-only identity to test with.
