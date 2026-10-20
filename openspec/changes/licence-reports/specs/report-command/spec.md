## Purpose

Defines `stackledger report`, the command that prints the licence report of a catalogue's `full` view on stdout as text, JSON, CSV or iCalendar.

## ADDED Requirements

### Requirement: Command
`stackledger report <folder> [--date YYYY-MM-DD] [--days N] [--format text|json|csv|ics]` SHALL print the licence report of the `full` view on stdout and exit 0. The defaults are the machine's local date, 90 days and `text`. The command SHALL only read files and SHALL NOT open network connections.

#### Scenario: Default options
- **WHEN** the command runs as `stackledger report ./catalogue`
- **THEN** stdout is the text report for today with a 90-day window and the exit code is 0

#### Scenario: Read-only
- **WHEN** the command runs under the Node.js permission model with read access only
- **THEN** it succeeds and no file in the folder changes

### Requirement: Usage errors
When `--help` is among the arguments, the command SHALL print usage on stdout and exit 0. Otherwise a missing folder, an unknown option, a `--format` outside the allowed values, a `--days` that is not an integer from 0 to 366, a `--date` that is not a real date, more than one folder, or an unreadable folder SHALL print the reason and usage on stderr, print nothing on stdout, and exit 2.

#### Scenario: Days out of range
- **WHEN** the command runs with `--days 400`
- **THEN** the exit code is 2, stdout is empty and stderr names the allowed range

#### Scenario: Unknown format
- **WHEN** the command runs with `--format xlsx`
- **THEN** the exit code is 2 and stderr names the allowed formats

### Requirement: Formats
`text` SHALL be plain tables for a terminal. `json` SHALL be one object with the report date, window, renewals, overdue, unknown dates, totals, groups, one-off, planned and incomplete lists, with amounts as numbers rounded to two decimals. `csv` SHALL be one row per licence with a header row. `ics` SHALL be the calendar file.

#### Scenario: JSON totals
- **WHEN** the format is `json` and active licences cost 10 GBP per month
- **THEN** the object's monthly GBP total is `10`

#### Scenario: CSV columns
- **WHEN** the format is `csv`
- **THEN** the header is `ref,title,vendor,status,cycle,cost,currency,monthly,yearly,renewsOn,owner,paidBy,zone,counted` and each licence has one row

### Requirement: Safe CSV
CSV fields SHALL be quoted as RFC 4180 requires, and a field starting with `=`, `+`, `-`, `@`, a tab or a carriage return SHALL be prefixed with `'` so spreadsheets do not run it as a formula.

#### Scenario: Formula in a title
- **WHEN** a licence title is `=HYPERLINK("x")`
- **THEN** its CSV field is `"'=HYPERLINK(""x"")"`

### Requirement: Catalogue with errors
A catalogue with errors SHALL still be reported from the documents the `full` view serves, with exit 0; when there is at least one error or warning, stderr SHALL have one line with both counts and a hint to run `stackledger validate`. stdout SHALL hold only the report.

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** the report is printed, the exit code is 0 and stderr says there is 1 error

### Requirement: Deterministic and fast
The same catalogue, date and options SHALL give byte-identical stdout, and a catalogue of 300 licences SHALL be reported within 2 seconds.

#### Scenario: Large catalogue
- **WHEN** a generated catalogue of 300 licences is reported in each format
- **THEN** each run finishes within 2 seconds and two runs give identical output
