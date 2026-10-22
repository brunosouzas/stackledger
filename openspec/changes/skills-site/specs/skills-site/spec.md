## Purpose

Defines the Skills section that `stackledger build` adds to each site when it is given a skill set: the list of skills, playbooks and agents, the skills metro map, one page per item with an SVG diagram of its declared relations, and the rules index.

## ADDED Requirements

### Requirement: Skills pages
When a skill set is built, each site SHALL have the list `/skills/`, the map `/skill-map/`, the rules index `/rules/`, and one page per item: `/skills/<file>/` for a skill, `/playbooks/<file>/` for a playbook and `/agents/<file>/` for an agent, `<file>` being the page file name `stackledger skills map` gives the item, without `.md`. Without a skill set, none of these pages SHALL exist.

#### Scenario: Item pages
- **WHEN** the set has the skill `writer`, the playbook `release` and the agent `reviewer`
- **THEN** each site has `/skills/writer/`, `/playbooks/release/` and `/agents/reviewer/`

#### Scenario: Name that is not a file name
- **WHEN** a skill is named `Writer`
- **THEN** its page is `/skills/_577269746572/`

#### Scenario: Skill and agent with one name
- **WHEN** the set has a skill and an agent both named `reviewer`
- **THEN** the site has `/skills/reviewer/` and `/agents/reviewer/`

#### Scenario: No skill set
- **WHEN** a site is built without a skill set
- **THEN** it has no `/skills/`, `/skill-map/`, `/rules/`, `/playbooks/` or `/agents/` folder and no page links to one

### Requirement: Skills sub-navigation
The list, the skills map and the rules index SHALL share a sub-navigation linking `Skills` (`/skills/`), `Skill map` (`/skill-map/`) and `Rules` (`/rules/`), the current page marked with `aria-current="page"`. Item pages SHALL link back to the list.

#### Scenario: Rules page
- **WHEN** the reader opens `/rules/`
- **THEN** its sub-navigation links the three pages and only `Rules` has `aria-current="page"`

### Requirement: Same skills in every site
The Skills pages SHALL be built from one skill set for every site built, and each Skills page's `main` element SHALL be byte-identical in the `full` and `staff` sites: no field of a skill set is hidden from `staff`.

#### Scenario: Both sites
- **WHEN** a corporate build has a skill set
- **THEN** every Skills page exists in both sites and its `main` element is the same in both

#### Scenario: Personal build
- **WHEN** a personal build (`spec.sites: [full]`) has a skill set
- **THEN** the `full` site has the Skills pages and there is no `staff` site

### Requirement: Skills list
`/skills/` SHALL give the counts of skills, playbooks, agents and rules, and a table of every skill, playbook and agent with its name, kind, description and number of rules, sorted by name then kind (skill, playbook, agent) by code point, each row linking to its page. A search box and a kind filter SHALL hide rows as the software list does; without JavaScript the whole table is shown.

#### Scenario: Search
- **WHEN** the reader types `REVIEW` in the search box
- **THEN** only rows with `review` in a shown cell, in any case, remain

#### Scenario: Kind filter
- **WHEN** the reader chooses the kind `playbook`
- **THEN** only playbook rows remain

#### Scenario: Nothing matches
- **WHEN** the search matches no row
- **THEN** the page says no item matches

#### Scenario: Without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the whole table is shown, unfiltered

#### Scenario: Every item rejected
- **WHEN** every `SKILL.md` and agent file found in the skills folders has an error in its own checks, so none joins the set
- **THEN** `/skills/`, `/skill-map/` and `/rules/` exist and say there are no skills, no skill lines and no rules

#### Scenario: Relation error keeps the page
- **WHEN** the playbook `release` lists the missing skill `ghost` and is otherwise valid
- **THEN** `release` is in the list and has its page

### Requirement: Skill and playbook pages
A skill or playbook page SHALL show its name as the `h1`, its kind, its description, the relation diagram, the lists "Brought in by" and "Brings in" (each item with its relation kind and a link to its page), "Reached through", the skill lines that stop at it, its rules in file order with ID, group, text, why and check, and its source files.

#### Scenario: Playbook page
- **WHEN** the playbook `release` loads `writer` and `editor` and uses the agent `reviewer`
- **THEN** its page lists under "Brings in" `editor` (loads), `reviewer` (uses) and `writer` (loads), linking `/skills/editor/`, `/agents/reviewer/` and `/skills/writer/`

#### Scenario: Rules on a skill page
- **WHEN** `writer`'s `rules.md` holds `- **WR-1** Short sentences.` under `## Writing (WR)`, then `  Why: readers skim.` and `  Check: no sentence over 30 words.`
- **THEN** `writer`'s page shows `WR-1` with the group `Writing (WR)`, the text, the why and the check

#### Scenario: Reached through a playbook
- **WHEN** the playbook `ship` loads the playbook `release`, which loads `writer`
- **THEN** `writer`'s page lists `ship` under "Reached through" and not under "Brought in by"

#### Scenario: Lines at an item
- **WHEN** the skill lines `publish` and `review` stop at `writer`
- **THEN** `writer`'s page names both lines

#### Scenario: Item with no relation
- **WHEN** the skill `notes` brings nothing in and nothing brings it in
- **THEN** its page says so under both lists and its diagram shows only `notes`

### Requirement: Agent pages
An agent page SHALL show its name as the `h1`, the kind `agent`, its description, the relation diagram, "Brought in by" (the skills and playbooks that use it), "Brings in" (the skills and playbooks it preloads), "Reached through", the skill lines that stop at it and its agent file.

#### Scenario: Agent page
- **WHEN** the agent `reviewer` preloads `code-review` and the playbook `release` uses it
- **THEN** its page lists `release` (uses) under "Brought in by" and `code-review` (preloads) under "Brings in"

### Requirement: Declared relations on the site
The pages SHALL show exactly the relations and the "Reached through" items `stackledger skills map` gives for the same set: declared relations only, a name not in the set not shown, a repeated name shown once, a self-relation kept.

#### Scenario: Same as the Markdown map
- **WHEN** the example skill set is built and also mapped with `stackledger skills map`
- **THEN** every item page lists the same "Brought in by", "Brings in" and "Reached through" items, with the same relation kinds, as its Markdown page

#### Scenario: Missing relation target
- **WHEN** a playbook lists `ghost` in `stackledger-skills` and there is no such skill
- **THEN** no page shows `ghost`

### Requirement: Relation diagram
Each item page SHALL hold a safe SVG drawn by stackledger in the style of the neighbourhood diagram: the item in the centre, what brings it in on the left, what it brings in on the right, each box naming the item and its relation kind. A neighbour on both sides SHALL appear on both; a self-relation SHALL show the item on both sides. Skills SHALL be boxes, playbooks pills and agents hexagons.

#### Scenario: Diagram of a skill
- **WHEN** `writer` is loaded by `release`
- **THEN** `writer`'s diagram has a box `release` with the text `loads` on the left of the centre box `writer`

#### Scenario: Two playbooks that load each other
- **WHEN** `a` loads `b` and `b` loads `a`
- **THEN** `a`'s diagram shows `b` on both sides

#### Scenario: Shapes
- **WHEN** a diagram shows a skill, a playbook and an agent
- **THEN** the playbook's box is a `rect` whose `rx` is half its height, the agent's a six-point `polygon`, and the skill's a `rect` with a smaller `rx`

### Requirement: Relation diagram safety
The relation diagram SHALL use only the element names, attribute names and attribute values the metro-map spec allows, write every text through XML escaping, and show at most 64 code points of a name, then `…`, with the full name in a `title`.

#### Scenario: Hostile name
- **WHEN** a skill is named `<script>alert(1)</script>` and is loaded by `release`
- **THEN** `release`'s diagram parses as XML, every element and attribute name is on the allow-lists, and the name appears only as text

#### Scenario: Long name
- **WHEN** a skill name has 70 code points
- **THEN** its box shows the first 64 and `…`, and its `title` holds the whole name

### Requirement: Relation diagram budget
A side with more than 100 items SHALL NOT be drawn: the diagram SHALL be replaced by a sentence giving the number of relations, and the lists still hold every item.

#### Scenario: At the budget
- **WHEN** a playbook loads exactly 100 skills
- **THEN** its page has a diagram with 100 boxes on the right

#### Scenario: Over the budget
- **WHEN** a playbook loads 101 skills
- **THEN** its page has no relation diagram, says it has 101 relations, and lists all 101

### Requirement: Diagram links
Every box of the relation diagram SHALL carry `data-ref` with the item's station reference (`skill:<file>`, `playbook:<file>` or `agent:<file>`, as the metro-map spec defines it), and the page script SHALL open that item's page when the box is clicked, or focused and Enter is pressed. The lists SHALL hold the same items as links, as the diagram's text alternative.

#### Scenario: Box link
- **WHEN** the reader clicks the `release` box on `writer`'s page, or focuses it and presses Enter
- **THEN** the browser opens `release`'s page

### Requirement: Skills map page
`/skill-map/` SHALL show the skills map of the set in the page theme, with zoom, pan, reset, line highlight and, when a zone is drawn, the zone filter as on the software map page (a station in several zones stays lit for each), the line chips and the symbols of the skills map's legend. The page script SHALL make each station a link to its item page. A list of the drawn lines with their stops as links SHALL follow the map, as its text alternative.

#### Scenario: Station link
- **WHEN** the reader clicks station `skill:writer`, or focuses it and presses Enter
- **THEN** the browser opens `writer`'s page

#### Scenario: Highlight a skill line
- **WHEN** the reader chooses line `publish` in the line chips, then chooses it again
- **THEN** every other line is dimmed, then restored

#### Scenario: Filter by a playbook zone
- **WHEN** `writer` is in the zones `release` and `review`, `editor` only in `release`, and the reader chooses the zone `review`
- **THEN** `editor` is dimmed and `writer` is not; choosing `release` leaves both lit

#### Scenario: No zone filter without zones
- **WHEN** the skills layout declares no zone
- **THEN** the page has no zone filter

#### Scenario: No skill lines
- **WHEN** no given folder has a skills map file
- **THEN** the page says `No skill lines yet` and names `stackledger-skills.yaml`

#### Scenario: Map without JavaScript
- **WHEN** JavaScript is disabled
- **THEN** the whole map is shown at full size

### Requirement: Rules index
`/rules/` SHALL list every rule of the set in one table with its ID, text, group and the skill or playbook that defines it (a link to its page), sorted by ID, then that item's name, by code point; a rule ID used by two skills SHALL give two rows. A search box SHALL hide rows that do not contain the typed text, ignoring case, in their shown cells; without JavaScript the whole table is shown.

#### Scenario: Shared rule ID
- **WHEN** the skills `developer` and `documentation` both define `DOC-1`
- **THEN** the index has two `DOC-1` rows, `developer`'s first

#### Scenario: Rule of a playbook
- **WHEN** the playbook `release` has a `rules.md` defining `REL-1`
- **THEN** the `REL-1` row links `/playbooks/release/`

#### Scenario: Search rules
- **WHEN** the reader types `doc-1`
- **THEN** only rows with `doc-1` in a shown cell, in any case, remain

#### Scenario: No rules
- **WHEN** no skill has a rule
- **THEN** the page says there are no rules

### Requirement: Text from skill files
Text from skill files and map files SHALL be shown only as text, escaped by the template engine or the SVG renderer. Descriptions SHALL be made one line, lose control and format characters (Unicode `Cc` and `Cf`) and be cut at 1,024 code points as `stackledger skills map` does. Names, rule IDs, texts, whys, checks and groups, and line titles SHALL lose those characters where shown; identities, file names and references are unchanged.

#### Scenario: Description with HTML
- **WHEN** a description holds `<img src=x onerror=alert(1)>`
- **THEN** the pages show it as text and no page has an `img` element

#### Scenario: Hostile script text
- **WHEN** a description and a rule text hold `</script><script>alert(1)</script>`
- **THEN** no page has a script element other than the site's script files

#### Scenario: Bidirectional override
- **WHEN** a skill name, a description, a rule text, a rule group and a skill line title hold U+202E
- **THEN** no file of the site holds U+202E, and the skill's page is still named after its page file name

### Requirement: Source paths
A source file SHALL be shown as its path below its given folder, separated by `/`, without a link. No path stackledger computes for a page SHALL be absolute or include a skills folder argument, a skills folder's real path or the catalogue folder's path; text taken from a file is shown as written.

#### Scenario: Tool folder in the home folder
- **WHEN** the skills folder is `/home/northwind/.claude/skills`, holds `writer/SKILL.md`, and no skill file mentions `/home/northwind`
- **THEN** `writer`'s page shows `writer/SKILL.md`, and no file of the site holds `/home/northwind`

#### Scenario: Relative skills folder
- **WHEN** the command has `--skills ../northwind-kit`, that folder holds `skills/writer/SKILL.md`, and no skill file mentions `northwind-kit`
- **THEN** `writer`'s page shows `skills/writer/SKILL.md`, and no file of the site holds `northwind-kit`

### Requirement: Skills pages under the site policy
The Skills pages SHALL follow the site-security requirements of the other pages: the same Content Security Policy, no inline code, relative URLs, `noindex`, no external request.

#### Scenario: Pages work under the policy
- **WHEN** the Skills pages are opened in a headless browser
- **THEN** no CSP violation is reported and search, kind filter, zoom, line highlight and links work
