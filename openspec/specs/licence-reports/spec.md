# licence-reports Specification

## Purpose
Defines the licence report stackledger computes from the `full` view and a date: renewals, recurring cost per month and per year by currency and by group, one-off and planned costs, incomplete licences, and the renewal calendar file.

## Requirements

### Requirement: Source and date
The report SHALL be computed from the `full` view only, for a report date and a renewal window of `days` days (default 90). In the `full` site the report date is the same resolved date as the map (`build --date`, or the local date captured once) and the window is 90 days. Nothing of the report SHALL be computed for, or reach any file of, the `staff` site.

#### Scenario: Not in staff
- **WHEN** both sites are built
- **THEN** the `staff` site has no `/reports/` page, no `renewals.ics` and no link to either

#### Scenario: Site report date
- **WHEN** the sites are built with `--date 2027-06-01`
- **THEN** the Reports page and the calendar use `2027-06-01` as the report date

### Requirement: Renewals
Among licences with status `active` or `to-confirm`, of any cycle, the report SHALL list those renewing from the report date to the date plus `days`, both included; those renewing before the report date (overdue); and those whose `renewsOn` is `unknown`. Entries are sorted by date, then reference, as the MCP `renewals` tool does.

#### Scenario: Ninety-day window
- **WHEN** the report date is `2027-06-01` and an active licence renews on `2027-08-30`
- **THEN** it is in the renewals and the window ends on `2027-08-30`

#### Scenario: Overdue
- **WHEN** an active licence renews on `2027-05-20` and the report date is `2027-06-01`
- **THEN** it is listed as overdue

#### Scenario: Window of zero days
- **WHEN** `days` is 0 and licences renew yesterday, today and tomorrow
- **THEN** yesterday's is overdue, today's is listed and tomorrow's is not

#### Scenario: Window of 366 days
- **WHEN** `days` is 366 from `2027-06-01`
- **THEN** a renewal on `2028-06-01` is listed and one on `2028-06-02` is not

### Requirement: Recurring cost
For licences with status `active` or `to-confirm`, `cost` SHALL be read as the price of one cycle for the whole licence; `seats` never multiply it. A `monthly` licence costs `cost` per month and `cost × 12` per year; a `yearly` one `cost ÷ 12` per month and `cost` per year; a `none` cycle costs zero whatever its `cost`. Sums are exact; only shown amounts are rounded, half away from zero, to two decimals.

#### Scenario: Monthly and yearly
- **WHEN** active licence `a` is `monthly` at 10 GBP and to-confirm licence `b` is `yearly` at 120 GBP
- **THEN** the GBP total is 20.00 per month and 240.00 per year

#### Scenario: Seats and none
- **WHEN** an active `yearly` licence costs 120 GBP with 5 seats and an active `none` licence has cost 50 GBP
- **THEN** the GBP total is 120.00 per year

#### Scenario: Exact sum
- **WHEN** three active `monthly` licences cost 0.1, 0.2 and 1.00499 GBP
- **THEN** the GBP total is 1.30 per month

### Requirement: Currencies
Totals SHALL be given per currency, sorted by currency code, and never converted or added across currencies.

#### Scenario: Two currencies
- **WHEN** active licences cost 10 GBP and 20 USD per month
- **THEN** there is a GBP total of 10.00 and a USD total of 20.00 per month, and no combined total

### Requirement: One-off costs
Complete `one-off` licences with status `active` or `to-confirm` SHALL be listed with their cost, with a total per currency, and SHALL add nothing to the recurring totals. Their renewal dates follow "Renewals"; in the calendar they have no repeat rule.

#### Scenario: One-off with a date
- **WHEN** the report date is `2027-06-01` and an active `one-off` licence costs 300 GBP and renews on `2027-07-01`
- **THEN** it is in the one-off list at 300.00 GBP, in the renewals, and in the calendar with no `RRULE`

#### Scenario: One-off beyond the window
- **WHEN** an active `one-off` licence renews one day after the window ends
- **THEN** it is in the one-off list but not in the renewals nor the calendar

### Requirement: Planned purchases
Every licence with status `to-buy` SHALL be in the planned list. Complete monthly and yearly ones have monthly and yearly amounts and a total per currency; complete one-off ones have a planned one-off total; `none` adds zero; incomplete ones add to no total and show no amount. `cancelled` and `expired` licences are in no list and no total.

#### Scenario: Planned purchase
- **WHEN** a `to-buy` licence is `yearly` at 600 EUR
- **THEN** it is in the planned list at 50.00 EUR per month and is not in the recurring totals

#### Scenario: Cancelled
- **WHEN** a cancelled licence is `monthly` at 15 GBP
- **THEN** it is in no total and no list of the report

### Requirement: Incomplete licences
A licence with status `active`, `to-confirm` or `to-buy` whose `cost`, `currency` or `cycle` is `unknown` SHALL add to no amount and be listed as incomplete, naming each unknown field. It counts in the one-off population if its cycle is `one-off`, else in the recurring one. Every total row SHALL show its population's incomplete count, with a `null` amount when nothing complete adds to it; unknown currencies get their own row.

#### Scenario: Unknown cost
- **WHEN** an active `yearly` GBP licence has `cost: unknown`
- **THEN** it is listed as incomplete with `cost`, and the GBP recurring total says 1 licence is incomplete

#### Scenario: Unknown currency
- **WHEN** an active licence has `currency: unknown`
- **THEN** it is counted as incomplete on the unknown-currency line, not under any currency

#### Scenario: Incomplete one-off and planned
- **WHEN** an active `one-off` licence and a `to-buy` `yearly` licence both have `cost: unknown` in GBP
- **THEN** the GBP one-off total and the GBP planned total each show 1 incomplete and a `null` amount

#### Scenario: Group with only an unknown currency
- **WHEN** owner `group:ops` has one active licence, with `currency: unknown`
- **THEN** the `group:ops` owner group has one unknown-currency row with 1 incomplete and no amount

### Requirement: Groups
Recurring totals SHALL also be given per licence owner (`spec.owner`), per payer (`spec.licence.paidBy`, or `Not set`) and per zone. A licence's zone comes from the served components that list it in `spec.dependsOn`: one zone, `Several zones` if more, `No zone` if none. Zones are keyed by declared name, lower-cased; unresolved labels count as no zone. Groups with only incomplete licences stay. Real groups come first, by display text (code points), then key; synthetic groups last.

#### Scenario: Licence used in two zones
- **WHEN** a licence is used by a component in zone `Finance` and one in zone `Delivery`
- **THEN** its whole cost is in the `Several zones` group

#### Scenario: Unused licence
- **WHEN** no component depends on a licence
- **THEN** its cost is in the `No zone` group

#### Scenario: Name that looks like a synthetic group
- **WHEN** one licence's `paidBy` is the text `Not set` and another has no `paidBy`
- **THEN** they are in two different payer groups

#### Scenario: Zones with the same title
- **WHEN** zones `fin-a` and `fin-b` both have the title `Finance` and the component documents are read in a different order
- **THEN** there are two `Finance` zone groups, `fin-a` before `fin-b`, in the same order both times

### Requirement: No licences
With no served licence, every list and total SHALL be empty and the report says so.

#### Scenario: Empty report
- **WHEN** the catalogue has no licence
- **THEN** the Reports page says there are no licences, the calendar has no event, the CSV has only its header and the JSON lists are empty

### Requirement: Calendar file
The calendar SHALL be iCalendar (RFC 5545) with CRLF endings and lines folded at 75 octets without splitting a character: one all-day event per licence of the renewals with a real date, with `DTSTART;VALUE=DATE` on the date and `DTEND` the next day; summary `Renewal: <title>`; description with vendor, cost, currency and cycle; a yearly or monthly repeat rule for those cycles; and a display alarm 14 days before whose description is the summary.

#### Scenario: Yearly renewal
- **WHEN** an active `yearly` licence renews on `2027-06-30`
- **THEN** the file has an event with `DTSTART;VALUE=DATE:20270630`, `DTEND;VALUE=DATE:20270701`, `RRULE:FREQ=YEARLY` and a `VALARM` with `TRIGGER:-P14D`

#### Scenario: Calendar text escaped
- **WHEN** a licence title contains a comma, a semicolon, a backslash and a line break
- **THEN** the summary writes them as `\,`, `\;`, `\\` and `\n`, and the file parses back to the same title

#### Scenario: Long non-ASCII title
- **WHEN** a title has 120 characters with accents
- **THEN** every line is at most 75 octets, no character is split, and unfolding gives the title back

### Requirement: Calendar identity and stamp
Each event's `UID` SHALL be derived from the catalogue's calendar namespace (the `Settings` document's `metadata.name`, or `catalogue` without one) and the licence reference only. `DTSTAMP` SHALL be the report date at `000000Z` and the calendar SHALL have no `METHOD`, so the same catalogue and date give a byte-identical file.

#### Scenario: Same input
- **WHEN** the calendar is produced twice with the same catalogue and date
- **THEN** the two files are byte-identical

#### Scenario: Two catalogues
- **WHEN** two catalogues with different `Settings` names both have licence `resource:licence-editor`
- **THEN** their events have different UIDs

### Requirement: Reports page
The `full` site SHALL have a Reports page at `/reports/` with the renewals, overdue and unknown dates; the recurring totals per currency with their incomplete counts; the three groupings; the one-off and planned lists; the incomplete licences; and a link to `renewals.ics`. Each licence links to its page.

#### Scenario: Page content
- **WHEN** the `full` site of the example is built
- **THEN** `/reports/` shows the GBP totals per month and per year and links `renewals.ics`
