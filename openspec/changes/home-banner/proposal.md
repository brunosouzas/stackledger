## Why

The site already wears the identity of brunosouzas.com (AB#164), but its home still has a plain tinted banner, its home links are bare text, and the header mark, a navy square, almost disappears on the dark header. `@brunosouzas/design-system` 0.3.0 now has what was missing: the banner format (1200 × 420, rounded corners, rings out to the far corner; AB#156), `lineBadge` without a letter, `linkIcon` (`github`, `website`, `linkedin`, `email`, in light and dark) and `ledgerMark` on the dark surface (AB#168).

## What Changes

- **Home banner.** Below the site title and text, which stay HTML, the home shows the banner of the design system's banner format: a short metro on the navy background, drawn with `pipe`, `stationMarker` and `lineBadge` as in the spike B of AB#156, without the `ledgerMark` at its end and with badges that carry no letter (a 12-unit letter is unreadable once the 1200-unit image shrinks to a phone). It is the same image on every site and in both themes, a decorative `img` from the site's own folder.
- **Link icons.** Each home link in `spec.site.home.links` MAY set `icon` to `github`, `website`, `linkedin` or `email`; the link then shows that `linkIcon` before its title, in the light or dark version that matches the theme. Any other value is an error. The owner's catalogue sets the repository and brunosouzas.com this way; the product hard-codes no external link, so the site-security rule stays as it is.
- **Dark header mark.** In the dark theme the header shows `ledgerMark` drawn for the dark surface (with its light rim); the light theme and the favicon keep today's mark.
- **Generated art.** The banner, the dark mark and the eight link icons are static SVG files in `site/public/`, written by a script from the design system's pieces and checked by tests against those pieces, as `favicon.svg` is today.
- **Dependency.** `@brunosouzas/design-system` 0.3.0, exact, production.

Decisions taken with the owner (2026-10-23): the banner is fixed, not a setting; the repository and brunosouzas.com links live in the owner's `Settings`, not in the product.

Out of scope: the 0.3.0 pieces on the map (renewal ring, halo, licence marker, zones, interface icons; next change), round bends (AB#166), icons on the home cards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue`: "Home settings" (optional `icon` on a link).
- `catalogue-site`: "Home page" (banner image), "Home links" (icon), "Brand mark" (dark header mark, and the site's `img` elements).
- `skills-site`: "Text from skill files" ("Description with HTML" counts the site's own images).

## Impact

- `package.json`, `npm-shrinkwrap.json`: design system 0.3.0.
- `src/schema.ts` (link `icon`), `src/site/data.ts` (`HomeLink.icon`), `site/src/pages/index.astro`, `site/src/components/Header.astro`, `site/src/styles/pages.css`, `site/src/styles/base.css` (themed images), a new `scripts/site-art.mjs`, new files in `site/public/` (`home-banner.svg`, `brand-mark-dark.svg`, `link-icons/<name>-light.svg` and `-dark.svg`).
- `examples/northwind/stackledger.yaml`: fictitious home text and links with icons, for the screenshots.
- Tests: `test/unit/site-brand.test.ts`, `test/integration/site.test.ts`, `test/integration/site-skills.test.ts`, `test/browser/site.spec.ts`, the catalogue schema tests. README images `site-home.png` and any other that shows the header.

## Implicit requirements

- **Errors and invalid input:** an unknown `icon` is an error on its path, like any unknown field; with an error in `Settings`, the home shows no links, as today.
- **Limits:** none new (20 links at most, as today).
- **Repetition and idempotency:** the script writes the same bytes for the same package version; the tests fail when a file differs from its piece.
- **Concurrency:** n/a.
- **Security:** no new external URL, script or style; every new image is an SVG file from the site's own folder (`img-src 'self'`), decorative, with `alt=""`. The SVGs hold no script, no event attribute and no external reference.
- **Logs and observability:** n/a.

## Documentation

- `docs/catalogue-format.md` (`icon`), `docs/site.md` (banner, icons, dark mark), `docs/roadmap.md`, `README.md` (screenshots).
- Vault, after the merge: the project's `roadmap.md` and `changelog.md`.
