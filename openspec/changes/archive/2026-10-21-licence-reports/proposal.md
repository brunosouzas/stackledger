# Proposal: licence-reports

## Why

The catalogue already records what each licence costs, how often it renews and who pays. People who govern software need the sums: what is renewing soon, what the software costs per month and per year, and where the money goes. Roadmap item 5. These numbers are for the `full` view only ([ADR 7](../../../docs/adr/0007-two-views-built-as-separate-sites.md)).

## What Changes

- One report model (`src/reports.ts`) computed from the `full` view and a date:
  - renewals in the next 90 days, overdue renewals and licences with no renewal date;
  - recurring cost per month and per year, one total per currency, with no conversion;
  - the same totals grouped by licence owner, by payer (`paidBy`) and by the zone of the components that use the licence;
  - one-off costs and planned purchases (`to-buy`) apart from the recurring totals;
  - licences left out of the totals because their cost, currency or cycle is `unknown`, so the reader knows a total is incomplete.
- A **Reports** page at `/reports/` and a `renewals.ics` calendar file, in the `full` site only.
- `stackledger report <folder> [--date] [--days] [--format text|json|csv|ics]` printing the same report on stdout.
- `cost` is defined as the price of one cycle for the whole licence (all seats), as on the invoice.

## Capabilities

### New Capabilities

- `licence-reports`: the report model, its rules and the calendar file.
- `report-command`: the `stackledger report` command line.

### Modified Capabilities

- `catalogue-site`: `Pages` gains `/reports/` and `renewals.ics` in the `full` site; `Layout` gains a Reports link in the `full` site.
- `mcp-server`: the global help scenario lists `report` too.
- `build-command`: `--date` also sets the report date of the `full` site.

## Impact

- New code: `src/reports.ts`, `src/ics.ts`, `src/report-command.ts` (or within `src/cli.ts`), a Reports page in `site/`, data for it in `src/site/data.ts` (full only).
- No new dependency.
- Documentation: `docs/reports.md` (new), `docs/catalogue-format.md` (meaning of `cost`), `docs/site.md` (Reports page and the calendar file), README Usage row, roadmap.

## Out of scope

- Currency conversion and exchange rates.
- Splitting a licence's cost between zones or components.
- A calendar subscription URL outside the identity-aware proxy (calendar services fetch feeds from their own servers, without the reader's sign-in, so a feed behind Cloudflare Access cannot be subscribed; the file is for download and import, or for a pipeline to publish elsewhere).
- An MCP tool for costs.
- Measuring licence usage; budgets and alerts.

## Implicit requirements

- **Errors and invalid input:** requirement. A catalogue with errors is still reported from what the `full` view serves; usage errors exit 2 with empty stdout.
- **Limits:** requirement. 300 licences in under 2 seconds for `report`; `--days` from 0 to 366.
- **Repetition and idempotency:** requirement. Same catalogue, date and options give byte-identical output, including the calendar file.
- **Concurrency:** n/a. Read-only command.
- **Security:** requirement. Nothing of the report reaches the `staff` site or its files; the command only reads; catalogue text is escaped for HTML, CSV and the calendar format.
- **Logs and observability:** requirement. stderr carries the catalogue error and warning counts as `map` does; stdout carries only the report.

## Open questions

None. Gate 1 approved by the owner on 2026-10-20, including the two review recommendations declined in design (required calendar UUID, revision DTSTAMP). The owner decided on 2026-10-20: `cost` is the price per cycle for all seats; monthly ×12 and yearly ÷12, one-off apart, `none` is zero; `active` and `to-confirm` count, `to-buy` apart, `cancelled` and `expired` excluded; unknown values listed as incomplete; one total per currency without conversion; groups by owner, by payer and by the zone of using components ("several zones", "no zone"), never splitting a cost; a Reports page and `renewals.ics` in the full site and a `report` command with text, JSON, CSV and calendar output.

## Documentation

- `docs/reports.md` (new): what is counted and how, with an example.
- `docs/catalogue-format.md`: `cost` is the price of one cycle for the whole licence.
- `docs/site.md`: the Reports page and `renewals.ics`, and why a feed behind the proxy cannot be subscribed.
- `README.md`: Usage row for `stackledger report`.
- `docs/roadmap.md`: mark change 5 delivered after merge.
- Brain vault: `10-personal/projects/stackledger/_index.md`.
