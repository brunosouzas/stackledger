## Why

The diagram of `docs/how-it-works.md` (also shown by the README) is drawn by `scripts/how-it-works-diagram.py`: Python that writes SVG by hand with eleven colours copied as hex literals. Every other image of stackledger (the map, the diagrams, the site art) comes from `@brunosouzas/design-system`, so this one drifts each time the design system changes, and its colours are outside the tokens. The design system 0.5.3, already pinned, has every piece the diagram needs. Card AB#181.

## What Changes

- **The diagram is redrawn from its source, the Mermaid block of `docs/how-it-works.md`.** `scripts/how-it-works.json` is a design system body diagram (`"format": "diagram"`) with the block's three subgraphs as tagged containers, its nine nodes as boxes with their lines, its eight edges as arrows (the `drift --scaffold` one dashed) and its four edge labels. The layout is new, top to bottom like the block; nothing is carried over from the hand-drawn image.
- **Colours by meaning**, as the design system gives them (its ADR 0003): the reader and the person editing `color.caller`, the two checkpoints (pull request, Cloudflare Access) `color.transitional`, the push to `main` that publishes `color.healthy`, Cloudflare Pages that serves the site `color.backend`, the rest `color.white`. The npm red, Cloudflare orange and grey of the old image go.
- **The two mode pills go.** They were not in the Mermaid block; the table under the diagram already explains the personal and corporate modes.
- **Generated with the site art.** `scripts/site-art.mjs`, which already writes the site's art from the package, also writes `docs/images/how-it-works.svg`. `scripts/how-it-works-diagram.py` is deleted.
- **Tests.** The committed SVG must equal what the pinned package draws from the spec, and the spec must hold every node, line, subgraph, edge and edge label of the Mermaid block.

Out of scope:

- any change to the design system;
- a dark version (the `diagram` format of 0.5.3 draws on the light panel only; GitHub shows the image as it is on both themes, as today);
- a Portuguese version, and the text and Mermaid block of `docs/how-it-works.md`;
- a release: `scripts/` and `docs/` are not in the package, and the README on npm loads the image from the `main` branch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue-pipeline`: "How it works diagram", "How it works diagram content" and "How it works generation" added (the page documents the path the template publishes).

## Implicit requirements

- Errors and invalid input: a spec the package refuses (a colour literal, an unknown parameter) fails the test with the package's problem list, and `scripts/site-art.mjs` fails before writing any file ("Invalid spec writes nothing").
- Limits: n/a; one fixed diagram.
- Repetition and idempotency: `coverTree` is deterministic; the committed-file test proves the output.
- Concurrency: n/a.
- Security: the SVG is inert, checked like the site art ("How it works diagram").
- Logs and observability: n/a; the script prints one line, as today.

## Documentation

`docs/how-it-works.md` (the generation line), the comment at the top of `scripts/site-art.mjs`. The README keeps its image link (same path). Vault: the project's `architecture.md`, `roadmap.md` and `changelog.md`.
