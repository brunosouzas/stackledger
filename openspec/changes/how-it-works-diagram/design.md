## Context

The diagram has one source, its spec, and one output, `docs/images/how-it-works.svg`. Neither ships in the npm package (`files` lists `dist`, `site`, `skills`, `examples` and the shrinkwrap).

## Decision: where the spec lives and what draws it

Chosen: `scripts/how-it-works.json`, drawn by `scripts/site-art.mjs` with the package's `coverTree`, next to `scripts/home-banner.json`.

- After a design system bump, one command (`node scripts/site-art.mjs`) rewrites all the art the package draws, and one test file per kind of art says which file is stale.
- Rejected: the package's command, `npx brunosouzas-cover scripts/how-it-works.json --out docs/images/how-it-works.svg`, with no script. It needs no code, but a bump would then need two commands, and the banner already set the pattern of a spec plus `site-art.mjs`.
- Rejected: the spec in `docs/`. Its folder is read by people; the specs of the art the package draws already sit in `scripts/`.

## Element map

| Today (Python) | Design system 0.5.3 |
| --- | --- |
| a pale panel with rings, as copied literals | `"format": "diagram"` (`color.panel`, `color.ring`), rings centred on the diagram |
| 3 dashed subgraph frames with a bold name | 3 `taggedContainer` (default face and tab) |
| 9 blocks, ink outline, 8 px shadow | 9 `diagramBox`, name in `text`, detail in `subtitle` |
| 8 arrows (1 dashed) with a hand-made marker | 8 `messageArrow`: 1 `dashed: true` straight, 2 straight, 5 through `controls` |
| 4 monospace arrow labels | 4 `edgeLabel`, the words in backticks |
| 2 mode pills with a hand shadow | 2 `diagramBox` with `shape: "pill"` |
| blue, orange, green, yellow and white blocks, as copied literals | `color.caller` `color.blocked` `color.healthy` `color.transitional` `color.white` (the same values) |
| reader in dark grey, npm in npm red, Cloudflare Pages in Cloudflare orange | `color.caller` (a reader calls the site), `color.white` (a neutral outside system, like the repository), `color.backend` (the system that serves the site); ADR 0003 of the design system gives each hue one meaning, so the orange of "blocked" and the red of "failure" are not used for brands |

Two boxes had two detail lines and `diagramBox` has a one-line subtitle: "Pull request" keeps "never deploys" as a second bold line above the subtitle "gitleaks, validate, build"; "Cloudflare Pages" joins its two details with " · ". The npm box shows "@brunosouzas/stackledger" on one line.

## Test changes

None to existing tests. The new test file is `test/unit/how-it-works.test.ts`.
