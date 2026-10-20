## Purpose

Defines the licence report stackledger computes from the `full` view and a date: renewals, recurring cost per month and per year by currency and by group, one-off and planned costs, incomplete licences, and the renewal calendar file.

## ADDED Requirements

### Requirement: Source and date
The report SHALL be computed from the `full` view only, for a report date (`--date` or the build date) and a renewal window of `days` days (default 90). It SHALL NOT be computed for, or reach any file of, the `staff` view.

#### Scenario: Not in staff
- **WHEN** both sites are built
- **THEN** the `staff` site has no `/reports/` page, no `renewals.ics` and no link to either

### Requirement: Renewals
The report SHALL list, among licences with status `active` or `to-confirm`: those renewing from the report date to the date plus `days`, both included; those renewing before the report date (overdue); and those whose `renewsOn` is `unknown`. Entries are sorted by date, then reference, as the MCP `renewals` tool does.

#### Scenario: Ninety-day window
- **WHEN** the report date is `2027-06-01` and an active licence renews on `2027-08-30`
- **THEN** it is in the renewals and the window ends on `2027-08-30`

#### Scenario: Overdue
- **WHEN** an active licence renews on `2027-05-20` and the report date is `2027-06-01`
- **THEN** it is listed as overdue

### Requirement: Recurring cost
For licences with status `active` or `to-confirm`, `cost` SHALL be read as the price of one cycle for the whole licence. A `monthly` licence costs `cost` per month and `cost × 12` per year; a `yearly` one costs `cost ÷ 12` per month and `cost` per year; a `none` cycle costs zero. Amounts are summed exactly and shown rounded to two decimals.

#### Scenario: Monthly and yearly
- **WHEN** active licence `a` is `monthly` at 10 GBP and active licence `b` is `yearly` at 120 GBP
- **THEN** the GBP total is 20.00 per month and 240.00 per year

#### Scenario: Free licence
- **WHEN** an active licence has cycle `none` and cost 0
- **THEN** it adds nothing and is not listed as incomplete

### Requirement: Currencies
Totals SHALL be given per currency, sorted by currency code, and never converted or added across currencies.

#### Scenario: Two currencies
- **WHEN** active licences cost 10 GBP and 20 USD per month
- **THEN** there is a GBP total of 10.00 and a USD total of 20.00 per month, and no combined total

### Requirement: Outside the recurring totals
`one-off` licences with status `active` or `to-confirm` SHALL be listed with their cost apart from the recurring totals, with a total per currency. Licences with status `to-buy` SHALL be listed as planned, with monthly and yearly amounts per currency computed as above. `cancelled` and `expired` licences SHALL be left out of every total.

#### Scenario: Planned purchase
- **WHEN** a `to-buy` licence is `yearly` at 600 EUR
- **THEN** it is in the planned list at 50.00 EUR per month and is not in the recurring totals

#### Scenario: Cancelled
- **WHEN** a cancelled licence is `monthly` at 15 GBP
- **THEN** it is in no total and no list of the report

### Requirement: Incomplete licences
A licence with status `active`, `to-confirm` or `to-buy` whose `cost`, `currency` or `cycle` is `unknown` SHALL be left out of the totals and listed as incomplete, naming each unknown field. Wherever a total is shown, the number of incomplete licences SHALL be shown with it.

#### Scenario: Unknown cost
- **WHEN** an active `yearly` licence has `cost: unknown`
- **THEN** it is listed as incomplete with `cost`, and the totals say 1 licence is incomplete

### Requirement: Groups
The recurring totals SHALL also be given per licence owner (`spec.owner`), per payer (`spec.licence.paidBy`, or `Not set`), and per zone. A licence's zone is the zone of the served components that depend on it: one zone, `Several zones` when they are in more than one, or `No zone` when none is in a zone or nothing uses it. A cost is never split between groups.

#### Scenario: Licence used in two zones
- **WHEN** a licence is used by a component in zone `Finance` and one in zone `Delivery`
- **THEN** its whole cost is in the `Several zones` group

#### Scenario: Unused licence
- **WHEN** no component depends on a licence
- **THEN** its cost is in the `No zone` group

### Requirement: Calendar file
The calendar file SHALL be iCalendar (RFC 5545) with CRLF line endings and folded lines, one all-day event per licence with status `active` or `to-confirm` and a real `renewsOn` date: summary `Renewal: <title>`, description with vendor, cost, currency and cycle, a yearly or monthly repeat rule for those cycles, and a display alarm 14 days before.

#### Scenario: Yearly renewal
- **WHEN** an active `yearly` licence renews on `2027-06-30`
- **THEN** the file has an all-day event on `2027-06-30` with `RRULE:FREQ=YEARLY` and an alarm 14 days before

#### Scenario: Calendar text escaped
- **WHEN** a licence title is `Edit, review; ship\nnow`
- **THEN** the summary escapes the comma, the semicolon and the backslash as RFC 5545 requires

### Requirement: Deterministic calendar
Each event's `UID` SHALL be derived from the licence reference only, and `DTSTAMP` from the report date at `000000Z`, so the same catalogue and date give a byte-identical file.

#### Scenario: Same input
- **WHEN** the calendar is produced twice with the same catalogue and date
- **THEN** the two files are byte-identical

### Requirement: Reports page
The `full` site SHALL have a Reports page at `/reports/` showing the report for the build date: renewals, overdue and unknown dates; recurring totals per currency; the three groupings; one-off and planned lists; incomplete licences; and a link to `renewals.ics`. Each licence links to its page.

#### Scenario: Page content
- **WHEN** the `full` site of the example is built
- **THEN** `/reports/` shows the GBP totals per month and per year and links `renewals.ics`
