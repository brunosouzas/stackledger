# The demo

<https://stackledger-demo.pages.dev/> shows the fictitious Northwind example in the corporate mode: the `full` and `staff` sites, each with the Software and Skills divisions. It is built from the files in this repository, never from real data:

- `examples/northwind/`: the software and licence catalogue;
- `examples/northwind-skills/`: the skill set, its playbooks and agents, and its skills map file.

It sits behind Cloudflare Access as described in [Hosting](hosting.md#corporate-mode-two-applications). Only the owner can sign in, so everyone else sees the sign-in page, which is the point.

## Rebuild and deploy

The owner deploys by hand, from the top of a clean checkout of `main`, with the released package and the same handoff as the [pipeline template](../examples/catalogue-repository/): only `full/`, `staff/`, `_headers`, `robots.txt` and `_redirects` are uploaded.

The package is installed into a temporary folder because, inside this repository, `npx stackledger@<version>` runs the local package of the same name instead of the released one.

```sh
out=$(mktemp -d)
npm install --prefix "$out/tool" --ignore-scripts --no-audit --no-fund stackledger@0.3.0 wrangler@4.151.3
bin="$out/tool/node_modules/.bin"
"$bin/stackledger" validate examples/northwind
"$bin/stackledger" skills validate examples/northwind-skills
"$bin/stackledger" build examples/northwind --out "$out/site" --date "$(date -u +%F)" \
  --skills examples/northwind-skills
mkdir -p "$out/deploy/site"
for entry in full staff _headers robots.txt _redirects; do cp -R "$out/site/$entry" "$out/deploy/site/"; done
commit=$(git rev-parse HEAD)
(cd "$out/deploy" && "$bin/wrangler" pages deploy site --project-name stackledger-demo --branch main \
  --commit-hash "$commit" --commit-message "demo $(date -u +%F) $commit")
```

Then check that Access still protects every address: an anonymous `curl -sI` on `/`, `/full/` and `/staff/` of `https://stackledger-demo.pages.dev/` must answer `302` to the Access sign-in.
