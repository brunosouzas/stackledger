# Design: licence-reports

## Context

Delivered: the catalogue and its views (`src/views.ts`), graph queries including `renewals` (`src/graph.ts`, used by MCP), the map engine, and `stackledger build` with the `full` and `staff` sites (`src/site/`, `site/`). Licence fields: `status`, `cycle`, `cost`, `currency`, `renewsOn`, `seats`, `paidBy`; `cost`, `currency` and `renewsOn` may be `unknown`. The owner's decisions of 2026-10-20 are in the proposal.

## Goals / Non-goals

Goals: one report model shared by the site, the command and the calendar file; exact, explainable sums; nothing in `staff`.

Non-goals: conversion, cost allocation, budgets, a subscription feed.

## Decisions

### D1. One pure model

`src/reports.ts` exports `buildReport(graph, date, days): Report`, a pure function over a `full`-view graph. It reuses `renewals()` from `src/graph.ts` for the renewal lists (so MCP and the report agree) and adds the cost model. The site data (`src/site/data.ts`) calls it for the `full` view only; the `staff` `SiteData` type has no report field at all, so a leak is a type error, not only a test failure. The full site uses the same resolved date as its map.

### D2. Exact amounts

YAML gives each cost as a JavaScript number. Its shortest round-trip decimal text (`String(cost)`, expanding exponent notation) is turned into a `bigint` coefficient and a decimal scale before any arithmetic. Sums use a common scale; yearly-to-monthly division keeps the remainder (amounts are kept as exact fractions `numerator / denominator` with `bigint`), and only the final shown amount is rounded, half away from zero, to two decimals. JSON writes a rounded amount as a number only when it round-trips exactly through `Number`; otherwise the command fails with exit 1 naming the licence (an absurd cost, far beyond any real price).

### D3. Groups

- Owner groups use `spec.owner` as written; the page shows the owner's display name as the site already does (`src/site/owners.ts`), the command shows the reference.
- Payer groups use `spec.licence.paidBy`; a missing value goes to the synthetic `Not set` group.
- Zone groups use the graph's direct dependants of each licence that are served components with a zone label resolved against the served layout (declared zone name, ignoring case); the title is display text only.
- Synthetic groups (`Not set`, `Several zones`, `No zone`) have internal keys that can never equal a real value (for example a `{ synthetic: 'not-set' }` tag), so a real payer named `Not set` stays a separate group. Lists are sorted by display text with synthetic groups last.

### D4. Calendar

`src/ics.ts` writes RFC 5545 by hand (no dependency):

- `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//stackledger//licence renewals//EN`, `CALSCALE:GREGORIAN`, `X-WR-CALNAME` (escaped site title). No `METHOD`: without it, `DTSTAMP` is the time the information was last revised, and the report date at midnight UTC is a fair, reproducible value for that.
- Each `VEVENT`: `UID:<first 32 hex of sha256(namespace + "\n" + ref)>@stackledger`, where namespace is the `Settings` `metadata.name` or `catalogue`; `DTSTAMP:<YYYYMMDD>T000000Z`; `DTSTART;VALUE=DATE:<YYYYMMDD>`; `DTEND;VALUE=DATE` the next day (exclusive); `SUMMARY:Renewal: <title>`; `DESCRIPTION` with vendor, cost, currency and cycle; `RRULE:FREQ=YEARLY` or `RRULE:FREQ=MONTHLY` for those cycles only; `BEGIN:VALARM`, `ACTION:DISPLAY`, `TRIGGER:-P14D`, `DESCRIPTION` = the summary, `END:VALARM`.
- Text values escape `\`, `;`, `,` and line breaks (`\n`); lines fold at 75 octets with CRLF and one space, never splitting a UTF-8 sequence.
- Monthly repeats from the 29th to the 31st and yearly repeats from 29 February follow RFC 5545 (skipped when the date does not exist); `docs/reports.md` says so. Tests parse the file back (a small unfolding and unescaping reader in the test) and check these dates.

### D5. Site

A Reports page in `site/` rendered only when `SiteData.report` exists, and `renewals.ics` written by the build into the `full` site before publication, so it passes the same scan and atomic publication. The header link is driven by the same field. Tables are plain HTML; no new script. An empty report shows an explicit empty state.

### D6. Command

`stackledger report` follows `stackledger map`: the same argument helpers, `problemCounts('report', catalogue)` on stderr (nothing for a clean catalogue), stdout only the report, the whole output built in memory before writing, internal failures exit 1 with one stderr line. CSV quotes every field and neutralises formula prefixes (spec).

JSON shape (stable within v1; documented in `docs/reports.md`):

```json
{
  "date": "2027-06-01", "days": 90, "to": "2027-08-30",
  "renewals": [{ "ref": "", "title": "", "vendor": "", "status": "", "cycle": "", "renewsOn": "", "cost": 0, "currency": "" }],
  "overdue": [], "unknownDates": ["resource:..."],
  "recurring": [{ "currency": "GBP", "monthly": 0, "yearly": 0, "incomplete": 0 }],
  "unknownCurrency": { "incomplete": 0 },
  "groups": {
    "owner": [{ "key": "", "label": "", "synthetic": false, "totals": [{ "currency": "", "monthly": 0, "yearly": 0, "incomplete": 0 }] }],
    "payer": [], "zone": []
  },
  "oneOff": { "items": [{ "ref": "", "title": "", "cost": 0, "currency": "", "renewsOn": null }], "totals": [{ "currency": "", "total": 0 }] },
  "planned": { "items": [{ "ref": "", "title": "", "cycle": "", "cost": null, "currency": null, "monthly": null, "yearly": null }], "recurring": [], "oneOff": [] },
  "incomplete": [{ "ref": "", "title": "", "status": "", "unknown": ["cost"] }]
}
```

Lists are sorted (renewals by date then reference; everything else by reference or label); empty lists are `[]`; missing amounts are `null`.

## Risks / Trade-offs

- **Per-currency totals** are less convenient than one converted figure, but always right.
- **Zone by use** can surprise when a shared tool lands in `Several zones`; the page explains it.
- **DTSTAMP at the report date** trades strict "last revised" accuracy for reproducible files.
- **CSV protection** covers the file as exported; a spreadsheet that re-saves it may undo it.
