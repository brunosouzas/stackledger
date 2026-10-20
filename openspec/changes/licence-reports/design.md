# Design: licence-reports

## Context

Delivered: the catalogue and its views (`src/views.ts`), graph queries including `renewals` (`src/graph.ts`, used by MCP), the map engine, and `stackledger build` with the `full` and `staff` sites (`src/site/`, `site/`). Licence fields: `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`; `cost`, `currency` and `renewsOn` may be `unknown`. The owner's decisions of 2026-10-20 are in the proposal.

## Goals / Non-goals

Goals: one report model shared by the site, the command and the calendar file; exact, explainable sums; nothing in `staff`.

Non-goals: conversion, cost allocation, budgets, a subscription feed.

## Decisions

### D1. One pure model

`src/reports.ts` exports `buildReport(graph, date, days): Report`, a pure function over a `full`-view graph. It reuses `renewals()` from `src/graph.ts` for the renewal lists (so MCP and the report agree) and adds the cost model. The site data (`src/site/data.ts`) calls it for the `full` view only; the `staff` `SiteData` type has no report field at all, so a leak is a type error, not a test failure.

### D2. Exact amounts

Costs are decimal numbers from YAML. To avoid floating-point drift, each amount is converted once to an integer number of ten-thousandths of the currency unit (`Math.round(cost * 10000)`), summed as integers (`bigint` if a total exceeds `Number.MAX_SAFE_INTEGER`), and divided by 12 only when a monthly figure is shown; display rounds half away from zero to two decimals. Costs with more than four decimals are rounded at that first step; the validator already rejects negative costs.

### D3. Groups

Owner groups use `spec.owner` as written; the page shows the owner's display name as the site already does (`src/site/owners.ts`), the command shows the reference. Zone groups use the graph's dependants of each licence filtered to served components with a zone label, using the declared zone title. Group lists are sorted by name with `Several zones`, `No zone` and `Not set` last.

### D4. Calendar

`src/ics.ts` writes RFC 5545 by hand (no dependency): `VCALENDAR` with `VERSION:2.0`, `PRODID:-//stackledger//licence renewals//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME` from the site title. Each `VEVENT`: `UID:<sha256(ref) first 32 hex>@stackledger`, `DTSTAMP:<date>T000000Z`, `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` (next day), `SUMMARY`, `DESCRIPTION`, `RRULE:FREQ=YEARLY` or `FREQ=MONTHLY` for those cycles, and a `VALARM` with `ACTION:DISPLAY`, `TRIGGER:-P14D`. Text values escape `\`, `;`, `,` and newlines; lines fold at 75 octets without splitting a UTF-8 character; CRLF endings. Monthly renewals on the 29th to 31st repeat as RFC 5545 defines (skipped in short months); the docs say so.

### D5. Site

A Reports page in `site/` rendered only when `SiteData.report` exists, and `renewals.ics` written by the build into the `full` site before publication, so it passes the same scan and atomic publication. The header link is driven by the same field. Tables are plain HTML; no new script.

### D6. Command

`stackledger report` follows `stackledger map`: same argument parsing helpers, same stderr counts line, stdout only the report. CSV (D-rule in spec) quotes every field and neutralises formula prefixes. JSON amounts are numbers rounded to two decimals; the JSON shape is documented in `docs/reports.md` as stable within v1.

## Risks / Trade-offs

- **Per-currency totals** are less convenient than one converted figure, but always right.
- **Zone by use** can surprise when a shared tool lands in `Several zones`; the page explains it.
- **Monthly repeats on the 31st** follow RFC 5545 and some calendars show fewer events; documented.
