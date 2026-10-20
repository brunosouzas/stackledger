# Licence reports

stackledger adds up what the catalogue's licences cost and when they renew. The same report appears in three places, all from the `full` view only ([ADR 7](adr/0007-two-views-built-as-separate-sites.md)):

- the **Reports** page of the `full` site (`/reports/`), with a link to the calendar file `renewals.ics`, both written by `stackledger build` ([docs/site.md](site.md));
- `stackledger report`, which prints it as text, JSON, CSV or an iCalendar file;
- the calendar file itself, for import into a calendar program.

The `staff` site has no Reports page, no calendar file and no link to either.

## What is counted

**Status.** Licences with status `active` or `to-confirm` count. `to-buy` licences are planned purchases, listed apart and never added to what you pay now. `cancelled` and `expired` licences are in no list and no total.

**Cost.** `cost` is the price of one cycle for the whole licence, as on the invoice: all seats together. `seats` never multiplies it.

| Cycle | Per month | Per year |
| --- | --- | --- |
| `monthly` | `cost` | `cost × 12` |
| `yearly` | `cost ÷ 12` | `cost` |
| `none` | 0 | 0 |
| `one-off` | listed apart with its cost, in no recurring total | |

**Exact amounts.** Each cost is read from the number as written in the YAML file (its shortest decimal form), and sums, ×12 and ÷12 are exact fractions. Only an amount that is shown is rounded, half away from zero, to two decimals. Three monthly costs of 0.1, 0.2 and 1.00499 make 1.30 per month, not 1.31 or 1.29.

**Currencies.** Every total is per currency, sorted by currency code. Amounts are never converted or added across currencies.

**Incomplete licences.** A counted or planned licence whose `cost`, `currency` or `cycle` is `unknown` adds to no amount. It is listed under the incomplete licences with the unknown fields, and every total row says how many incomplete licences it leaves out. A licence with `currency: unknown` is counted on its own row, the unknown currency (`null` in JSON), after the others. A row whose licences are all incomplete shows no amount (`—` on the page, `-` in text, `null` in JSON), not zero.

**Groups.** The recurring totals are also given per group, in three ways:

- **owner**: `spec.owner` as written (the page shows the owner's name, as the rest of the site does);
- **payer**: `spec.licence.paidBy`, or `Not set` when it is absent;
- **zone**: the zone of the served components that list the licence in `spec.dependsOn`. One zone gives that zone; more than one gives `Several zones`; none (or only labels that name no zone of the map layout) gives `No zone`. A licence's cost is never split between zones.

`Not set`, `Several zones` and `No zone` are not names: a payer actually called `Not set` stays its own group. Groups are sorted by the text they show (by Unicode code point), then by key, with these three last.

**Renewals.** For counted licences of any cycle: those renewing from the report date to the date plus the window (both included; 90 days by default), those renewing before the report date (overdue), and those with `renewsOn: unknown`. Entries are sorted by date, then reference, as the MCP `renewals` tool sorts them.

**One-off costs** are listed with a total per currency; their renewal dates (for example a support plan's end) follow the renewal rules above.

**Planned purchases** list every `to-buy` licence. Complete monthly and yearly ones show monthly and yearly amounts and add to a planned total per currency; one-off ones add to a planned one-off total; incomplete ones show no amount.

A catalogue with no licence gives an empty report that says so.

## stackledger report

```sh
node dist/cli.js report examples/northwind --date 2027-06-01
node dist/cli.js report examples/northwind --date 2027-06-01 --format json > report.json
node dist/cli.js report examples/northwind --date 2027-06-01 --format csv > licences.csv
node dist/cli.js report examples/northwind --date 2027-06-01 --format ics > renewals.ics
```

`stackledger report <folder> [--date YYYY-MM-DD] [--days N] [--format text|json|csv|ics]` prints the report of the `full` view on stdout. The defaults are the machine's local date, 90 days and `text`. `--days` is a whole number from 0 to 366. The command only reads the catalogue folder; it makes no network call.

| Exit | When |
| --- | --- |
| 0 | The report is printed. A catalogue with errors is still reported from what the `full` view serves; stderr then has one line with the error and warning counts and a hint to run `stackledger validate`. |
| 1 | The report could not be computed or written: stderr has one line. Nothing is printed when an amount cannot be written exactly as a JSON number (a cost far beyond any real price; the line names the licence). When stdout closes early, for example piped into `head`, the bytes already written stay. |
| 2 | A usage or folder problem: `--help` aside, a missing folder, an unknown option or format, a `--days` outside 0 to 366, an impossible date, more than one folder, or a folder that is missing, not a folder or unreadable. stdout is empty. |

The same catalogue, date and options always give the same bytes.

### Text

Plain tables for a terminal, one section per list: renewals, overdue, unknown renewal dates, recurring cost, by owner, by payer, by zone, one-off, planned purchases and their totals, incomplete licences. Owners show as references. Control characters in catalogue text are replaced by spaces.

### JSON

One object, stable within version 1:

```json
{
  "date": "2027-06-01", "days": 90, "to": "2027-08-30",
  "renewals": [{ "ref": "", "title": "", "vendor": "", "status": "", "cycle": "", "renewsOn": "", "cost": 0, "currency": "" }],
  "overdue": [], "unknownDates": ["resource:..."],
  "recurring": [{ "currency": "GBP", "monthly": 0, "yearly": 0, "incomplete": 0 }, { "currency": null, "monthly": null, "yearly": null, "incomplete": 0 }],
  "groups": {
    "owner": [{ "key": "", "label": "", "synthetic": false, "totals": [{ "currency": "GBP", "monthly": 0, "yearly": 0, "incomplete": 0 }] }],
    "payer": [], "zone": []
  },
  "oneOff": { "items": [{ "ref": "", "title": "", "cost": 0, "currency": "", "renewsOn": null }], "totals": [{ "currency": "GBP", "total": 0, "incomplete": 0 }] },
  "planned": {
    "items": [{ "ref": "", "title": "", "cycle": "", "cost": null, "currency": null, "monthly": null, "yearly": null }],
    "recurring": [{ "currency": "EUR", "monthly": 0, "yearly": 0, "incomplete": 0 }],
    "oneOff": [{ "currency": "EUR", "total": 0, "incomplete": 0 }]
  },
  "incomplete": [{ "ref": "", "title": "", "status": "", "unknown": ["cost"] }]
}
```

- `to` is the last day of the window. `unknownDates` lists references.
- Amounts are numbers rounded to two decimals (`10`, `8.33`). An amount is `null` when no complete licence adds to it, and a `cost` or `currency` that is `unknown` in the catalogue is `null`. `title` is `metadata.title`, else the name.
- Total rows are sorted by currency, with the unknown currency (`null`) last. Group keys are the owner reference, the payer text, or the zone's name in lower case; a synthetic group (`synthetic: true`) has the key `not-set`, `several-zones` or `no-zone` and the label `Not set`, `Several zones` or `No zone`.
- A one-off item's `renewsOn` is `null` when it is `unknown` or `not-applicable`.
- `unknown` lists the fields that are `unknown`, in the order `cycle`, `cost`, `currency`.
- Lists are sorted (renewals by date then reference, groups as above, everything else by reference) and are `[]` when empty.

### CSV

One row per licence with status `active`, `to-confirm` or `to-buy`, in reference order, after this header:

```text
ref,title,vendor,status,cycle,cost,currency,monthly,yearly,renewsOn,owner,paidBy,zone,counted
```

- `counted` is `true` only for licences in the recurring totals (complete, counted, not one-off).
- `cost`, `monthly` and `yearly` are rounded to two decimals; `monthly` and `yearly` are empty for one-off and incomplete licences.
- `unknown` values stay `unknown`; absent optional values (such as `paidBy`) are empty.
- `zone` is the names of the zones of the components that use the licence, in lower case and joined by `;`; empty for no zone.
- Lines end with CRLF (RFC 4180).

**Safe CSV.** Every field, the header's too, is quoted, with quotes doubled. A field that starts with `=`, `+`, `-`, `@`, a tab, a carriage return, a line feed, or the full-width `＝`, `＋`, `－` or `＠` gets a leading `'`, so a spreadsheet shows it as text instead of running it as a formula: the title `=HYPERLINK("x")` is written `"'=HYPERLINK(""x"")"`. This protects the file as exported. A spreadsheet that opens it and saves it again may write the formula back without protection.

## The calendar file

`renewals.ics` (in the `full` site) and `stackledger report --format ics` are the same iCalendar file ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)) for the report's renewals:

- One all-day event per licence renewing in the window (overdue licences and dates outside the window are not in it): it starts on the renewal date and ends the next day.
- Summary `Renewal: <title>`; description with the vendor, the cost and currency, and the cycle.
- A yearly or monthly repeat rule for `yearly` and `monthly` licences; none for other cycles, so a one-off renewal appears once.
- A display alarm 14 days before, whose text is the summary.
- The calendar name is the site title (`spec.site.title`, default `Software map`).

**Repeats on days that do not exist.** The repeat rules follow RFC 5545, which skips a date that does not exist instead of moving it: a monthly renewal on the 29th, 30th or 31st does not appear in months without that day (a renewal on 31 January appears again on 31 March), and a yearly renewal on 29 February appears only in leap years. Check those dates against the contract; if the vendor bills on the last day of the month, record a date that exists every month or year.

**Event identity.** Each event's `UID` is the first 32 hexadecimal digits of the SHA-256 of the calendar namespace, a line feed and the licence reference, followed by `@stackledger`. The namespace is the `Settings` document's `metadata.name`, or `catalogue` without one. Importing a newer file therefore updates the events instead of duplicating them. Two catalogues with the same Settings name (or none) give the same UID to licences with the same reference, which matters only if both calendars are imported into one calendar: **give the `Settings` document a distinctive name**, such as `northwind-software`.

**Event stamp.** `DTSTAMP` is the report date at midnight UTC, and the file has no `METHOD`, so RFC 5545 reads `DTSTAMP` as the time the information was last revised. This keeps the file reproducible: the same catalogue and date give the same bytes. The trade-off: after editing a licence, a file exported again with the same `--date` has the same `DTSTAMP`. Calendar programs that import a file replace events by `UID`; one that relies on `DTSTAMP` to accept an update needs a new `--date`.

**Download, not subscription.** The file is meant to be downloaded and imported. A calendar subscription will not work for the copy in the `full` site: calendar services such as Google Calendar and Outlook fetch a feed from their own servers, without the reader's sign-in, and the identity-aware proxy in front of the site refuses them. Do not publish the file outside the proxy to make it subscribable: it holds costs and vendors. A pipeline that must publish it elsewhere should put it behind its own access control.

## Example

The fictitious [Northwind catalogue](../examples/northwind/) has monthly, yearly and one-off licences, a planned purchase, a licence with an unknown cost, and costs in pounds and US dollars. Its report for 2027-06-01:

```sh
node dist/cli.js report examples/northwind --date 2027-06-01
```

```text
Licence report for 2027-06-01: renewals up to 2027-08-30 (90 days)

Renewals
Date        Licence                   Title            Vendor                           Cycle     Cost  Currency
2027-06-13  resource:licence-github   licence-github   Northwind Software (fictitious)  yearly  120.00  GBP
2027-06-26  resource:licence-onepass  licence-onepass  Northwind Software (fictitious)  yearly   36.00  GBP

Overdue
None.

Unknown renewal dates
None.

Recurring cost
Currency  Per month  Per year  Incomplete
GBP          131.50   1578.00           1
USD           94.00   1128.00           0

By owner
Owner            Currency  Per month  Per year  Incomplete
group:finance    GBP           39.00    468.00           0
group:northwind  GBP           92.50   1110.00           1
group:northwind  USD           94.00   1128.00           0

By payer
Payer             Currency  Per month  Per year  Incomplete
Finance team      GBP           84.00   1008.00           0
Northwind Studio  GBP           41.75    501.00           1
Northwind Studio  USD           94.00   1128.00           0
Not set           GBP            5.75     69.00           0

By zone
Zone              Currency  Per month  Per year  Incomplete
Zone 2 · Finance  GBP           84.00   1008.00           0
No zone           GBP           47.50    570.00           1
No zone           USD           94.00   1128.00           0

One-off
Licence                       Title          Cost  Currency  Renews on
resource:licence-brand-fonts  Brand fonts  300.00  GBP       -

One-off totals
Currency   Total  Incomplete
GBP       300.00           0

Planned purchases
Licence                   Title            Cycle     Cost  Currency  Per month  Per year
resource:licence-doppler  licence-doppler  yearly  240.00  GBP           20.00    240.00

Planned recurring totals
Currency  Per month  Per year  Incomplete
GBP           20.00    240.00           0

Planned one-off totals
None.

Incomplete licences
Licence                  Title           Status  Unknown
resource:licence-linear  licence-linear  active  cost
```

The GBP total leaves out `licence-linear` (its cost is `unknown`), `licence-doppler` is planned, `licence-brand-fonts` is a one-off purchase, and the licences of Gusto, Xero and Expensify, components in the Finance zone, make the `Zone 2 · Finance` group.
