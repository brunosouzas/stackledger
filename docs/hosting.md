# Hosting the catalogue

A catalogue maps its owner's attack surface. Both sites must be behind sign-in, including their assets and calendar file. Publish only `full/`, `staff/`, `_headers` and `robots.txt` after a successful build. Never serve the build folder while it is being built: staging files can hold finance data outside `/full/` ([site publication rules](site.md#publishing-the-output)).

The [catalogue repository template](../examples/catalogue-repository/) checks and builds a separate catalogue repository and deploys it to Cloudflare Pages. Its README lists the secrets and variable. Protect the project before its first deployment.

## Cloudflare Pages with Access

Follow this order, so there is never an unprotected deployment. See [Pages Access settings](https://developers.cloudflare.com/pages/functions/plugins/cloudflare-access/) and [Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/).

1. Create an **empty** Pages project, without uploading anything:

   ```sh
   npx wrangler pages project create <project> --production-branch main
   ```

2. In the Pages project's settings, enable its Access policy ("Enable access policy"). Cloudflare creates an application for preview addresses. Edit that application and add the other application so the two below exist. Do not leave an extra, weaker application matching the same paths.
3. Choose an identity provider: one-time PIN by e-mail needs no provider setup; a company can use Google or Microsoft ([identity providers](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/)).
4. Configure the two self-hosted applications below, each with **every address** as an application destination: the custom domain if present, the production Pages address and the wildcard Pages address. The wildcard covers branch aliases and deployment previews. Use your own project, domain and groups; the examples are fictitious.
5. Only then run the template's first deploy. Check the requests below before sharing any link.

### stackledger full

Policy **finance**: Allow only the people or identity-provider group allowed to read costs and contracts. No Bypass policy and no public Allow policy.

Destinations (one path per address):

- `catalogue.example.org/full/*` (custom domain, if any)
- `<project>.pages.dev/full/*`
- `*.<project>.pages.dev/full/*`

### stackledger staff

Policy **staff**: Allow staff and finance identities. Finance must belong to this policy too so they can open staff pages.

Destinations (whole address):

- `catalogue.example.org` (custom domain, if any)
- `<project>.pages.dev`
- `*.<project>.pages.dev`

Access uses the most specific matching path, so `/full/*` uses finance on **every address**, not the broader staff policy. When adding a domain later, add its destinations to both applications before serving it.

### Check before sharing

On each address (custom domain, production Pages address, and a real preview or branch address), make anonymous requests with `curl -sI` to:

- `/`
- `/staff/`
- `/full/`
- `/full/renewals.ics`
- one actual asset below `/full/_astro/`
- one actual asset below `/staff/_astro/`

Pick the asset filenames from the built HTML, not a made-up filename. For example:

```sh
curl -sI https://catalogue.example.org/full/
curl -sI https://catalogue.example.org/full/renewals.ics
```

Every request must answer **302**, with `Location` pointing to `<team>.cloudflareaccess.com`. A 200, a direct asset response or a public error page is a failed check: do not share the deployment. Check policy destinations and precedence first.

Then sign in with a **staff-only** identity. `/staff/` and its assets must open; `/full/`, `/full/renewals.ics` and a full asset must be refused. Sign in as finance and verify both sites open. Repeat on every address. Changing an Access policy means repeating these checks.

### Rollback

Pages keeps production deployments labelled with the commit and build date by the template. In the project's Deployments list, select a known-good production deployment, then **Rollback to this deployment** ([Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)). Access remains in front of it. To fix forward, revert on `main`. A manual workflow run on an old ref does not deploy: only `refs/heads/main` can deploy.

## Any host: Caddy and oauth2-proxy

The tested example is [`examples/hosting/Caddyfile`](../examples/hosting/Caddyfile). Caddy serves the four entries and asks oauth2-proxy to authenticate **every site request** before serving files. The `/oauth2/*` endpoints themselves are routed to oauth2-proxy for sign-in and callbacks.

- `/full/*` (and `/full`) requires the exact group `finance`.
- All other site paths require `staff` or `finance`.
- Any other signed-in identity receives 403.
- Only `X-Auth-Request-Groups` returned by oauth2-proxy counts. Caddy drops the client's copy first, including when the auth answer has no groups.
- Anonymous requests go to sign-in. An unavailable auth service fails closed (502, no site content).

Use a real identity provider that returns group claims. This fictitious OIDC setup shows the relevant oauth2-proxy flags ([oauth2-proxy configuration](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/)):

```sh
# Supply these through your service's secret store, not the catalogue or a committed file:
# OAUTH2_PROXY_CLIENT_ID, OAUTH2_PROXY_CLIENT_SECRET, OAUTH2_PROXY_COOKIE_SECRET.
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://identity.example.org/realms/northwind \
  --redirect-url=https://catalogue.example.org/oauth2/callback \
  --http-address=127.0.0.1:4180 \
  --reverse-proxy=true \
  --upstream=static://202 \
  --email-domain=example.org \
  --oidc-groups-claim=groups \
  --scope='openid profile email groups' \
  --set-xauthrequest=true \
  --cookie-secure=true
```

Configure the provider to return `staff` and `finance` group claims. Do not use e-mail domains as a replacement for authorisation: Caddy still checks the groups. Use your provider's documented scopes (not all providers call the groups scope `groups`). oauth2-proxy must listen only on loopback or a private network reachable by Caddy, never publicly. Protect its client and cookie secrets in the host's secret store. The site's origin must not be reachable directly around Caddy.

Copy the Caddyfile, replace `catalogue.example.org`, `127.0.0.1:4180` and `/srv/stackledger/publish`, and run Caddy with it. Caddy manages HTTPS for the configured domain. Deploy only the four entries into that root, never build in it. The example repeats the security headers from `_headers` because Caddy does not interpret that file; it also serves `.ics` as `text/calendar` and redirects `/` to `/staff/` after authentication.

Run the same anonymous, staff and finance checks as above, plus: send a client `X-Auth-Request-Groups: finance` header as staff (still refused on full), and stop oauth2-proxy (every site request must fail with no content). The integration test does these with the real example Caddyfile and a small local stand-in for oauth2-proxy; it does not replace checking your identity provider's claims and network boundary.

## Calendar files are downloads, not subscriptions

`/full/renewals.ics` is for download and import. Calendar services fetch subscriptions without the reader's sign-in, so Access or the generic proxy refuses them. Never move it outside the protected path to make subscriptions work: it holds costs ([calendar rules](site.md#one-host-two-audiences)).
