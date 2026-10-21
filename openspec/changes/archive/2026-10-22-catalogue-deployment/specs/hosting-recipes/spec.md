# hosting-recipes

## Purpose
Defines the access-control examples shipped with stackledger: the generic proxy example must keep `/full/` for the `finance` group, the rest for the `staff` and `finance` groups, and nothing for anyone else, failing closed.

## ADDED Requirements

### Requirement: Generic proxy example
`examples/hosting/Caddyfile` SHALL authenticate every request through `forward_auth` to oauth2-proxy before serving any file. Using only the groups the auth service returns, it SHALL serve `/full/*` to `finance`, every other path to `staff` or `finance`, and answer 403 to any other signed-in request.

#### Scenario: Anonymous request
- **WHEN** a request without a session asks for `/`, `/staff/`, `/full/`, `/full/renewals.ics` or an asset of either site
- **THEN** no site content is returned

#### Scenario: Staff identity
- **WHEN** a signed-in identity whose groups hold only `staff` asks for `/staff/` and for `/full/`, `/full/renewals.ics` and an asset under `/full/`
- **THEN** `/staff/` is served and every `/full/` path answers 403

#### Scenario: Finance identity
- **WHEN** a signed-in identity whose groups hold `finance` asks for `/full/` and `/staff/`
- **THEN** both are served

#### Scenario: Signed in without an allowed group
- **WHEN** a signed-in identity with no groups, or only the group `contractors`, asks for `/`, `/staff/` and `/full/`
- **THEN** every path answers 403

#### Scenario: Forged group header
- **WHEN** a staff identity's request, or one with no group, carries its own `X-Auth-Request-Groups: finance`
- **THEN** `/full/` still answers 403, and for the identity with no group `/staff/` too

#### Scenario: Auth service down
- **WHEN** the auth service cannot be reached
- **THEN** every path answers an error with no site content
