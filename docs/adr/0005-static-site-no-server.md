# 5. The website is a static site; no server and no database

- Status: Accepted
- Date: 2026-10-20

## Context

People who govern software want to open a website and see their software and licences. The main user is one person; the next are small companies with no one to run servers.

## Options considered

1. A web application with a server and a database, where people log in and edit.
2. A desktop application.
3. A static site generated from the catalogue by `stackledger build`, hosted anywhere.

## Decision

Option 3, built with [Astro](https://astro.build/). Editing stays in the catalogue repository (YAML and pull requests) in the first version.

## Consequences

- Nothing to run, patch or back up beyond the catalogue repository; hosting can be free.
- The attack surface is small: no login code, no database, no API that writes.
- Whatever reaches a browser is visible to that browser, so access control has to happen before the site, and sensitive fields have to be removed at build time (see [ADR 6](0006-authentication-at-an-identity-aware-proxy.md) and [ADR 7](0007-two-views-built-as-separate-sites.md)).
- Editing from the website (by opening a pull request) is on the roadmap, not in the first version.
