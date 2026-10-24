## Scenario to test map

Level U: unit (vitest, `npm test`). Every scenario has one test named after it in `test/unit/how-it-works.test.ts`. Kind "fails first": the test must fail before the code, each for its own missing behaviour (the import of `scripts/art.mjs` is dynamic, inside the two tests that need it, so its absence fails only them). Kind "guard": the test passes from the start, because the candidate spec is already committed or the behaviour already holds; it protects the result.

| Spec | Scenario | Test | Level | Kind |
| --- | --- | --- | --- | --- |
| How it works diagram | Diagram file is the design system's drawing | `Diagram file is the design system's drawing` | U | fails first (the file is the Python drawing) |
| How it works diagram | Stale diagram file | `Stale diagram file` | U | guard (checks the comparison itself) |
| How it works diagram | Colour literal refused | `Colour literal refused` | U | guard |
| How it works diagram | Diagram is inert | `Diagram is inert` | U | guard |
| How it works diagram content | Mermaid content kept | `Mermaid content kept` | U | guard |
| How it works diagram content | Reversed edge | `Reversed edge` | U | guard |
| How it works diagram content | Missing edge or node line | `Missing edge or node line` | U | guard |
| How it works diagram content | Box outside its subgraph | `Box outside its subgraph` | U | guard |
| How it works generation | Art written to its places | `Art written to its places` | U | fails first (no `scripts/art.mjs`) |
| How it works generation | Invalid spec writes nothing | `Invalid spec writes nothing` | U | fails first (no `scripts/art.mjs`) |
| How it works generation | No hand-drawn generator | `No hand-drawn generator` | U | fails first (the `.py` is there) |
| How it works generation | Diagram sources not published | `Diagram sources not published` | U | guard |
| regression | the tests of `test/unit/site-brand.test.ts` ("Banner file is the design system's banner", the link icons, "Site art is inert") | as today | U | kept |

The comparison with the Mermaid block is one function in the test file (`mermaidProblems(mermaid, spec)`), which returns the list of problems; the four content scenarios call it on the real spec and on mutated copies.

## 0. Evidence

- [x] 0.1 Candidate spec `scripts/how-it-works.json`, committed with the change; its drawing with the pinned 0.5.3 and the before/after contact sheet (light and dark page) shown to the owner at gate 1. The after image is the drawing of that file; the pull request shows it from the branch once task 2.2 commits it.
- [ ] 0.2 Gate 1: the owner approves the spec and the drawing (the approved commit is named in a pull request comment).

## 1. Tests first

- [ ] 1.1 Write `test/unit/how-it-works.test.ts` with the tests of the table. Verify: `npx vitest run test/unit/how-it-works.test.ts` shows the four "fails first" tests failing, each for the reason in the table, and every "guard" passing; the mutation tests expect a problem naming the mutated edge or node, so a checker that finds nothing fails them.

## 2. Code

- [ ] 2.1 `scripts/art.mjs` exports `writeArt(root, specs)`: it validates the banner and diagram specs, computes every file (banner, favicon, dark mark, link icons, the diagram), throws naming the spec file and each problem's path, and writes the files under `root` only when all are computed. `scripts/site-art.mjs` reads the two specs and calls it with the repository root. Verify: "Art written to its places", "Invalid spec writes nothing" and the `site-brand` tests pass.
- [ ] 2.2 Run `node scripts/site-art.mjs` and commit `docs/images/how-it-works.svg`. Verify: every test of the table passes; `git diff --stat site/public` is empty (the site art is unchanged).
- [ ] 2.3 Delete `scripts/how-it-works-diagram.py`; update `docs/how-it-works.md` (generation line) and the comment of `scripts/site-art.mjs`. Verify: "No hand-drawn generator" passes; `rsvg-convert -w 800 docs/images/how-it-works.svg` matches the render approved at gate 1.

## 3. Close

- [ ] 3.1 `npm test` (in the background) green; Codex code review; archive the change.
