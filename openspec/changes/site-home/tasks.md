## Scenario to test map

Levels: U unit, I integration (built site), B browser (Playwright). Every scenario has one test named after it.

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Title and accent; Title too long; Colour name; Logo not supported (unchanged tests); Home text and links; Script URL; Bad link; Too many links; Unknown home field | `test/unit/settings.test.ts` | U |
| catalogue-site | Item pages; No journeys; Reports in full only; Site title; View in the footer; Reports link; Software sub-navigation (updated for `/map/`); Map at /map/; Default title (software pages); Home chrome; Home text; Empty catalogue; Two links; Broken settings, no links; Hostile link text | `test/integration/site.test.ts` | I |
| site-security | Only local URLs (updated: the example builds with no home links); Home links are the only external URLs | `test/integration/site.test.ts` | I |
| site-security | Link URL outside the home | `test/unit/site-relative.test.ts` (the URL scan of `src/site/relative.ts`) | U |
| site-security | Two sites on one host; Hostile title (unchanged tests) | `test/browser/site.spec.ts`, `test/integration/site.test.ts` | B, I |
| catalogue-site | Skills link (unchanged); Home without skills; Default title (Skills pages); Title opens the home; Home in full and staff | `test/integration/site-skills.test.ts` | I |
| catalogue-site | Theme remembered (unchanged); the map page tests move from `/` to `/map/` | `test/browser/site.spec.ts` | B |

## 1. Settings

- [ ] 1.1 Tests first: "Home text and links", "Script URL", "Bad link", "Too many links" and "Unknown home field". Verify: they fail on `main`.
- [ ] 1.2 `src/schema.ts`: `spec.site.home` with `text` and `links` (title, url, description), limits and the `http(s)` check. Verify: `npm test`.

## 2. Pages

- [ ] 2.1 Tests first: "Map at /map/", "Default title", "Title opens the home", "Home in full and staff", "Home chrome", "Home without skills", "Empty catalogue", "Two links" and "Hostile link text". Add "Home text", "Broken settings, no links", "Home links are the only external URLs" and "Link URL outside the home". Point the existing map and sub-navigation tests at `/map/`, and update `test/unit/site-data.test.ts`, which expects the title `Software map`. Verify: the new tests fail on `main`.
- [ ] 2.2 `src/site/data.ts`: `DEFAULT_TITLE` becomes `stackledger`; add the home data (counts per view, text, links), with no home text or links when `Settings` has an error. Move the map page to `site/src/pages/map/index.astro`; write the home in `site/src/pages/index.astro`; update `Header.astro`, `SubNav.astro`, `Footer.astro`, `lib/site.ts` (the `home` page key), `src/site/relative.ts` (the URL scan accepts a home link's URL only in an `a` `href` of the root `index.html`; the build passes it the validated URLs) and the styles of the banner and cards. Verify: `npm test`, `npm run test:browser`.

## 3. Images and documentation

- [ ] 3.1 Update the browser tests and screenshots that open the map at `/`. Regenerate `docs/images/site-map-*.png` at `/map/`, and add a screenshot of the home with the Northwind example. Look at both themes and fix visible defects. Verify: `npm run test:browser`.
- [ ] 3.2 Update the docs:
  - `README.md` (pages, settings example, screenshots);
  - `docs/site.md`;
  - `docs/catalogue-format.md` (`spec.site.home`, and the default title);
  - `docs/reports.md` (the calendar name's default becomes `stackledger`);
  - `docs/hosting.md` (only if it lists page paths: add `map/`);
  - `docs/roadmap.md` (item 4b).

  Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
