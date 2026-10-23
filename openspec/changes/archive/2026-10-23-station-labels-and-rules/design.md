## Context

Labels use fixed character metrics and code-point rows (`src/map/labels.ts`), so tests check geometry without fonts. The skills map reuses the software map's engine; its stations never carry a licence marker.

## Decisions

- **Rows stay 18 code points; only the cut goes.** Measuring rows by width (`textWidth`) would move labels on every software map. Keeping the code-point row means every label that fits in two rows today keeps its rows, which the 0.2.0 fixtures prove byte for byte. Alternative rejected: a width-based block, which is closer to CSS but changes maps that have no problem.
- **Break long words after `-`, `_`, `.` or `/`.** Skill names are kebab-case (`openspec-archive-change` → `openspec-archive-` / `change`), as CSS breaks after a hyphen. A hard break at 18 code points is the fallback for a word with none.
- **The rule count takes the licence marker's place**, upper right of the marker: a circle for one digit (the owner's "small circle"), widening to a pill so `12` and `99+` fit. Its box joins the station markers, so labels, terminal badges, zone titles and the frame treat it as they treat a licence marker; no new placement logic.

## Risks

- Labels with three or four rows are taller, so a crowded map may find fewer free candidates; the existing least-overlap fallback applies, and the kit's real map is checked by eye in task 3.
