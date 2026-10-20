# Security policy

## Reporting a vulnerability

Please report security problems privately through [GitHub's private vulnerability reporting](https://github.com/brunosouzas/stackledger/security/advisories/new), not in a public issue. Include what you found, how to reproduce it with fictitious data, and the version or commit you tested. You should get a first answer within a week.

## Supported versions

stackledger has no release yet. Until 1.0, only the latest release will receive fixes.

## What is in scope

- Data from the `full` view reaching the `staff` view, or any part of the built site.
- A secret, private key or card number accepted by `stackledger validate`.
- The tool writing outside its output folder, using the network during discovery or validation, or needing `sudo`.
- The MCP server serving data that its `--view` should hide.

Misconfigured hosting (a site published without an identity-aware proxy) is outside the tool, but tell us if the documentation made it easy to get wrong.

The design behind these rules is in [ADR 6](docs/adr/0006-authentication-at-an-identity-aware-proxy.md) and [ADR 7](docs/adr/0007-two-views-built-as-separate-sites.md).
