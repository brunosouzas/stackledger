# Agent skills

`stackledger skills validate` checks a set of agent skills, playbooks, agents and rules kept in folders: what one agent would see. It reports problems in the same line format as `stackledger validate`, so a person can run it on their own folders and a team can run it in CI on every pull request. It only reads files: it writes nothing, makes no network call and fixes nothing.

`stackledger skills map` draws the same set's declared relations as Markdown pages with Mermaid diagrams in your repository: see [Map in the repository](#map-in-the-repository).

```sh
stackledger skills validate [folder...] [--json]
```

With no folder it checks the current folder. Several folders are read as one set, in the order given.

## What it reads

- **Skills.** Any folder holding a file named exactly `SKILL.md`, in the [Agent Skills format](https://agentskills.io/specification): a YAML frontmatter between two `---` lines, with `name` and `description`. Each given folder is walked at most five levels deep, entries in code-point order; the walk does not enter a skill folder (its sub-folders are the skill's resources), and skips folders whose name starts with `.` and `node_modules`. A given folder that is itself a skill folder gives that one skill.
- **Playbooks.** Skills with `stackledger-kind: playbook` in their `metadata`: a skill that orchestrates other skills and agents.
- **Agents.** Each `.md` file directly in an `agents/` folder at the top of a given folder, in the Claude Code subagent format (frontmatter with `name`, `description`, and optionally `skills`, `tools`, `model`…). A file there without frontmatter, such as a `README.md`, gets a warning and is not an agent.
- **Rules.** An optional `rules.md` next to a `SKILL.md`. A rule is a line starting at column 1 with `- **ID** text`, the ID like `DOC-1`; indented `Why:` and `Check:` lines after it are its reason and check, and the nearest earlier `## ` heading is its group. Lines inside fenced code blocks are never rules.

```markdown
## Documentation (DOC)

- **DOC-1** Update the README in the same change.
  Why: documentation updated later is wrong in between.
  Check: the diff touches the docs whenever it changes usage.
```

### Symbolic links

Tool folders are often made of links into a repository (`/Users/username/.claude/skills/writer -> /Users/username/skills/writer`). A link to a folder holding a `SKILL.md` is read as a skill at the link's path, and never walked into; any other folder link, or a broken link, gets one warning and is not followed, so the walk cannot loop. Links to files (`SKILL.md`, `rules.md`, agent files) are read, and a given folder that is a link is followed.

A skill folder or agent file reached twice (through a link and directly, or from two given folders) is read once, at the first path. Copies are different: two separate files with the same `name` are a duplicate.

### One set is what one agent sees

Give the folders one agent loads together, for example a repository and the tool folder that links into it. Check each tool folder on its own: a repository and a tool folder holding copies (not links) of its skills fail with duplicate names, which is right for one agent but not what you want to compare. Comparing tool folders with a repository is a later command (`skills drift`).

Point the command at folders that hold real skills. Templates, examples and deliberately broken test fixtures inside them are read like any skill unless an [ignore file](#ignore-file) skips them.

## Ignore file

A `.stackledgerignore` file lists, in `.gitignore` syntax, the entries the walk skips: a skipped folder is not entered, a skipped link is not followed, and a skipped skill folder or agent file is not read.

```gitignore
# The template for new skills, and fixtures that are broken on purpose.
templates/
fixtures/*/SKILL.md
# Keep one example as a real skill.
examples/*
!examples/northwind
```

**Where it is read.** Only at the top of each given folder that is not itself a skill folder (with no folder given: the current folder). It is never read from a parent or a sub-folder, so running at the repository root and running on `skills/` can give different sets: put the file in the folder your pipeline points the command at. The patterns of one given folder never apply to another given folder, even when the two overlap: an entry skipped through `repo` can still be read through `repo/skills`. A `.stackledgerignore` that is a link to a regular file is read.

**Syntax.** Each line means what it means to Git, as implemented by the [`ignore`](https://www.npmjs.com/package/ignore) package (version 7.0.13): blank lines and `#` comments, `\#` and `\!` for a literal first character, trailing spaces dropped, `!` to re-include (the last matching line wins), a leading or middle `/` to anchor a pattern to the given folder, a trailing `/` for folders only, and the wildcards `*`, `?`, `[...]` and `**`. A folder that is skipped is not entered, so nothing below it can be re-included, as with Git. Matching is case-sensitive on every platform and compares names as stored, without Unicode normalisation. Line endings may be LF or CRLF, and a byte-order mark is dropped. A line Git cannot match (such as `a[`) matches nothing and gives no problem.

**What is tested.** Paths are relative to the given folder, separated by `/`. The walk tests only the entries that can add to the set: each folder (with a trailing `/`), each symbolic link (always without `/`, whatever it points to, as Git does: `shared/` does not skip a link named `shared`, `shared` does), each skill folder's `SKILL.md` (so `fixtures/*/SKILL.md` skips those skills, but not a linked skill, whose inside Git does not look at), and each `.md` file directly in the top-level `agents/` folder. Other files, and links to them, are never tested or counted, and files inside a skill folder other than `SKILL.md`, `rules.md` included, are never skipped (a skill is read whole or not at all). Mind that `*.md` matches every `SKILL.md`, so it hides every skill, as it would hide those files from Git; to hide READMEs write `/README.md` or `**/README.md`. Hidden entries and `node_modules` are skipped before the ignore file is looked at, so a pattern such as `!.claude/` has no effect.

**The `ignored` count and list.** The counts line gives `ignored`, the number of entries the ignore files skipped: each entry once per run (a folder given twice counts once), a skipped folder as one whatever it holds (`fixtures/` counts one, `fixtures/*` counts each entry below it). Hidden entries and `node_modules` are not counted. The JSON output lists the skipped paths, so you can see what a pattern hid. A given folder where everything was skipped still fails with "No skill folder or agent file found", and the message says how many entries `.stackledgerignore` skipped.

**Limits.** The file can be changed by any pull request, so its cost is bounded: at most 64 KiB, 100 pattern lines (not blank, not comments), 200 characters and 16 wildcard characters (`*`, `?`, `[`) per line. Every line is compiled when the file is read.

**A file that cannot be used reads everything.** An ignore file over a limit, with a line the matcher cannot compile, unreadable, holding a secret, or not a regular file (a folder, a FIFO, a broken or looping link) is an error on `.stackledgerignore`, reported once, and that folder is read with no patterns. Hiding too much would be silent; reading too much is loud, and the error says why. Messages name at most a line number, never the file's text.

**`.gitignore` is not read.** What Git ignores is not always what a skill set should skip. A local build copy that Git ignores (for example a `dist/` folder holding copied skills) is read on a laptop and gives duplicate-name errors there, not in CI: add such folders to `.stackledgerignore` as well.

## Relation keys

Relations are declared in each skill's `metadata`, which the Agent Skills specification allows and which holds only strings, so `SKILL.md` stays valid for every tool that reads it:

```yaml
---
name: release
description: Use when shipping a Northwind release. Runs the writer, editor and reviewer in order.
metadata:
  stackledger-kind: playbook
  stackledger-skills: writer editor
  stackledger-agents: reviewer
---
```

| Key | Value |
|---|---|
| `stackledger-kind` | `skill` (the default when absent) or `playbook` |
| `stackledger-skills` | The skills and playbooks this one uses, names separated by spaces (or line breaks) |
| `stackledger-agents` | The agents this one uses, names separated by spaces (or line breaks) |

Any other `metadata` key starting with `stackledger-` in any letter case is an error, so a typo such as `stackledger-skill` is caught. Agents keep their tool's own format: Claude Code lists the skills an agent preloads under `skills`.

```yaml
---
name: reviewer
description: Reviews Northwind pull requests.
skills:
  - code-review
tools: Read, Grep
---
```

## Checks

Errors are what a pipeline should stop on; warnings are what a person should know but tools tolerate. The Agent Skills specification's own constraints are warnings, so sets you do not own (skills bundled with a tool) can still pass.

| Error | Warning |
|---|---|
| No frontmatter, frontmatter never closed, invalid YAML or duplicate keys, not a mapping | `name` over 64 characters, with an upper-case letter, with anything but letters, digits and hyphens, starting or ending with `-`, or holding `--` (after NFKC normalisation) |
| `name` or `description` missing, empty or not a string | `name` different from the folder or link name where the skill was found |
| A file over 1 MiB or one that cannot be read | `description` over 1024 characters; `compatibility` not a 1–500 character string; `license` or `allowed-tools` not a string |
| A second skill (or agent) with a name already in the set | Top-level fields outside the specification (one warning per skill, naming them) |
| An unknown `stackledger-*` key, a `stackledger-*` value that is not a string, a `stackledger-kind` other than `skill` or `playbook` | A `metadata` that is not a mapping, a key that is not a string, or a non-string value under another key |
| A name in `stackledger-skills` or `stackledger-agents` that is not in the set | A name listed twice in one relation; a skill listing itself |
| A rule ID twice in one `rules.md` | A rule ID also used by an earlier skill |
| A private key or a payment-card number in any file read, code blocks included | An agent's `skills` that is not a list of strings, or names a skill not in the set |
| A given folder in which no skill folder or agent file is found | A file in `agents/` with no frontmatter |
| A sub-folder or linked skill folder that cannot be read; a `.stackledgerignore` that cannot be used (see [Ignore file](#ignore-file)) | A symbolic link to a folder without `SKILL.md`, a broken or looping link, or a link to neither a file nor a folder (a link to a file is read where that file is expected and otherwise ignored) |

Each file is checked on its own first, and an error stops its later checks: size, secrets in the raw text, frontmatter, secrets in the decoded values (YAML escapes can hide a number), `name` and `description`, then the other fields. Only files without an error join the set. Relations, preloads and rule IDs are then checked against that fixed set; their problems never remove anything, so one missing skill gives one message, not a cascade. A secret is reported with a fixed message that never repeats the value. File and folder names are not scanned: they appear in paths, as in `stackledger validate`, so do not name a folder after a secret.

A skill whose `rules.md` is too large, unreadable or holds a secret still joins the set, with no rules.

## Output and exit codes

Each problem is one line, `<path>:<line>:<column> <error|warning> <field> <message>` (`-` when there is no field), sorted by path, position, field, severity and message; the last line gives seven counts: `skills`, `playbooks`, `agents` and `rules` count what joined the set, `ignored` counts the entries skipped by ignore files, then `errors` and `warnings`. With the `release` playbook above written as `stackledger-skills: writer editr` in `skills/release/SKILL.md`:

```text
skills/release/SKILL.md:6:23 error metadata.stackledger-skills Skill editr is not in the set
skills: 3, playbooks: 1, agents: 2, rules: 10, ignored: 0, errors: 1, warnings: 0
```

Paths start with the folder argument as given (without trailing `/`), or with nothing when no folder is given. With `--json`, stdout is one object with, in this order, `problems` (`path`, `line`, `column`, `severity`, `field`, `message`), `ignored` (the paths skipped by ignore files, as problems display them, sorted by code point) and `summary` (the seven counts, in the counts line's order):

```json
{"problems":[],"ignored":["skills/fixtures","templates"],"summary":{"skills":3,"playbooks":1,"agents":2,"rules":10,"ignored":2,"errors":0,"warnings":0}}
```
 Control characters in file names are removed from text lines and written as `\u` escapes in JSON.

| Exit | Meaning |
|---|---|
| 0 | No error (warnings allowed) |
| 1 | At least one error |
| 2 | Usage error, or a given folder that does not exist, is not a folder or cannot be listed; stdout is empty and stderr names the folder |

## In CI

A workflow for a skills repository (skills in sub-folders, agents in `agents/` at the top) that checks every pull request in three steps: check out, set up Node.js, validate. The skills commands need stackledger 0.2.0 or later; the skills map file and the Skills section of the site, 0.3.0 or later.

```yaml
name: Skills
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 22
      - run: npx --yes @brunosouzas/stackledger@0.6.0 skills validate
```

With no folder the repository root is checked, so problem paths are relative to it. The job fails on any error and passes with warnings. Name folders on the last line (for example `skills validate skills vendor`) to check only those, together.

A pull request can also change `.stackledgerignore` to hide a real skill. To refuse skips you have not approved, replace the last step with one that compares the JSON `ignored` list with a trusted one (`jq` is installed on GitHub's Ubuntu runners; the exit code of `skills validate` is replaced by the `errors` check, and a usage error leaves no JSON, so `jq` fails):

```yaml
      - run: |
          npx --yes @brunosouzas/stackledger@0.6.0 skills validate --json > skills.json || true
          jq -e '.summary.errors == 0 and .ignored == ["skills/fixtures","templates"]' skills.json
```

Compare the list, not only the count: a fork could swap an approved exclusion for a real skill and keep the number. A folder pattern such as `fixtures/` lists only the folder, so a skill moved into it stays hidden with the same list: prefer one entry per pattern (`fixtures/*`), so each hidden skill shows up in the list, or also check `.summary.skills`.

## Map in the repository

`stackledger skills map` writes the set's declared relations as Markdown pages with [Mermaid](https://mermaid.js.org/) diagrams into a folder of your repository, so people read the map where they already read the skills: offline, in an editor or on the Git host, and a reviewer sees in a pull request's diff that a change adds or drops a relation.

```sh
stackledger skills map [folder...] --out <folder> [--check]
```

It reads the same set as `skills validate` with the same folders (none: the current folder), `.stackledgerignore` included. Run it at the top of the repository with an output folder inside it:

```sh
stackledger skills map . --out docs/skills-map
```

### Layout

| Path | Holds |
|---|---|
| `README.md` | The index: the counts (skills, playbooks, agents, rules, ignored entries, errors, warnings), one diagram of every relation, a table each for playbooks, agents and skills with what each brings in and what brings it in, and "No declared incoming relations": the skills and playbooks nothing brings in (a person may still load them by hand, so they are not called unused) |
| `skills/<name>.md`, `playbooks/<name>.md`, `agents/<name>.md` | One page per item: its kind and description, a diagram of what brings it in (left) and what it brings in (right), the same relations as linked lists, "Reached through" (what brings it in only through two or more relations), its rule IDs and its source files |
| `.stackledger-skills-map` | The marker, holding `stackledger skills map` (LF or CRLF): the folder is the command's |
| `.gitattributes` | `* text eol=lf`, so every checkout keeps the bytes the command writes |

A skill and an agent may share a name, hence the separate folders. A name that is not a valid Agent Skills name (capitals, paths, more than 64 characters) or that is a Windows device name (`con`, `nul`, `com1`…) gets a file name made of `_` and its hexadecimal UTF-8 bytes (`Writer` is `skills/_577269746572.md`), so every file name is lowercase ASCII and checks out on every system. Two items of one kind that would still get the same file name (an 11-digit hash shared by two long names, or names that are not valid Unicode) stop the command with exit 1, naming both files, before anything is written.

In the diagrams playbooks are rounded boxes, agents hexagons and skills plain boxes; the item of a page has a thick border. Node IDs come from the file names (`s_writer`, `p_release`, `a_reviewer`), so adding a skill changes only the lines about it. A diagram holds at most 400 relations and 40,000 characters, below the default limits of Mermaid 11 and 12 (500 edges, 50,000 characters); over that, the page says how many relations there are and the lists and tables still hold every one.

The output is byte for byte the same for the same files on every machine: no date or version, a fixed order (lists by name, diagrams by kind and name), `/` in links, LF line endings. Descriptions are made one line, lose control and format characters (zero-width, bidirectional and tag characters), and are cut at 1,024 characters. Names and descriptions are escaped: Markdown's special characters, a leading `-`, `+`, `1.` or `1)`, the `:` of `https://`, the `.` of `www.`, and `$` written as `<span>$</span>`, so a skill file cannot inject HTML, a list, a link to a web address or `www.` name, math or a diagram line into the pages. GitHub still links a bare e-mail address (`team@example.com`) as `mailto:`. A source file is linked only when it and the map folder are inside the current folder; otherwise the page shows its path below its given folder and why: "outside the current folder" for a file elsewhere (a tool folder in your home folder), "the map folder is outside the current folder" when `--out` leaves it. So no page ever names a folder above the repository; run the command from the repository's top folder to get links.

### What is drawn

Only declared relations: `loads` for each name in a skill's `stackledger-skills`, `uses` for each name in its `stackledger-agents`, and `preloads` for each name in an agent's `skills`. A name not in the set is not drawn (`skills validate` reports it), a repeated name is drawn once, a skill listing itself is a loop. Nothing is guessed from the text: a skill named in backticks in another skill's body is not a relation. A declaration says that a file asks for another; it does not prove that a tool loads it. Agent fields other than `skills` (tools, model) are not drawn.

### The folder it owns

stackledger owns, in the output folder, the marker, `.gitattributes`, `README.md`, the `.stackledger-skills-map-*.tmp` files an interrupted run may leave at the top, and the whole `skills/`, `playbooks/` and `agents/` folders. Each run rewrites what changed and **removes every other entry inside those three folders**, files and sub-folders included, so a removed skill's page disappears: keep your own notes next to them, at the top of the output folder, where every other entry is left untouched.

Before writing anything, the command refuses (exit 2) an output folder that:

- is, or holds, a given folder, or a skill folder, agent file, `SKILL.md`, `rules.md` or `.stackledgerignore` the set was read from, also through a link and also a rejected one (cleaning the map would delete it);
- is inside a skill folder of the set, or is or is inside the top-level `agents/` of a given folder, in any case (`AGENTS`), as its `README.md` would be read as an agent;
- has a folder starting with `.` or named `openspec` (in any case) on its path below the current folder, or from a given folder that holds it down, the given folder's own name included (tool folders such as `.claude/commands` load Markdown as instructions: with `~/.claude` given, `~/.claude/commands/map` is refused);
- exists, is not empty and has no valid marker, or whose marker, `.gitattributes`, `README.md` or kind folders are symbolic links.

Files are written to a new temporary file in their own folder and renamed into place, so a link or hard link at a page path is replaced, never written through. Stale entries are removed without following links, after the pages are written. Names are compared exactly, so on a case-insensitive disk a stray `skills/Writer.md` is replaced by `skills/writer.md`, never taken for it, and on a case-sensitive disk a `skills/Writer.md` hard-linked to `skills/writer.md` is a separate entry and is removed. Immediately before every change (creating a folder, removing an entry, creating a temporary file, renaming it into place, fixing a spelling, removing a temporary file) the command checks that the output folder and the kind folders are still the ones it checked, and that a kind folder that did not exist has not appeared (a link to another folder, say); it stops with exit 1, naming the folder, if one was moved, replaced or appeared, or if an entry vanished while it compared or wrote them. A read of the folder that fails during the run is exit 1 naming the path, never a usage error. These checks narrow the window but cannot close it: Node.js has no directory handles to change a folder through, so a swap between the last check and the change itself remains possible. Do not let another process move, replace or write the output folder while the command runs. A page it cannot read is rewritten. There is no atomic swap of the whole folder: after an interrupted run, run the command again (or restore the folder with Git). Two runs on one folder at the same time are not supported.

A set with errors is still mapped, without the items that have them, with exit 0; the index and stderr give the counts, with the hint to run `skills validate`. A given folder in which nothing is found (a wrong path, or an ignore file hiding everything) is exit 1 and changes nothing, so a mistake cannot empty the map.

| Exit | Meaning |
|---|---|
| 0 | The map is written (or was already up to date); with `--check`, it is up to date |
| 1 | With `--check`, the map is out of date; a given folder had nothing found in it; two items would get the same page; the output folder changed during the run; a file could not be written or removed (stderr names it) |
| 2 | Usage error (`--out` missing, unknown option), a given folder that does not exist or cannot be listed, or a refused output folder; nothing is written |

stdout stays empty; stderr gives the pages created, updated and removed.

### `--check` in CI

`--check` writes nothing. It prints one line per file that would be created, updated or removed (`update skills/writer.md`) and exits 1 when there is any, so a pipeline can fail a pull request that changed skills without running the map. It reads CRLF as LF, for checkouts made before `.gitattributes` existed. Run it next to `skills validate`, which is what fails on errors:

```yaml
      - run: npx --yes @brunosouzas/stackledger@0.6.0 skills validate
      - run: npx --yes @brunosouzas/stackledger@0.6.0 skills map . --out docs/skills-map --check
```

### Where the diagrams render

GitHub, GitLab and Visual Studio Code render `mermaid` code blocks in Markdown. Bitbucket Cloud and Azure Repos files do not (and Azure DevOps wikis do not support `flowchart`): there the diagrams show as text, and the lists and tables still hold every relation.

## Skills on the site

`stackledger build` publishes a skill set next to the software: give it `--skills <folder>` (repeatable), or list the folders in the catalogue's `Settings` under `spec.skills.folders`, paths relative to the catalogue folder. `--skills` replaces the setting entirely. The rules for both, with a laptop and a pipeline example, are in the [README](../README.md#skills-on-the-site); the build's refusals and exit codes in [docs/site.md](site.md#skills).

The set is read exactly as `skills validate` reads it: the same folders give the same skills, the same problems and the same counts. A set with errors is still built, without the items that failed their own checks; the build report gives the counts and points to `skills validate`.

### The skills map file

The skills map lives in `stackledger-skills.yaml` at the top of a skills folder (never in a sub-folder, and not in a folder that is itself one skill). It holds the same `Line` and `MapLayout` documents as a catalogue, with skill references for stops and stations:

```yaml
apiVersion: stackledger/v1alpha1
kind: MapLayout
metadata:
  name: skills
spec:
  stations:
    "playbook:publishing": [0, 0]
    "skill:writer": [2, 0]
    "skill:editor": [4, 2]
    "agent:reviewer": [6, 2]
    "playbook:engineering": [0, 4]
    "skill:tester": [2, 4]
  zones:
    - { name: publishing, title: Publishing, color: "#F5A623" }
    - { name: engineering, title: Engineering, color: "#7B61FF" }
---
apiVersion: stackledger/v1alpha1
kind: Line
metadata:
  name: publish
  title: Publish an article
spec:
  code: P
  color: "#E4002B"
  stops: ["playbook:publishing", "skill:writer", "skill:editor", "agent:reviewer"]
```

- A reference is `skill:`, `playbook:` or `agent:` in lower case, then the item's exact name. A reference to something that is not in the set, or not of that kind, is an error at it, and that stop is not drawn; the item itself stays in the set.
- Every catalogue rule for lines and layouts applies: at least two stops, unique names and codes, one layout, positions on whole grid cells, the secret guard. A stop without a position is placed by the map, and the build report suggests a position to paste, written as the key (`skill:writer: [2, 0]`).
- With several skills folders, their map files read as one: the first `MapLayout` wins, and a line name used twice is an error.
- `skills validate` checks the map file too, so a renamed skill fails the pipeline that checks the skills repository. It adds no count to its summary line.
- The catalogue never reads a file with this name, even inside the catalogue folder, so one repository can hold both. A catalogue that used this name for its own lines must rename the file.

**Playbook zones.** Each zone's `name` must be a playbook of the set. Its members are the playbook and what it names directly in `stackledger-skills` and `stackledger-agents` (not what the skills it loads bring in). A skill in two playbooks is in both zones, so zones overlap; the area of a zone is the convex outline of its members, so place the shared skills between the playbooks, as `editor` and `reviewer` above, and the overlap stays a clean band. Each zone title sits next to its playbook's station. You choose which playbooks are zones: with many playbooks, colour only the few that matter. A zone that names no playbook is an error on its `name`; the rest of the layout is still used.

### What the site shows

| Page | Path | Shows |
| --- | --- | --- |
| Skills | `/skills/` | The counts, and every skill, playbook and agent with its kind, description and number of rules; search and a kind filter |
| Skill map | `/skill-map/` | The skills metro map, sized as the software map (never larger than drawn, so both show the same line thickness on a wide screen), with zoom, pan, line highlight and a playbook filter (a station in two zones stays lit for both), then each line's stops as links. A skill or playbook with rules shows their number on its station (`99+` above 99), explained in the legend as "Number of rules"; the rules themselves are on the item's page and in `/rules/` |
| Rules | `/rules/` | Every rule with its ID, text, group and the skill or playbook that defines it; search |
| Skill, playbook, agent | `/skills/<file>/`, `/playbooks/<file>/`, `/agents/<file>/` | Name, kind, description, a diagram of what brings it in and what it brings in, the same as lists, "Reached through", the skill lines that stop at it, its rules and its source files |

`<file>` is the page name `skills map` uses, so `writer` is `/skills/writer/` and `Writer` is `/skills/_577269746572/`. Descriptions are shown on one line, cut at 1,024 characters; the body of `SKILL.md` is not published. Source files are shown as their path below the skills folder, never as an absolute path.

### In CI

The catalogue pipeline needs the skills too. Check out the skills repository from a trusted branch, next to the catalogue, and build as usual:

```yaml
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          path: catalogue
          persist-credentials: false
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          repository: northwind/ai-kit
          ref: main
          path: ai-kit
          token: ${{ secrets.AI_KIT_READ_TOKEN }}
          persist-credentials: false
      - run: npx --yes @brunosouzas/stackledger@0.6.0 build catalogue --out public --skills ai-kit
```

- A private skills repository needs a token that can only read it. Keep it out of pull requests from forks: build those without the skills (no `--skills` and no `spec.skills`), and never publish a pull-request build.
- The site changes when the skills change: rebuild on a schedule, or trigger the catalogue pipeline from the skills repository's main branch.
- Any Git host works the same way: two checkouts, then one command.
- No software catalogue yet? A catalogue folder with only `stackledger.yaml` (`spec.sites: [full]` and `spec.skills.folders`) builds a site whose Software map is empty and whose Skills section is complete.

