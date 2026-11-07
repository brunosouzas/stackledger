#!/usr/bin/env python3
"""Banner concepts for stackledger (AB#303), built by the design system 0.8.0 CLI. Scratch only.

Each concept is a function returning a `banner` spec. Colours are token paths, except the product
accent, which the package has no token for yet: it is passed as a data colour and labelled PREVIEW.
Run: gen_banners.py <accent-hex> -> writes banners/<concept>.json
"""
import json, pathlib, sys

OUT = pathlib.Path(__file__).parent / "banners"
OUT.mkdir(exist_ok=True)
ACCENT = "color.state.caller"  # stand-in token; render.sh swaps #8FB2FF for the previewed accent hex
ORANGE = "illustration.accent"
INK = 1.5  # inkScale for the map pieces at banner size


def st(cx, cy, r=15, **kw):
    return {"piece": "stationMarker", "cx": cx, "cy": cy, "r": r, "inkScale": INK, **kw}


def pipe(d, fill, width=20, casing=8):
    return {"piece": "pipe", "d": d, "fill": fill, "width": width, "casing": casing}


def base(cid, title, desc, pieces, rings=(860, 210)):
    spec = {"id": f"stackledger-banner-{cid}", "format": "banner", "title": title, "description": desc,
            "background": "neutral", "pieces": pieces}
    spec["rings"] = {"cx": rings[0], "cy": rings[1]}
    return spec


def concept_a():
    """A · Baldeação: the approved A7 sample at banner scale. Two lines meet at an interchange;
    Sinal, the product's character, stands in the V above it, inside a soft zone."""
    ix, iy = 600, 340
    p = [
        {"piece": "zone", "points": [[470, 120], [820, 110], [900, 250], [700, 330], [480, 280]], "fill": ORANGE},
        pipe(f"M300,70 L{ix},{iy}", ORANGE),
        pipe(f"M110,{iy} H{ix} L780,160 H1100", ACCENT),
        st(300, 70), st(450, 205), st(180, iy), st(390, iy), st(920, 160), st(1060, 160),
        st(ix, iy, r=22),
        {"piece": "sinal", "x": 592, "y": 262, "scale": 1.3},
    ]
    return base("a", "Two lines and their interchange",
                "Illustration on the cream page. An orange line comes down to an interchange where a blue line turns up and away to the right. Sinal, stackledger's signal post with a screen face, stands between the two lines above the interchange, in a soft orange zone.",
                p)


def concept_b():
    """B · O mapa do catálogo: today's banner in the v2 grammar, with the product's own vocabulary
    (zones, a renewal ring, licence marks, a suggested position). No character."""
    p = [
        {"piece": "zone", "points": [[140, 120], [520, 110], [560, 330], [150, 340]], "fill": "coverBackground.deliveryMint.ring"},
        {"piece": "zone", "points": [[680, 90], [1080, 100], [1070, 330], [700, 320]], "fill": ORANGE},
        pipe("M150,300 H470 Q520,300 545,255 L600,160 Q625,120 680,120 H1050", ORANGE),
        pipe("M150,210 H1050", ACCENT),
        pipe("M330,110 Q380,110 405,150 L470,260 Q495,300 545,300 H1050", "color.ink", width=14, casing=6),
        st(260, 300), st(260, 210), st(437, 210), st(572, 210), st(760, 120), st(760, 210), st(760, 300),
        st(920, 120, to=[920, 300]), st(920, 210, state="deprecated"),
        {"piece": "renewalRing", "cx": 760, "cy": 120, "r": 26, "inkScale": INK},
        {"piece": "suggestedHalo", "cx": 1010, "cy": 300, "r": 22},
    ]
    return base("b", "A small catalogue map",
                "Illustration on the cream page. Three metro lines, orange, blue and ink, cross two soft zones. White stations sit on the lines: one is an interchange, one is muted, one has a renewal ring, and a dashed halo marks a suggested position.",
                p, rings=(1000, 120))


def concept_c():
    """C · Do livro-razão ao mapa: the product's symbol (ledgerMark) at the left; three of its
    ledger rows leave it as metro lines and run to Sinal, who waits at the last station."""
    p = [
        {"piece": "ledgerMark", "x": 90, "y": 120, "size": 180},
        pipe("M280,160 H520 Q560,160 580,190 L640,280 Q660,310 700,310 H880", ORANGE),
        pipe("M280,210 H960", ACCENT),
        pipe("M280,260 H520 Q560,260 580,230 L640,140 Q660,110 700,110 H880", "color.ink", width=14, casing=6),
        st(380, 160), st(380, 210), st(380, 260), st(760, 110), st(760, 310), st(610, 210, r=20),
        st(880, 110), st(880, 310), st(960, 210, r=20),
        {"piece": "sinal", "x": 1040, "y": 300, "scale": 1.3},
    ]
    return base("c", "From the ledger to the map",
                "Illustration on the cream page. stackledger's mark, a ledger page, sits on the left; three of its rows leave it as orange, blue and ink metro lines, cross at an interchange and run right to Sinal, the signal post, who waits at the end of the line.",
                p)


for name, fn in (("a", concept_a), ("b", concept_b), ("c", concept_c)):
    (OUT / f"concept-{name}.json").write_text(json.dumps(fn(), indent=1) + "\n")
    print("wrote", OUT / f"concept-{name}.json")
