# Approved pieces (AB#303)

The owner chose these from renders in the AB#303 round (Q5: concept C; Q5b: the "Folha" mark).

- `home-banner.json`: the banner spec to commit as `scripts/home-banner.json`. Its blue line names `brand.light.stackledgerAccent`, which exists from design system 0.8.1.
- `home-banner-preview.svg`: the approved preview, drawn by the 0.8.0 CLI with the accent and the Folha mark swapped in by hand (`marks.py`). The 0.8.1 build of `home-banner.json` is compared with it once, through `<img>` in Chrome (task evidence, not a test).
- `ledger-mark-*-preview.svg`: the Folha mark in light and dark, 32 units.
- `gen_banners.py`, `marks.py`: the scratch generators that drew them (concepts A, B and C; C was chosen).
