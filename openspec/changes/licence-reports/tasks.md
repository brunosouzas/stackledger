## Scenario to test map

Levels: U unit, I integration (CLI or built files), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| licence-reports | Ninety-day window; Overdue; Monthly and yearly; Free licence; Two currencies; Planned purchase; Cancelled; Unknown cost; Licence used in two zones; Unused licence | `test/unit/reports.test.ts` | U |
| licence-reports | Yearly renewal; Calendar text escaped; Same input | `test/unit/ics.test.ts` | U |
| licence-reports | Not in staff; Page content | `test/integration/site.test.ts` | I |
| report-command | Default options; Read-only; Days out of range; Unknown format; JSON totals; CSV columns; Formula in a title; One error; Large catalogue | `test/integration/report.test.ts` | I |
| catalogue-site | Item pages; No journeys; Reports in full only; Theme remembered; Site title; View in the footer; Reports link | `test/integration/site.test.ts` (Theme remembered stays in `test/browser/site.spec.ts`) | I / B |
| mcp-server | No folder; Unknown view; Missing folder; Help; Global help lists both commands | `test/integration/cli.test.ts` | I |

## 1. Report model

- [ ] 1.1 `src/reports.ts`: `buildReport` with exact amounts, renewals via `graph.renewals`, totals per currency, one-off, planned, incomplete and the three groups; unit tests.
- [ ] 1.2 `src/ics.ts`: the calendar file; unit tests, including folding of long UTF-8 lines and a parse check of the output.

## 2. Command

- [ ] 2.1 `stackledger report` with `text`, `json`, `csv` and `ics`; global help and unknown-command message list `report`; integration tests.

## 3. Site

- [ ] 3.1 `SiteData.report` for the `full` view only; Reports page, header link and `renewals.ics` in the `full` site; site tests; the browser test opens `/full/reports/` under the CSP.

## 4. Documentation

- [ ] 4.1 `docs/reports.md`, `cost` meaning in `docs/catalogue-format.md`, `docs/site.md`, README Usage row and a Reports screenshot, roadmap row 5 wording, `skills/stackledger/SKILL.md` and AGENTS.md if they list commands. Example licences in `examples/northwind/` cover monthly, yearly, one-off, `to-buy`, an unknown cost and two currencies.
