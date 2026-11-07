#!/usr/bin/env python3
"""ledgerMark variants for banner C (AB#303, Bruno's Q5 note: the big ink square). Scratch PREVIEW:
the variants are drawn by swapping the mark's square in the SVG the 0.8.0 CLI/piece wrote; the real
change would be the ledgerMark piece in the design system 0.8.1.
Writes marks/<variant>-<surface>.svg (32 units) and banners/concept-c-<variant>.svg."""
import pathlib, re

ROOT = pathlib.Path(__file__).parent
M = ROOT / "marks"
M.mkdir(exist_ok=True)
INK, WHITE, MUTED_D, BLUE, BLUE_D, ORANGE = "#121212", "#FFFFFF", "#ADA79D", "#3B5BDB", "#7D8CFF", "#E04E17"

LINE = f'<path d="M7 23 L14 16 L25 16" fill="none" stroke="{ORANGE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
STATIONS = (f'<circle cx="14" cy="16" r="4" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="25" cy="16" r="2.6" fill="{WHITE}" stroke="{INK}" stroke-width="1.6"/>')


def square(variant, surface):
    dark = surface == "dark"
    if variant == "hoje":
        if dark:
            return f'<rect x="0" y="0" width="32" height="32" rx="7" fill="{MUTED_D}" stroke="none"/><rect x="2" y="2" width="28" height="28" rx="5" fill="{INK}" stroke="none"/>'
        return f'<rect x="0" y="0" width="32" height="32" rx="7" fill="{INK}" stroke="none"/>'
    if variant == "folha":  # white page, one outline: ink on light, the surface's muted grey on dark (ADR 0009)
        return f'<rect x="0.625" y="0.625" width="30.75" height="30.75" rx="6.6" fill="{WHITE}" stroke="{MUTED_D if dark else INK}" stroke-width="1.25"/>'
    if variant == "azul":  # the product's accent as the field
        return f'<rect x="0" y="0" width="32" height="32" rx="7" fill="{BLUE_D if dark else BLUE}" stroke="none"/>'
    if variant == "borda":  # ink square with a band in the product's accent
        return f'<rect x="0" y="0" width="32" height="32" rx="7" fill="{BLUE_D if dark else BLUE}" stroke="none"/><rect x="2.5" y="2.5" width="27" height="27" rx="4.5" fill="{INK}" stroke="none"/>'
    raise ValueError(variant)


def inner(variant, surface):
    return square(variant, surface) + LINE + STATIONS


VARIANTS = ["hoje", "folha", "azul", "borda"]
for v in VARIANTS:
    for s in ("light", "dark"):
        (M / f"{v}-{s}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">{inner(v, s)}</svg>\n')

# Banner C: replace the drawn mark group (translate(90 120) scale(5.625)) with each variant.
src = (ROOT / "banners/concept-c-blue.svg").read_text()
m = re.search(r'(<g transform="translate\(90 120\) scale\(5\.625\)">)(.*?)(</g>)', src, re.S)
assert m, "mark group not found"
for v in VARIANTS:
    out = src[:m.start(2)] + inner(v, "light") + src[m.end(2):]
    (ROOT / f"banners/concept-c-{v}.svg").write_text(out)
print("ok")
