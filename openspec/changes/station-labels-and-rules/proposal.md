## Why

The owner's real skills map (AB#129, the kit's `stackledger-skills.yaml`) showed two gaps in how a station is drawn:

- Long names are cut: `openspec-apply-change` shows as `openspec-apply-ch…` and `openspec-archive-change` as `openspec-archive-…`. A name with no space longer than 18 code points is always cut, even when a second row is free. Every name must stay whole on the map (AB#135).
- A skills map does not say which skills carry rules. The owner wants the number of rules of a skill or playbook on its station, as a counted sticker explained in the legend (AB#136). Rules are not stations: they are not items of the set, and a one-stop line is not drawn.

Both change the station's drawing, so they are one change (owner decision, 2026-10-23).

## What Changes

- **Label text, both maps.** A label has as many rows as its text needs, each at most 18 code points, wrapped at spaces. A word longer than a row starts a new row and breaks after its last `-`, `_`, `.` or `/` that keeps the row within 18 code points, or after 18 code points when it has none, as often as needed; its last piece continues the row like a word. Nothing is cut and no `…` is added. A label that fits in two rows today keeps the same rows, so a map with no cut label is byte-identical to 0.3.0.
- **Rule count, skills map only.** A skill or playbook station whose item defines at least one rule carries a rule-count sticker on its upper right, holding the number of its rules in the set, the one the `/skills/` list shows (`99+` above 99). The owner asked for a small circle: one digit is a circle, and the circle widens to a pill for `10` to `99+` so the number fits. It is drawn like a licence marker (outline, shadow, the dark theme's rim) and is a station marker for placement: labels, terminal badges and zone titles avoid it, and the frame contains it. Agents, items with no rules and software maps have none.
- **Legend of a skills map:** the lines, then the symbols interchange, number of rules and suggested position. The site's map page shows the same symbols under the map, as it already does for the SVG legend's symbols.

Out of scope: the line strip and neighbourhood diagrams of the site pages, and the boxes of the relation diagram (they cut long titles by width, and none of the cards asks for them); a per-rule station or line; the rule count on the software map, the relation diagrams or the station's `title` text; the site title and home (AB#137) and map backgrounds (AB#134).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metro-map`: "Label text" (rows without a cut), "Label placement" (rule-count stickers are obstacles), "Skills map drawing" (legend symbols) and "Software map unchanged" (a label 0.2.0 cut now wraps) change; three requirements are added: "Label word breaks", "Rule count is an obstacle" and "Rule count on skills stations".

## Impact

- `src/map/labels.ts` (`wrapLabel`), `src/map/model.ts` (`MapStation.rules`), `src/map/layout.ts` (rule-count box, obstacle, legend symbols), `src/map/svg.ts` (sticker and legend symbol), `src/skills/metro.ts` (rule count per station).
- Software maps: no change in geometry or SVG unless a label was cut before; the 0.2.0 map fixtures stay byte-identical.
- Skills maps: new stickers and one more legend symbol; the browser tests and screenshots of `/skill-map/` change.

## Implicit requirements

- Errors and invalid input: n/a. Labels come from text already cleaned (control and format characters removed), and rule counts from rules already read; nothing new can fail.
- Limits: no row limit; a 60-code-point `metadata.title` can take 6 rows (six 9-letter words), a 64-code-point skill name with no space 4. The count shows `99+` above 99 so the sticker stays small. The timing test of the map keeps its limit.
- Repetition and idempotency: the same input gives byte-identical SVG (Determinism, unchanged).
- Concurrency: n/a, pure functions.
- Security: the count is a number written by the renderer; the label text stays escaped as today. No new element or attribute names.
- Logs and observability: n/a, rendering prints nothing.

## Documentation

`docs/map.md` (label wrapping), `docs/skills.md` (the skills map's rule count and legend), `docs/roadmap.md` (item 4a), the README screenshot of the skills map if there is one; vault notes `roadmap.md` and `changelog.md` of the stackledger project after the merge.
