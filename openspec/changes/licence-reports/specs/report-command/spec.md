## Purpose

Defines `stackledger report`, the command that prints the licence report of a catalogue's `full` view on stdout as text, JSON, CSV or iCalendar.

## ADDED Requirements

### Requirement: Command
`stackledger report <folder> [--date YYYY-MM-DD] [--days N] [--format text|json|csv|ics]` SHALL print the licence report of the `full` view on stdout and exit 0. The defaults are the machine's local date, 90 days and `text`. The whole output is produced before anything is written. The command SHALL only read files and SHALL NOT open network connections.

#### Scenario: Default options
- **WHEN** the command runs as `stackledger report ./catalogue`
- **THEN** stdout is the text report for today with a 90-day window and the exit code is 0

#### Scenario: Read-only
- **WHEN** the command runs under the Node.js permission model with read access only
- **THEN** it succeeds and no file in the folder changes

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder, an unknown option, a `--format` outside the allowed values, a `--days` that is not an integer from 0 to 366, a `--date` that is not a real date, more than one folder, or a folder that does not exist, is not a folder or cannot be read SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2.

#### Scenario: Days out of range
- **WHEN** the command runs with `--days 400`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed range

#### Scenario: Unknown format
- **WHEN** the command runs with `--format xlsx`
- **THEN** the exit code is 2 and stderr names the allowed formats

#### Scenario: Missing folder
- **WHEN** the folder does not exist
- **THEN** the exit code is 2, stdout is empty and stderr says the folder was not found

### Requirement: Internal failure
An unexpected failure while computing or writing the report SHALL exit 1 with stdout empty and one stderr line, without usage.

#### Scenario: Amount too large
- **WHEN** a licence cost cannot be written faithfully as a JSON number
- **THEN** the exit code is 1, stdout is empty and stderr names the licence

### Requirement: Formats
`text` SHALL be plain tables for a terminal. `json` SHALL follow the shape in `docs/reports.md`: report date, window, renewals, overdue, unknown dates, totals, groups, one-off, planned and incomplete, amounts as numbers rounded to two decimals and `null` where no amount exists. `ics` SHALL be the calendar file.

#### Scenario: JSON totals
- **WHEN** the format is `json` and active licences cost 10 GBP per month
- **THEN** the object's monthly GBP total is `10`

### Requirement: CSV rows
`csv` SHALL have the header `ref,title,vendor,status,cycle,cost,currency,monthly,yearly,renewsOn,owner,paidBy,zone,counted` and one row per licence with status `active`, `to-confirm` or `to-buy`, in reference order. `counted` is `true` only for licences in the recurring totals; `monthly` and `yearly` are empty for one-off and incomplete licences; `unknown` values stay `unknown`; absent optional values are empty.

#### Scenario: CSV rows
- **WHEN** the catalogue has an active, a to-buy and a cancelled licence
- **THEN** the CSV has the header and two rows, and only the active one has `counted` `true`

### Requirement: Safe CSV
Every CSV field SHALL be quoted and embedded quotes doubled, and a field starting with `=`, `+`, `-`, `@`, tab, carriage return, line feed, `＝`, `＋`, `－` or `＠` SHALL be prefixed with `'`. This protects the exported file as written; a spreadsheet that rewrites it is out of scope.

#### Scenario: Formula in a title
- **WHEN** a licence title is `=HYPERLINK("x")`
- **THEN** its CSV field is `"'=HYPERLINK(""x"")"`

### Requirement: Catalogue with errors
A catalogue with errors SHALL still be reported from the documents the `full` view serves, with exit 0; when there is at least one error or warning, stderr SHALL have one line with both counts and a hint to run `stackledger validate`, as `stackledger map` writes it. stdout SHALL hold only the report.

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** the report is printed, the exit code is 0 and stderr says there is 1 error

### Requirement: Deterministic and fast
The same catalogue, date and options SHALL give byte-identical stdout, and a catalogue of 300 licences SHALL be reported within 2 seconds in each format.

#### Scenario: Large catalogue
- **WHEN** a generated catalogue of 300 licences is reported in each format
- **THEN** each run finishes within 2 seconds and two runs give identical output
