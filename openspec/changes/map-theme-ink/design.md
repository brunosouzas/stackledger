## Context

The reference style is the home art and body diagrams of brunosouzas.com: ink `#0A1033` outlines of stroke 4, a solid ink copy of each shape shifted down and right as its shadow, pipes drawn as an ink stroke 8 units wider than the coloured stroke inside, a tinted panel `#EEF2FF` (rings `#E0E7FB`) or navy `#14215A` (rings `#1C2D74`), and on dark backgrounds an indigo `#4C5CB8` shadow with a light rim `#EEF1FF`. The map engine already has Theme hooks for casing and shadow, both off.

## Decisions

### 1. Replace the look of `light` and `dark`, not add a third theme

Options: (a) a third theme `ink` beside `light` and `dark`; (b) replace the look of both. The owner chose (b): one look for v1, no new option to document and test, and the site keeps its two copies of every SVG.

### 2. Shadows inside each element's group, drawn as shifted geometry

Options: (a) an SVG `filter` or `transform="translate()"`, as the reference does; (b) a separate shadow layer under the lines; (c) a shifted copy of each shape, drawn first inside the element's own group. (a) needs new attributes and `filter` elements, which the allow-lists forbid. (b) separates a shadow from its station, so the site's highlight and zone filter would leave shadows undimmed. (c) keeps the allow-lists and the data attributes as they are; a marker's shadow lies over the line next to it, as the reference's blocks lie over its pipes.

### 3. Scale to the map

The map is drawn at about a third of the reference's scale (line 7 against pipe 22), so: casing 5 units wider than the line, outline 2.5, shadow offset 2.5. The neighbourhood diagram, drawn larger, scales outline and shadow by 1.6 (outline 4, as in the reference); the strip uses the map's values. Ticks and renewal rings have no shadow: on the first PNG review a tick's shadow read as a detached dark block and a ring's shadow muddied the station under it.

### 4. Layout counts the ink

The ink outline and the shadow make markers and badges larger. `layoutMap(model, lineWidth, ink)` takes the ink extents (`inkOf(theme)`): segments are as wide as their casing, and marker, licence and badge boxes grow by half the outline and by the shadow offset before labels and badges are placed. Both themes have the same extents, so one layout still serves both, and the stored station positions are untouched.

### 5. Theme data only

New Theme fields: `outlineWidth`, `rim` (`enabled`, `color`, `width`) and `accent` (the centre box of the neighbourhood diagram). The renderers read them and never branch on a theme name. The font stack is Lato first; the site serves Lato 400, 700 and 900 from `@fontsource/lato`, and a standalone SVG falls back to the system fonts after Lato.

### 6. Rings left out

The reference's concentric rings are clipped to their panel with a `clipPath`, which is not on the allow-list. The grid lines of the map frame take the ring colour instead.
