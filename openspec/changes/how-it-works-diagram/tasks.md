## Scenario to test map

Level U: unit (vitest, `npm test`). Every scenario has one test named after it in `test/unit/how-it-works.test.ts`. Kind "fails first": fails before the code, for the reason given. Kind "guard": passes from the start (the spec is committed with the change, or the behaviour already holds) and protects the result.

| Spec | Scenario | Kind |
| --- | --- | --- |
| How it works diagram | Diagram file is the design system's drawing | fails first (the file is the Python drawing) |
| How it works diagram | Stale diagram file | guard |
| How it works diagram | Colour literal refused | guard |
| How it works diagram | Diagram is inert | guard |
| How it works diagram content | Mermaid content kept | guard |
| How it works diagram content | Lost line or edge | guard (expects a problem naming the mutated node, edge or box, so a checker that finds nothing fails) |
| How it works diagram content | Rewired edge | guard (added after code review round 1; same kind of check) |
| How it works diagram content | Unknown Mermaid line | guard (added after code review round 1) |
| How it works generation | No hand-drawn generator | fails first (the `.py` is there) |
| How it works generation | Diagram sources not published | guard |
| regression | the tests of `test/unit/site-brand.test.ts` | kept |

## 0. Evidence

- [x] 0.1 `scripts/how-it-works.json`, redrawn from the Mermaid block, committed with the change; its drawing with the pinned 0.5.3 and a before/after contact sheet shown to the owner.
- [x] 0.2 Gate 1: the owner asked for the diagram to be redrawn from the page with the design system and approved the plan (2026-10-25).

## 1. Tests first

- [x] 1.1 Write `test/unit/how-it-works.test.ts`. Verify: `npx vitest run test/unit/how-it-works.test.ts` shows the two "fails first" tests failing for their reason and every guard passing.

## 2. Code

- [x] 2.1 `scripts/site-art.mjs` checks both specs, then writes the site art and `docs/images/how-it-works.svg`. Run it and commit the SVG. Verify: the tests pass; `git status site/public` shows no change.
- [x] 2.2 Delete `scripts/how-it-works-diagram.py`; update the generation line of `docs/how-it-works.md` and the script's comment. Verify: "No hand-drawn generator" passes.

## 3. Close

- [ ] 3.1 `npm test` (in the background) green; Codex code review; archive the change.
