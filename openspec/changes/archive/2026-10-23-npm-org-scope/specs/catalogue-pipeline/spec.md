## MODIFIED Requirements

### Requirement: Pinned tools
The workflow SHALL run stackledger as `npx --yes "$STACKLEDGER"`, with `STACKLEDGER` set once in the file to `"@brunosouzas/stackledger@<version>"` (quoted: a YAML plain value cannot start with `@`) at one exact version, pin every action by full commit SHA, install `wrangler` at one exact version, and download gitleaks as one pinned release whose SHA-256 checksum it verifies before use.

#### Scenario: Exact versions
- **WHEN** the template workflow is read
- **THEN** every `uses` names a 40-character SHA, `STACKLEDGER` is `@brunosouzas/stackledger@x.y.z`, wrangler has an exact `x.y.z` version, and the gitleaks download is followed by a checksum check that fails on a mismatch

#### Scenario: Scoped value parses
- **WHEN** the template workflow is parsed as YAML
- **THEN** parsing succeeds and `env.STACKLEDGER` is the string `@brunosouzas/stackledger@x.y.z`
