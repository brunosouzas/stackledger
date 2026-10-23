"""The solution diagram of docs/how-it-works.md, drawn as an illustrated SVG.

Usage: python3 scripts/how-it-works-diagram.py <output-dir>   (writes <output-dir>/how-it-works.svg)
Check: rsvg-convert -w 800 docs/images/how-it-works.svg -o how-it-works.png, then look at the PNG.

The style follows the brunosouzas.com diagrams: a light panel with rings, flat blocks with a thick
ink outline and a hard offset shadow, the Lato stack. It keeps every node and arrow of the Mermaid
block in docs/how-it-works.md; change both together. English only.
"""
import sys
from pathlib import Path
from xml.sax.saxutils import escape as e

OUT = Path(sys.argv[1])
INK = "#0A1033"
SANS = "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
GREEN, ORANGE, YELLOW, BLUE = "#3DDC84", "#FF8A3D", "#FFD25A", "#8FB2FF"
PERSON, NPM, CLOUDFLARE, RED = "#3B4256", "#CB3837", "#F38020", "#E04848"
BG, RING, WHITE = "#EEF2FF", "#E0E7FB", "#FFFFFF"
W, H = 800, 808

TITLE = "How stackledger publishes a catalogue"
DESC = ("Flowchart. On your Mac, stackledger discover writes a snapshot that stays on the Mac, and drift --scaffold "
        "helps you edit catalog/*.yaml. A git push sends the catalogue to a private GitHub repository. A pull request "
        "runs gitleaks, validate and build but never deploys. A push to main runs gitleaks, validate and build with "
        "stackledger from the npm registry, then wrangler pages deploy publishes the whole static site to Cloudflare "
        "Pages, which never reads GitHub. A reader reaches Pages only through Cloudflare Access, signing in first. "
        "Personal mode: the full site only, one Access application for the owner, / leads to /full/. Corporate mode: "
        "full and staff sites, finance on /full/*, staff on the rest, / leads to /staff/.")


def head():
    rings = "".join(f'<circle cx="400" cy="400" r="{r}"/>' for r in range(70, 900, 28))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="hiw-t hiw-d" font-family="{SANS}">
  <title id="hiw-t">{e(TITLE)}</title>
  <desc id="hiw-d">{e(DESC)}</desc>
  <defs>
    <clipPath id="hiw-f"><rect width="{W}" height="{H}" rx="14"/></clipPath>
    <marker id="hiw-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0.5 L10,5 L0,9.5 L3,5 Z" fill="{INK}"/></marker>
  </defs>
  <rect width="{W}" height="{H}" rx="14" fill="{BG}"/>
  <g clip-path="url(#hiw-f)" fill="none" stroke="{RING}" stroke-width="2">{rings}</g>
'''


def container(x, y, w, h, name):
    """A Mermaid subgraph: drawn before the arrows, so it never covers them."""
    return (f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{WHITE}" fill-opacity="0.55" stroke="{INK}" stroke-width="3" stroke-dasharray="10 7"/>\n'
            + label(x + 18, y + 26, [name], anchor="start", size=16, weight=800))


def block(x, y, w, h, fill, rx=14):
    return (f'  <rect x="{x+8}" y="{y+8}" width="{w}" height="{h}" rx="{rx}" fill="{INK}"/>\n'
            f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>\n')


def label(x, y, lines, anchor="middle", size=15, weight=700, fill=INK, lh=19, font=SANS):
    return "".join(f'  <text x="{x}" y="{y + i*lh}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" font-family="{font}">{e(line)}</text>\n'
                   for i, line in enumerate(lines))


def node(x, y, w, h, fill, name, lines=(), text=INK, mono=False):
    """A block with its name (bold) and up to three detail lines, centred."""
    total = 22 + 19 * len(lines)
    top = y + (h - total) / 2 + 17
    out = block(x, y, w, h, fill)
    out += label(x + w / 2, top, [name], size=15 if mono else 19, weight=800, fill=text, font=MONO if mono else SANS)
    out += label(x + w / 2, top + 24, list(lines), size=14, weight=700, fill=text)
    return out


def arrow(d, dashed=False, colour=INK):
    dash = ' stroke-dasharray="8 6"' if dashed else ""
    return f'  <path d="{d}" fill="none" stroke="{colour}" stroke-width="3" stroke-linecap="round"{dash} marker-end="url(#hiw-a)"/>\n'


def pill(y, fill, lines):
    out = f'  <rect x="38" y="{y+5}" width="728" height="44" rx="22" fill="{INK}"/>\n'
    out += f'  <rect x="34" y="{y}" width="728" height="44" rx="22" fill="{fill}" stroke="{INK}" stroke-width="3"/>\n'
    return out + label(398, y + 28, lines, size=15, weight=800)


def diagram():
    s = head()
    # Containers first (Mermaid subgraphs).
    s += container(24, 20, 752, 150, "Your Mac")
    s += container(24, 214, 570, 230, "Private GitHub repository, GitHub Actions")
    s += container(216, 492, 560, 168, "Cloudflare")
    # Arrows next, so the blocks' shadows sit on their ends, never on their middle.
    s += arrow("M368,104 L428,104", dashed=True)                         # discover -> edit (drift --scaffold)
    s += arrow("M590,154 C590,206 470,206 420,246")                       # edit -> repo (git push)
    s += arrow("M240,312 C200,330 178,340 172,356")                       # repo -> pull request
    s += arrow("M380,312 C420,330 444,340 450,356")                       # repo -> push to main
    s += arrow("M680,322 C680,380 620,396 588,396")                       # npm -> push to main
    s += arrow("M450,436 C450,480 640,474 640,522")                       # main -> pages (deploy)
    s += arrow("M196,580 L246,580")                                       # reader -> access
    s += arrow("M474,580 L512,580")                                       # access -> pages
    # Blocks.
    s += node(48, 62, 314, 84, BLUE, "stackledger discover", ["the snapshot stays here"], mono=True)
    s += node(436, 62, 314, 84, BLUE, "You edit catalog/*.yaml", ["drift --scaffold suggests entries"])
    s += node(170, 254, 260, 56, WHITE, "Catalogue repository")
    s += node(48, 360, 252, 76, ORANGE, "Pull request", ["gitleaks, validate, build", "never deploys"])
    s += node(320, 360, 262, 76, GREEN, "Push to main", ["gitleaks, validate, build"])
    s += node(612, 254, 158, 66, NPM, "npm registry", ["@brunosouzas/", "stackledger"], text=WHITE)
    s += node(30, 542, 160, 76, PERSON, "Reader", ["a browser"], text=WHITE)
    s += node(252, 538, 216, 84, YELLOW, "Cloudflare Access", ["sign-in first"])
    s += node(518, 530, 236, 100, CLOUDFLARE, "Cloudflare Pages", ["the whole static site", "never reads GitHub"])
    # Arrow labels last, clear of the curves.
    s += label(398, 94, ["drift"], size=14, font=MONO)
    s += label(604, 200, ["git push"], size=15, font=MONO, anchor="start")
    s += label(708, 384, ["npx"], size=14, font=MONO, anchor="start")
    s += label(436, 478, ["wrangler pages deploy"], size=14, font=MONO, anchor="end")
    # The two modes.
    s += pill(682, GREEN, ["Personal: full site only · one Access application, the owner · / → /full/"])
    s += pill(738, BLUE, ["Corporate: full and staff · finance on /full/*, staff on the rest · / → /staff/"])
    return s + "</svg>\n"


OUT.mkdir(parents=True, exist_ok=True)
(OUT / "how-it-works.svg").write_text(diagram(), encoding="utf-8")
print(OUT / "how-it-works.svg")
