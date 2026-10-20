# Proposal: catalogue-site

## Why

People who govern software want to open a website and see their software and licences ([ADR 5](../../../docs/adr/0005-static-site-no-server.md)). The catalogue, the views, the graph queries and the map engine are delivered; this change turns them into the static site: the map you can explore, the list of software, a page per item and a page per journey, built as two separate sites for the `full` and `staff` views ([ADR 7](../../../docs/adr/0007-two-views-built-as-separate-sites.md)) and hardened for hosting behind an identity-aware proxy ([ADR 6](../../../docs/adr/0006-authentication-at-an-identity-aware-proxy.md)).

## What Changes

- `stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` builds `<dir>/full/` and `<dir>/staff/`, each a complete static site generated with Astro from that view only.
- Pages:
  - **Map** (`/`): the metro map with zoom and pan, a zone filter, line highlight from the legend, light and dark themes, and each station linking to its item page.
  - **Software** (`/software/`): every component and licence in a table with search and filters (kind, zone, lifecycle, owner), working in the browser from a local index.
  - **Item** (`/software/<name>/` for components, `/licences/<name>/` for licences): the item's fields as the view allows, its journeys, a neighbourhood diagram (what it depends on, what depends on it), the impact of removing it, and references that match nothing.
  - **Journeys** (`/journeys/` and `/journeys/<name>/`): every line, and for each a strip diagram with its stops in order and the interchanges with other lines.
- A look based on brunosouzas.com (layout, typography and colour tokens of its Astroplate-based theme, MIT, credited), with fonts shipped in the package and a small set of colours and the site title replaceable in `Settings`.
- Hardening: one fixed strict Content Security Policy with no inline code, relative URLs only, no third-party request of any kind, `noindex` and `robots.txt`, `_headers` and `robots.txt` at the root of the output and in each site, and every hidden field absent from every file of the `staff` site.
- The neighbourhood and journey diagrams are SVG drawn by stackledger's own code (no Mermaid), in the map's style.

## Capabilities

### New Capabilities

- `catalogue-site`: the pages, what each shows, navigation, interactivity and the look.
- `site-security`: what the built site may and may not contain or request, per view.
- `build-command`: the `stackledger build` command line.

### Modified Capabilities

- `catalogue`: the `Settings` requirement gains `spec.site` (title and a few colours).
- `mcp-server`: the global help scenario lists `build` too.
- `metro-map`: the attribute allow-list gains `data-line` and `data-zone` (Allowed attributes, Safe SVG text, new Data attributes), used by the map page's filters.

## Impact

- New runtime dependencies: `astro` and two font packages (Heebo and Signika, OFL), pinned exactly. No React, no Tailwind runtime, no integrations that call the network.
- New code: an Astro project inside the package (`site/`), a build orchestrator in `src/site/`, the neighbourhood and strip diagrams in `src/map/`.
- Documentation: README (Usage, screenshots), `docs/site.md` (pages, hosting, headers, Cloudflare Pages note), `docs/catalogue-format.md` (`spec.site`).

## Out of scope

- Licence reports, cost totals and the renewals calendar feed (change `licence-reports`).
- Access recipes and building from a Git URL (change `catalogue-git-source`); this change only produces the folders and the `_headers` file.
- Editing from the website, a server, sign-in code, analytics.
- City backdrops and the ink theme (roadmap: `map-backgrounds`, `map-theme-ink`).
- Translations; the site is in English.

## Implicit requirements

- **Errors and invalid input:** requirement. A catalogue with errors still builds from what the views serve; usage and folder errors exit 2 and leave the output folder untouched; an internal build failure exits 1 and leaves no half-written site in place.
- **Limits:** requirement. 300 items and 20 lines build both sites within 90 seconds on CI.
- **Repetition and idempotency:** requirement. The same catalogue, date and version produce identical files; building twice into the same output folder replaces the previous build.
- **Concurrency:** n/a. One build at a time per output folder; the command does not lock it.
- **Security:** requirement. See `site-security`: the staff site carries no hidden value in any file; no external request; strict CSP; nothing written outside the output folder except a temporary folder that is removed.
- **Logs and observability:** requirement. stderr lists the two folders written, the page counts, and the catalogue counts in the full view as `map` does.

## Open questions

None. The owner decided on 2026-10-20: keep Astro with the guardrails in design.md, own SVG diagrams instead of Mermaid, and the four kinds of page above.

## Documentation

- `README.md`: Usage table (`stackledger build`), a screenshot of each page from the fictitious example.
- `docs/site.md` (new).
- `docs/catalogue-format.md`: `spec.site`.
- `docs/roadmap.md`: row 4 says own SVG diagrams instead of Mermaid; mark it delivered after merge.
- Brain vault: `10-personal/projects/stackledger/_index.md`.
