# stackledger on the design system 0.8.1: identity v2 (card 303)

## Problem

stackledger is pinned to `@brunosouzas/design-system` 0.6.0, whose look (navy ink, hard offset shadows, Heebo, Signika and Lato) the brand left behind in 0.7.0 and 0.8.0. A plain bump does not build: `src/map/themes.ts` reads `color.healthy`, `color.blocked` and `color.caller`, removed in 0.7.0; the home banner spec uses the removed `navy` background and old `color.*` paths; the How it works diagram uses old `color.*` paths. Rendered on the bump alone (AB#303 round), the pages change colour through `--ds-site-*`. The fonts, though, fall back to system faces, because the package names Source and the site ships Heebo, Signika and Lato. The ink frame vanishes on the dark page, and the accent link hover is 1.4:1 against the new text colour.

stackledger has its own identity on top of the design system (brand strategy E7): it gains its name, a wordmark in the family's type, one accent and its character (Sinal), and inherits type, neutrals, semantic colours, the stroke rule and the notation. The owner chose every visual answer below from renders (AB#303, Q1 to Q7, Q2b, Q2c, Q5b).

## What changes

- **Package:** `@brunosouzas/design-system` 0.8.1 (the release that adds `brand.*.stackledgerAccent`, the v2 backdrop and the "Folha" `ledgerMark`; brunosouzas-design-system change `stackledger-product-layer`).
- **Fonts, by the same rule as brunosouzas.com (Q2, Q2b, Q2c):** Source Sans 3 for text, labels, the map and the diagrams; Source Serif 4 for headings and the wordmark; Source Code Pro for code. They are delivered by Astro's Fonts API, as on the site, with its local provider reading the files of `@fontsource/source-sans-3`, `source-serif-4` and `source-code-pro`, so the build makes no network call. Heebo, Signika and Lato and their packages go away. The map's and diagrams' font stack is the package's `font.sans`; on the site's pages a CSS rule points the inline drawings at the Fonts API's family.
- **Security rules unchanged (Q2b):** the Fonts API writes its CSS in inline `<style>` elements; the build moves that CSS, and only that, into one stylesheet file of the site (`_astro/fonts.css`) and links it. The Content Security Policy, `_headers`, the proxy recipes and "No inline code" stay as they are (the hash-based policy was designed, reviewed and dropped: design §1).
- **Colours (Q1, Q3):** the accent becomes the design system's `--ds-brand-<theme>-stackledger-accent` (`#3B5BDB` / `#7D8CFF`); `spec.site.colors.accent` still overrides it in light. The ink frame keeps its outline, with no shadow (the 0.7.0 tokens are 0), and on the dark page the outline is `surface.dark.muted`. Shadow and rim CSS that the tokens set to 0 goes away. The map's header band on the dark surface is `surface.dark.panel` instead of ink. The licence and renewal colours read `color.state.healthy` and `color.state.blocked`; the neighbourhood's centre reads `color.state.caller`.
- **Wordmark and endorsement (Q4):** the header's site title is set in Source Serif 4 italic, 700. The footer adds the parent brand's endorsement: the design system's `symbol` (light and dark files) and "by Bruno Souza", after the stackledger version. The README adds the same line: the symbol as a `<picture>` of `docs/images/symbol-light.svg` and `symbol-dark.svg` (by `prefers-color-scheme`), then "by Bruno Souza".
- **Home banner (Q5, Q5b):** concept C, "From the ledger to the map": stackledger's mark (the "Folha" `ledgerMark`) on the left; three of its rows leave it as orange, blue (`brand.light.stackledgerAccent`) and ink metro lines that cross at an interchange and run to Sinal, who waits at the end of the line. The banner sits on `neutral`, has no words and does not move. It is the same in both themes and on every site, like today's.
- **Other generated art:** `favicon.svg` and `brand-mark-dark.svg` (Folha), the link icons (0.7.0 grammar), the How it works diagram with `color.state.*` paths and its Source faces embedded with the package's `embedFonts` (it is shown as a standalone image on GitHub), and the README's map images and screenshots, rebuilt.
- **Docs:** README, `docs/site.md`, `docs/map.md`, `docs/roadmap.md`.

## Out of scope

- Embedding fonts in the SVG that `stackledger map` writes to stdout (it keeps naming the faces; a reader without them sees a system face, as with Lato today). A card of its own if wanted.
- Motion in the banner (the home is a catalogue page; the context does not ask for it).
- The default share image and og (`AB#307`, `AB#295`) and anything on brunosouzas.com.
- Layout changes to any page; the map engine's geometry.
- A release of stackledger (Bruno's, after the merge).

## Implicit requirements

- **Errors and invalid input:** the build fails, before publication, on a `<style>` that is not the Fonts API's font CSS, on font CSS that differs between pages or is missing from one, and, as today, on any inline style or script left in a page. A missing font file fails the build naming it.
- **Limits:** font bytes per page are reported in the PR evidence (measured: 73 KB on the home, up to about 103 KB on the map), no new limit.
- **Repetition and idempotency:** the pages and the font CSS are byte-identical across two builds of the same catalogue and version, from any staging folder ("Deterministic build"; root-relative font paths, design §1).
- **Concurrency:** n/a, unchanged build model.
- **Security:** the policy does not change and has no `unsafe-inline`; no request leaves the site (fonts from the site's own folder). A security review lens is used on the code review.
- **Logs and observability:** n/a, the build report is unchanged.

## Documentation

- Repository: README (screenshots, map images, endorsement, version notes), `docs/site.md`, `docs/map.md`, `docs/roadmap.md`, `AGENTS.md` "Implemented" line.
- Brain vault (after merge): `10-personal/projects/stackledger/` changelog and roadmap; the design system project's changelog and roadmap (AB#303 note), shown to Bruno before the commit.
