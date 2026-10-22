## MODIFIED Requirements

### Requirement: Command
`stackledger build <folder> --out <dir> [--date YYYY-MM-DD] [--skills <folder>]...` SHALL build the `full` site into `<dir>/full/` and, unless in the personal mode, the `staff` site into `<dir>/staff/`, write the root redirect `<dir>/_redirects`, and exit 0. `--date` sets the map date and the report date of the `full` site (default: the machine's local date, captured once); a date whose 90-day report window ends after `9999-12-30` is a usage error. A missing `<dir>` is created.

#### Scenario: Two sites
- **WHEN** the command runs as `stackledger build ./catalogue --out ./public`
- **THEN** `./public/full/index.html` and `./public/staff/index.html` exist and the exit code is 0

#### Scenario: Two sites with skills
- **WHEN** the command runs as `stackledger build ./catalogue --out ./public --skills ./skills`
- **THEN** `./public/full/skills/index.html` and `./public/staff/skills/index.html` exist and the exit code is 0

### Requirement: Writes
The command reads only the catalogue folder and the skills folders and SHALL NOT open network connections. It SHALL write only inside the output folder. Astro's working copy, generated files and every cache (Astro `cacheDir` and Vite `cacheDir`) SHALL be under the staging folder. It SHALL NOT write in the catalogue folder, the skills folders, the installed stackledger package, the system temporary directory or the user's home folder.

#### Scenario: Sandboxed build
- **WHEN** the command runs with `--skills` under the Node.js permission model with read access to the catalogue folder, the skills folder and the package, write access only to `--out`, and `--allow-addons --allow-child-process --allow-worker`
- **THEN** both sites are built with their Skills pages, and child processes, which the model does not restrict, are outside this check

### Requirement: Build report
stderr SHALL show, in order: when the catalogue has an error or a warning, one line with both counts and a hint to run `stackledger validate`; the map's lines for suggestions, unrouted hops and an unused layout, as `stackledger map` writes them for the `full` view; the skill set's lines of "Skills build report"; one line per site built with its folder and page count; and a last line saying the folders must be served behind an identity-aware proxy. A catalogue with errors SHALL still be built, with exit 0.

#### Scenario: One error
- **WHEN** the catalogue has one error
- **THEN** both sites are built, the exit code is 0 and stderr says there is 1 error

#### Scenario: Proxy reminder
- **WHEN** a build succeeds
- **THEN** the last stderr line says the folders must be served behind an identity-aware proxy

### Requirement: Deterministic build
The same catalogue, skill files, `--date` and stackledger version SHALL produce byte-identical files in both sites, whatever the order of files and documents in the catalogue folder, the order in which folders list their entries, and where the catalogue and skills folders are on disk, as long as the same documents and items are served.

#### Scenario: Built twice
- **WHEN** the same catalogue is built twice with the same `--date`
- **THEN** every file of both builds is identical

#### Scenario: Skills folder elsewhere
- **WHEN** the same catalogue and skill files are built from two different absolute paths, with the same `--date`
- **THEN** every file of both builds is identical

## ADDED Requirements

### Requirement: Skill folders
The skill set SHALL be read as `stackledger skills validate` reads it: from the `--skills` folders, in the order given and used as received, when there is at least one; otherwise from the Settings' `spec.skills.folders`, each resolved from the catalogue folder, when the Settings in use has no error; otherwise there is no skill set and no Skills section.

#### Scenario: Folders from the settings
- **WHEN** the catalogue `cat` has `spec.skills.folders: [../kit]` and the command has no `--skills`
- **THEN** the skill set is read from `cat/../kit` and both sites have the Skills pages

#### Scenario: The option replaces the settings
- **WHEN** the catalogue has `spec.skills.folders: [../kit]` and the command has `--skills team`
- **THEN** the skill set is read from `team` only

#### Scenario: Several option folders
- **WHEN** the command has `--skills team --skills vendor`
- **THEN** one skill set is read from both folders, `team` first

#### Scenario: No skill set
- **WHEN** the catalogue has no `spec.skills` and the command has no `--skills`
- **THEN** no skill folder is read and no site has a Skills page

#### Scenario: Broken settings
- **WHEN** the Settings has `spec.skills.folders: [../kit]` and an error in `spec.site.colors`, and the command has no `--skills`
- **THEN** no skill set is read, the exit code is 0, and stderr says the configured skill folders were not used because the Settings has an error

### Requirement: Skill folder errors
An empty `--skills` value, or a skills folder, from the option or the settings, that does not exist, is not a folder or cannot be listed, SHALL be a usage error: exit 2, stderr naming the folder as given or written (and `spec.skills.folders` when it comes from there), nothing created or changed. A skills folder in which nothing is found SHALL exit 1 with nothing published changed.

#### Scenario: Missing skills folder
- **WHEN** the command has `--skills missing` and `missing` does not exist
- **THEN** the exit code is 2, stderr names `missing`, and `--out` is not created

#### Scenario: Missing configured folder
- **WHEN** `spec.skills.folders` is `[../kit]` and that folder does not exist
- **THEN** the exit code is 2 and stderr names `../kit` and `spec.skills.folders`

#### Scenario: Nothing found does not empty the section
- **WHEN** an earlier build with skills exists in `--out` and the command runs with `--skills docs`, a folder holding no skill and no agent
- **THEN** the exit code is 1, stderr says nothing was found in `docs`, and the earlier build is unchanged

#### Scenario: Skill set with errors
- **WHEN** one skill of the set has no description and the rest are valid
- **THEN** the sites are built without that skill and the exit code is 0

### Requirement: Output folder and skills folders
After resolving symbolic links, the output folder SHALL also be refused, with exit 2 and no change, when it is a skills folder, is inside one, or contains one.

#### Scenario: Output inside the skills folder
- **WHEN** `--out` is `./skills/site` and the command has `--skills ./skills`
- **THEN** the exit code is 2 and nothing is written

#### Scenario: Output contains the skills folder
- **WHEN** `--out` is `./public`, an empty folder, and the command has `--skills ./public/skills`, a folder holding skills
- **THEN** the exit code is 2 and nothing is written

### Requirement: Skills build report
With a skill set, the report SHALL hold, in order: one line `Skills: <n> skills, <n> playbooks, <n> agents, <n> rules`; when the set has an error or a warning, one line with both counts and a hint to run `stackledger skills validate`; and the skills map's suggested positions and unrouted hops, written as for the software map but naming the skills map. A skill set with errors SHALL still be built.

#### Scenario: Counts line
- **WHEN** the set has 3 skills, 1 playbook, 2 agents and 10 rules and no problem
- **THEN** stderr holds the line `Skills: 3 skills, 1 playbook, 2 agents, 10 rules` and no skills problem line

#### Scenario: Skills problems
- **WHEN** the set has one error and two warnings
- **THEN** stderr says the skill set has 1 error and 2 warnings and names `stackledger skills validate`

#### Scenario: Suggested skill position
- **WHEN** `skill:writer` is a stop of a skill line and has no position
- **THEN** stderr gives a suggested position for `skill:writer` under a line naming the skills map's `MapLayout`

### Requirement: Build time with skills
Both sites for a catalogue of 300 items and 20 lines, with a skill set of 200 skills, 20 playbooks, 10 agents, 2,000 rules and 10 skill lines, SHALL be built within 150 seconds.

#### Scenario: Large catalogue and skill set
- **WHEN** a generated catalogue of 300 items and 20 lines is built with a generated skill set of that size
- **THEN** the command finishes within 150 seconds
