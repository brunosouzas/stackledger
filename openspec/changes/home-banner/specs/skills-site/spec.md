## MODIFIED Requirements

### Requirement: Text from skill files
Text from skill files and map files SHALL be shown only as text, escaped by the template engine or the SVG renderer. Descriptions SHALL be made one line, lose control and format characters (Unicode `Cc` and `Cf`) and be cut at 1,024 code points as `stackledger skills map` does. Names, rule IDs, texts, whys, checks and groups, and line titles SHALL lose those characters where shown; identities, file names and references are unchanged.

#### Scenario: Description with HTML
- **WHEN** a description holds `<img src=x onerror=alert(1)>`
- **THEN** the pages show it as text and no page has an `img` element other than the site's own images ("Brand mark")

#### Scenario: Hostile script text
- **WHEN** a description and a rule text hold `</script><script>alert(1)</script>`
- **THEN** no page has a script element other than the site's script files

#### Scenario: Bidirectional override
- **WHEN** a skill name, a description, a rule text, a rule group and a skill line title hold U+202E
- **THEN** no file of the site holds U+202E, and the skill's page is still named after its page file name
