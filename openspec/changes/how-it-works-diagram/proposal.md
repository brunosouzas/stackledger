## Why

The diagram of `docs/how-it-works.md` (also shown by the README) is drawn by `scripts/how-it-works-diagram.py`: Python that writes SVG by hand with eleven colours copied as hex literals. Every other image of stackledger (the map, the diagrams, the site art) comes from `@brunosouzas/design-system`, so this one drifts each time the design system changes, and its colours are outside the tokens. The design system 0.5.3, already pinned, has every piece it needs: `taggedContainer`, `diagramBox`, `messageArrow` (with control points and the neutral dashed arrow), `edgeLabel`, and the body diagram format (`"format": "diagram"`). Card AB#181.

## What Changes

- **A diagram spec instead of a script.** `scripts/how-it-works.json` describes the diagram as a design system body diagram: three tagged containers, nine boxes, eight arrows, four arrow labels and the two mode pills. `scripts/site-art.mjs`, which already writes the site's art from the package, also writes `docs/images/how-it-works.svg` from it with `coverTree`, through one function (`scripts/art.mjs`) that checks every spec before it writes any file.
- **A test keeps the file honest.** Unit tests fail when the committed SVG differs from what the pinned package draws from the spec, when the spec has a problem, or when the spec loses a node, a node's line, a subgraph or an edge (or turns one round) of the Mermaid block in `docs/how-it-works.md`.
- **The Python script goes.** `scripts/how-it-works-diagram.py` is deleted; `docs/how-it-works.md` names the new command.
- **Visible change.** The look becomes the design system's body diagram: the containers get a name tab and a solid outline instead of a dashed frame, the hard shadow is 5 instead of 8 at the shown size, the boxes' detail lines are the pieces' subtitle (regular, not bold). The brand colours become existing tokens: the reader `color.caller` (was a dark grey), the npm registry `color.white` (was npm red), Cloudflare Pages `color.backend` (was Cloudflare orange). The image is 800×800 instead of 800×808. The owner sees a before/after contact sheet (light and dark page) at gate 1; the pull request shows both images.

Out of scope:

- any change to the design system (a missing piece is a request to its own repository);
- a dark version of the diagram (the `diagram` format of 0.5.3 draws on the light panel only; GitHub shows the image as it is on both themes, as today);
- a Portuguese version, the Mermaid block itself and the text of `docs/how-it-works.md`;
- a release: `scripts/` and `docs/` are not in the package, and the README on npm loads the image from the `main` branch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalogue-pipeline`: "How it works diagram", "How it works diagram content" and "How it works generation" added (the page documents the path the template publishes).

## Implicit requirements

- Errors and invalid input: a spec the package refuses (a colour literal, an unknown parameter) fails the test with the package's problem list; `scripts/site-art.mjs` throws on it and writes no file at all ("How it works generation").
- Limits: n/a; one fixed diagram.
- Repetition and idempotency: `coverTree` is deterministic, so running the script twice writes the same bytes ("How it works generation").
- Concurrency: n/a.
- Security: the SVG is inert (no script, style, event or external reference), checked like the site art ("How it works diagram").
- Logs and observability: n/a; the script prints one line, as today.

## Documentation

`docs/how-it-works.md` (the generation line), `docs/roadmap.md` if it lists the port, the comment at the top of `scripts/site-art.mjs`. The README keeps its image link (same path). Vault: the project's `architecture.md`, `roadmap.md` and `changelog.md`.
