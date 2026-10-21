# hosting-recipes

## Purpose
Defines the access-control examples shipped with stackledger: the generic proxy example must keep `/full/` for finance, the rest for staff, and nothing for anyone else, failing closed.

## ADDED Requirements

### Requirement: Generic proxy example
`examples/hosting/Caddyfile` SHALL authenticate every request through `forward_auth` to oauth2-proxy before serving any file, serve `/full/*` only when the group header returned by the auth service holds `finance`, and answer 403 to any other signed-in request for `/full/*`.

#### Scenario: Anonymous request
- **WHEN** a request without a session asks for `/`, `/staff/`, `/full/`, `/full/renewals.ics` or an asset of either site
- **THEN** no site content is returned

#### Scenario: Staff identity
- **WHEN** a signed-in identity whose groups hold only `staff` asks for `/staff/` and for `/full/`, `/full/renewals.ics` and an asset under `/full/`
- **THEN** `/staff/` is served and every `/full/` path answers 403

#### Scenario: Finance identity
- **WHEN** a signed-in identity whose groups hold `finance` asks for `/full/` and `/staff/`
- **THEN** both are served

#### Scenario: Forged group header
- **WHEN** a staff identity's request carries its own `X-Auth-Request-Groups: finance`
- **THEN** `/full/` still answers 403

#### Scenario: Auth service down
- **WHEN** the auth service cannot be reached
- **THEN** every path answers an error with no site content
