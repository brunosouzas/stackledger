## Scenario to test map

Levels: U unit, I integration (CLI or built files), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| licence-reports | Ninety-day window; Overdue; Window of zero days; Window of 366 days; Monthly and yearly; Seats and none; Exact sum; Two currencies; One-off with a date (report part); One-off beyond the window; Planned purchase; Cancelled; Unknown cost; Unknown currency; Incomplete one-off and planned; Group with only an unknown currency; Licence used in two zones; Unused licence; Name that looks like a synthetic group; Zones with the same title | `test/unit/reports.test.ts` | U |
| licence-reports | Yearly renewal; Calendar text escaped; Long non-ASCII title; Same input; Two catalogues; One-off with a date (calendar part) | `test/unit/ics.test.ts` | U |
| licence-reports | Not in staff; Site report date; Page content; Empty report (page part) | `test/integration/site.test.ts` | I |
| report-command | Default options; Read-only; Days out of range; Unknown format; Missing folder; Amount too large; Closed pipe; JSON totals; CSV rows; Formula in a title; One error; Large catalogue; Empty report (command part) | `test/integration/report.test.ts` | I |
| build-command | Two sites | `test/integration/build.test.ts` | I |
| catalogue-site | Item pages; No journeys; Reports in full only; Site title; View in the footer; Reports link | `test/integration/site.test.ts` | I |
| catalogue-site | Theme remembered; the Reports page under the CSP | `test/browser/site.spec.ts` | B |
| mcp-server | No folder; Unknown view; Missing folder; Help; Global help lists both commands | `test/integration/cli.test.ts` | I |

## 1. Report model

- [ ] 1.1 `src/money.ts` (exact decimal amounts) and `src/reports.ts` (`buildReport`: renewals via `graph.renewals`, recurring totals per currency, one-off, planned, incomplete, groups with synthetic keys); unit tests.
- [ ] 1.2 `src/ics.ts`: the calendar file; unit tests with a small reader that unfolds and unescapes the output.

## 2. Command

- [ ] 2.1 `stackledger report` with `text`, `json`, `csv` and `ics`; global help and unknown-command message list `report`; integration tests.

## 3. Site

- [ ] 3.1 `SiteData.report` for the `full` view only, from the map's resolved date; Reports page, header link and `renewals.ics` in the `full` site; site tests; the browser test opens `/full/reports/` under the CSP.

## 4. Documentation

- [ ] 4.1 `docs/reports.md` (rules, JSON shape, calendar notes), `cost` meaning in `docs/catalogue-format.md`, `docs/site.md`, README Usage row and a Reports screenshot, roadmap row 5 wording, `skills/stackledger/SKILL.md` and AGENTS.md if they list commands. Example licences in `examples/northwind/` cover monthly, yearly, one-off, `to-buy`, an unknown cost and two currencies.
