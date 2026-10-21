# 6. Sign-in happens at an identity-aware proxy, not in stackledger

- Status: Accepted
- Date: 2026-10-20

## Context

A catalogue with real data must never be public. A company wants its staff to sign in with the accounts they already have (Google Workspace, Microsoft 365) and wants a record of who opened the site. The site is static ([ADR 5](0005-static-site-no-server.md)).

## Options considered

1. Build sign-in into stackledger: users, passwords, sessions.
2. Put the site behind an identity-aware proxy that signs people in with the company's identity provider, and keep stackledger free of authentication code.

## Decision

Option 2. The documented default is [Cloudflare Pages](https://developers.cloudflare.com/pages/) behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/), which is free for up to 50 users and can protect each path with its own policy. A second recipe covers any other host with a generic proxy (for example oauth2-proxy or Caddy).

The site itself adds the protections that do not need a server: no third-party scripts, fonts or CDNs, a strict Content Security Policy, no analytics, and `noindex` plus `robots.txt` so search engines skip it.

## Consequences

- stackledger stores no passwords and has no login code to get wrong.
- Sign-in, single sign-on and the access log come from the proxy and the identity provider.
- Running the site without a proxy publishes the catalogue to anyone with the address. The access recipes say so, and the build prints a reminder.
- The recipes are delivered by `catalogue-deployment`; see [hosting](../hosting.md) and the [tested Caddy example](../../examples/hosting/Caddyfile).
