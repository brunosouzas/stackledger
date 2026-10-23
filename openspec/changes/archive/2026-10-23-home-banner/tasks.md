## Scenario to test map

Levels: U unit, I integration (built site), B browser (Playwright). Every scenario has one test named after it. Tests that change are listed in design "Test changes".

| Spec | Scenarios | File | Level |
| --- | --- | --- | --- |
| catalogue | Link icon; Unknown link icon; Home text and links, Script URL, Bad link, Too many links and Unknown home field (unchanged) | `test/unit/settings.test.ts` | U |
| catalogue | Icon names match the design system | `test/unit/site-brand.test.ts` | U |
| catalogue-site | Banner file is the design system's banner; Link icon files are the design system's; Dark mark is the dark ledgerMark; Site art is inert; Favicon is the mark (unchanged) | `test/unit/site-brand.test.ts` | U |
| catalogue-site | Banner on the home; Link with an icon; Icon with broken settings; Header mark with a custom title; Two links, Broken settings, no links, Hostile link text, Home text and Empty catalogue (unchanged) | `test/integration/site.test.ts` | I |
| catalogue-site | Home in full and staff and Home without skills (unchanged) | `test/integration/site-skills.test.ts` | I |
| catalogue-site | The icon reaches the page data (`siteSettings()` keeps `icon`) | `test/integration/site.test.ts` ("Link with an icon" reads the built page, which only gets `icon` through `siteSettings()`) | I |
| catalogue-site | Banner keeps its ratio; Link icon follows the theme and Mark follows the theme, each by system preference and by the theme switch; map canvas and legend symbol still block-level in both themes | `test/browser/site.spec.ts` | B |
| package | The packed files hold `site/public/home-banner.svg`, `brand-mark-dark.svg` and `link-icons/`, and nothing from `scripts/` (design Risks) | `test/integration/package.test.ts` ("Packed files") | I |
| skills-site | Description with HTML (allow-list of design §6); Hostile script text and Bidirectional override (unchanged) | `test/integration/site-skills.test.ts` | I |

## 0. Evidence for gate 1

- [x] 0.1 Prototype outside the branch: the home of the Northwind example with the banner, link icons and the dark mark, at 1440 and 375 CSS pixels, in light and dark, in one contact sheet. Verify: sheet looked at; shown to the owner at gate 1.
- [x] 0.2 Gate 1: the owner approves the spec and the contact sheet (2026-10-23).

## 1. Dependency and art

- [x] 1.1 Pin `@brunosouzas/design-system` 0.3.0, exact, production; refresh `npm-shrinkwrap.json`. Verify: `npm ls @brunosouzas/design-system`.
- [x] 1.2 Tests first: "Banner file is the design system's banner", "Link icon files are the design system's", "Dark mark is the dark ledgerMark", "Site art is inert", "Icon names match the design system". Verify: they fail.
- [x] 1.3 `scripts/home-banner.json` and `scripts/site-art.mjs` (design §1, §2); run it; `favicon.svg` unchanged. Verify: `npm test`, including the package test; `git diff --stat site/public/favicon.svg` empty.

## 2. Settings

- [x] 2.1 Tests first: "Link icon", "Unknown link icon" (with `../favicon`). Verify: they fail.
- [x] 2.2 `src/schema.ts`: optional `icon` on a home link; `src/site/data.ts`: `HomeLink.icon`, copied by `siteSettings()`. Verify: `npm test`.

## 3. Site

- [x] 3.1 Tests first: "Banner on the home", "Link with an icon", "Icon with broken settings", "Header mark with a custom title" (two marks), "Banner keeps its ratio", "Link icon follows the theme", "Mark follows the theme"; update "Site title", "Default title", "Default title (Skills pages)" and "Description with HTML" (design "Test changes"). Verify: the new ones fail.
- [x] 3.2 `index.astro` (banner art, link icons), `Header.astro` (two marks), `pages.css` (banner art, icon size), `base.css` (`display: revert`) (design §3 to §6). Verify: `npm run build && npm test`, `npm run test:browser`.

## 4. Example, images and docs

- [x] 4.1 The example stays unchanged (design §7, changed during implementation); the README screenshot uses a throwaway copy with fictitious links. Verify: the example tests pass.
- [x] 4.2 Build the example, take the home and a page with the header in light and dark at 1440 and 375 pixels, look at each, regenerate the README images that changed, and show the owner before the pull request is ready. Verify: images opened and checked.
- [x] 4.3 `docs/catalogue-format.md`, `docs/site.md`, `docs/roadmap.md`, `README.md`. Verify: `test/integration/docs.test.ts`, `openspec validate --all --strict --no-interactive`, `git diff --check`.
