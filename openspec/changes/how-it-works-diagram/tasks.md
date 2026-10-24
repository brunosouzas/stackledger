## Scenario to test map

Level U: unit (vitest, `npm test`). Every scenario has one test named after it in `test/unit/how-it-works.test.ts`. "New" tests must fail before the code.

| Spec | Scenario | Test | Level | Kind |
| --- | --- | --- | --- | --- |
| How it works diagram | Diagram file is the design system's drawing | `Diagram file is the design system's drawing` | U | new |
| How it works diagram | Stale diagram file | `Stale diagram file` | U | new |
| How it works diagram | Mermaid content kept | `Mermaid content kept` | U | new |
| How it works diagram | Colour literal refused | `Colour literal refused` | U | new |
| How it works diagram | Diagram is inert | `Diagram is inert` | U | new (passes on today's file; kept as a guard) |
| How it works generation | Same bytes on every run | `Same bytes on every run` | U | new |
| How it works generation | No hand-drawn generator | `No hand-drawn generator` | U | new |
| How it works generation | Invalid spec writes nothing | `Invalid spec writes nothing` (imports the check from `scripts/art-spec.mjs`) | U | new |
| How it works generation | Diagram sources not published | `Diagram sources not published` | U | new (passes today; kept as a guard) |
| regression | the site art tests of `test/unit/site-brand.test.ts` ("Banner file is the design system's banner" and the rest) | as today | U | kept |

## 0. Evidence

- [x] 0.1 Before/after contact sheet, on a light and a dark page, from a scratch spec drawn with the pinned 0.5.3 (in the pull request).
- [ ] 0.2 Gate 1: the owner approves the spec and the contact sheet.

## 1. Tests first

- [ ] 1.1 Write `test/unit/how-it-works.test.ts` with the tests of the table. Verify: `npx vitest run test/unit/how-it-works.test.ts` shows every "new" test failing for the missing spec, check or file, except "Diagram is inert" and "Diagram sources not published".

## 2. Code

- [ ] 2.1 `scripts/art-spec.mjs`: `checkedSpec(name)` reads a spec from `scripts/`, runs `validateCoverSpec` and throws naming the file and each problem's path; `scripts/site-art.mjs` uses it for the banner and the diagram. Verify: "Invalid spec writes nothing" and the banner test pass.
- [ ] 2.2 `scripts/how-it-works.json` from the approved scratch spec; `scripts/site-art.mjs` writes `docs/images/how-it-works.svg`. Run `node scripts/site-art.mjs` and commit the file. Verify: every test of the table passes; `git diff --stat site/public` is empty (the site art is unchanged).
- [ ] 2.3 Delete `scripts/how-it-works-diagram.py`; update `docs/how-it-works.md` (generation line) and the comment of `scripts/site-art.mjs`. Verify: "No hand-drawn generator" passes; `rsvg-convert -w 800 docs/images/how-it-works.svg` matches the approved render.

## 3. Close

- [ ] 3.1 `npm test` (in the background) green; Codex code review; archive the change.
