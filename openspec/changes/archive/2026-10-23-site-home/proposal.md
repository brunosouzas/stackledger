## Why

Since the Skills section (0.3.0), the site header says "Software map" even on Skills pages, and its title link opens the software map. That stopped being the right front door once the site had two divisions (AB#137, found with the owner's real catalogue in AB#129). The owner decided on 2026-10-23:

- the default title becomes `stackledger`;
- the title opens a new home page at `/`, and the software map moves to `/map/`;
- the home is generic: a banner and links set in `Settings`, so each catalogue points wherever it wants (his own points to his articles).

## What Changes

- **Home page at `/`** in each site (`full` and `staff`). It has:
  - a banner, with the site title as its heading and a short text, `spec.site.home.text` or a default sentence;
  - a card for each division, with its counts and links: Software (components, licences, journeys; the Reports link in `full` only) and, with a skill set, Skills (skills, playbooks, agents, rules);
  - when `spec.site.home.links` is set, a "Links" list: each link with its title, an optional description and its URL, opened in the same tab.
- **The software map moves from `/` to `/map/`.** The Software division and its "Map" entry link `/map/`. Other pages keep their paths.
- **Default title `stackledger`** instead of `Software map`. A title set in `spec.site.title` still wins.
- **New settings** `spec.site.home.text` and `spec.site.home.links`, validated by `stackledger validate`. A link's URL must be `https://` or `http://`.

Out of scope:

- the city backdrop behind the map (`map-backgrounds`, AB#134, a separate change after this one);
- an illustration or image in the banner;
- reading a feed of articles at build time (the owner chose configured links);
- a redirect from `/` to `/map/` (the home links the map);
- changing the owner's own catalogue. That happens in `stackledger-catalog` after a release that has this change: remove the title, so the default applies, and add links to his articles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue-site`: "Pages" (home at `/`, map at `/map/`) and "Layout" (default title, links) change. A requirement is added for the home page.
- `catalogue`: "Site settings" gains `home`.
- `site-security`: "No external requests", "Relative URLs" and "Escaped catalogue text" exempt the home's `Links` anchors.

## Impact

- `site/src/pages/index.astro` becomes the home page; the map page moves to `site/src/pages/map/index.astro`. Also changes: `Header.astro`, `SubNav.astro`, `Footer.astro` (its Map link), `src/site/relative.ts` (the build's URL scan), `site/src/lib/site.ts`, `src/site/data.ts` (`DEFAULT_TITLE`, home data), `src/schema.ts` (`spec.site.home`), and styles in `site/src/styles/pages.css`.
- Browser and integration tests that open the map at `/` move to `/map/`, and the README screenshots of the map page are regenerated.
- A bookmark of `/` now opens the home, which links the map.
- The default title is also the calendar name of `renewals.ics` and of `stackledger report --format ics`, so that name becomes `stackledger` too when no title is set.
- The calendar name is covered by the updated `test/unit/site-data.test.ts`, which reads the default title through `siteTitle`.
- `site-security`: its rule against links to other sites gets one exemption, the home's `Links` anchors. The risk stays low: URLs are limited to `http(s)`, the site already sends `Referrer-Policy: no-referrer` (so a click does not reveal the private site's address), and anchors carry `rel="noopener noreferrer"`.

## Implicit requirements

- **Errors and invalid input:** each new field gets a validation error on its own path, as other `spec.site` fields do. As today, a `Settings` with an error makes the site use the default title and colours; it also uses no home text and no links. Also as today ("Broken settings choose the corporate mode"), a typo in a link makes a personal-mode catalogue build the `staff` site too, until it is fixed.
- **Limits:**
  - `text`: at most 200 characters.
  - `links`: at most 20 links.
  - Each link: `title` at most 60 characters, `description` at most 200, `url` at most 2,048.
- **Repetition and idempotency:** the build stays byte-identical for the same input.
- **Concurrency:** n/a.
- **Security:**
  - Link URLs are limited to `http(s)`, so `javascript:` and `data:` are refused.
  - Every text is escaped by the template engine.
  - Links carry `rel="noopener noreferrer"`.
  - The CSP is unchanged: links are navigation, not loaded resources.
  - A link URL may not carry a user name or password, so a credential cannot reach both sites through it.
  - The build's URL scan accepts a link's URL only where it belongs, in an anchor of the root `index.html`; anywhere else, it still fails the build.
- **Logs and observability:** n/a. The build reports nothing new.

## Documentation

- `README.md`: settings example, page list, screenshots.
- `docs/site.md`: pages and home.
- `docs/catalogue-format.md`: `spec.site.home`.
- `docs/reports.md`: the default calendar name.
- `docs/hosting.md`: only if it lists page paths, add `map/`.
- `docs/roadmap.md`: item 4b.
- Vault notes, after the merge: roadmap, changelog and the `stackledger-catalog` repository note.
