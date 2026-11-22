#!/usr/bin/env python3
"""
Build the Ultimate Solutions logo files from the master PDF.

    python3 tools/build_logos.py

The master PDF (brand/source/ultimate-solutions-logo-main.pdf) has its text
converted to outlines, so we reuse the real letter shapes instead of
approximating them with a font. Needs poppler's `pdftocairo` on the PATH.

Outputs (assets/logo/ and assets/icons/):
  logo-main.svg            horizontal logo, exactly as the PDF (cropped)
  logo-main-reversed.svg   same, but black -> white, for dark backgrounds
  logo-stacked.svg         invoice/small version, rebuilt with the PDF lettering
  favicon.svg              house + U mark only

PNGs are made afterwards by tools/render_pngs.cjs.
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "brand/source/ultimate-solutions-logo-main.pdf"
LOGO_DIR = ROOT / "assets/logo"
ICON_DIR = ROOT / "assets/icons"

# Brand colours sampled from the PDF
INK = "#231f20"
ORANGE = "#f36020"
WHITE = "#ffffff"
COLOUR_BY_RGB = {
    "13.729858%, 12.159729%, 12.548828%": INK,
    "95.199585%, 37.705994%, 12.625122%": ORANGE,
    "45.21637%, 54.267883%, 60.137939%": "#738a99",   # slate blue/grey
    "14.477539%, 29.920959%, 44.53125%": "#254c71",   # deep blue
    "69.314575%, 75.683594%, 57.763672%": "#b1c193",  # sage
    "37.406921%, 49.629211%, 46.705627%": "#5f7f77",  # teal grey
}


def extract_paths():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "l.svg"
        subprocess.run(["pdftocairo", "-svg", str(PDF), str(out)], check=True)
        svg = out.read_text()
    paths = []
    for m in re.finditer(r'<path[^>]*fill="rgb\(([^)]*)\)"[^>]*\sd="([^"]*)"', svg):
        d = re.sub(r"\s+", " ", m.group(2)).strip()
        paths.append((COLOUR_BY_RGB[m.group(1)], d))
    return paths


def bbox(d):
    n = [float(x) for x in re.findall(r"-?\d+\.?\d*", d)]
    xs, ys = n[0::2], n[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def path_el(fill, d, swap_ink=None):
    if swap_ink and fill == INK:
        fill = swap_ink
    return f'<path fill="{fill}" d="{d}"/>'


def svg_doc(vb, body, title, desc=None):
    x, y, w, h = vb
    d = f"<desc>{desc}</desc>" if desc else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x)} {fmt(y)} {fmt(w)} {fmt(h)}" '
        f'role="img" aria-labelledby="t">\n<title id="t">{title}</title>{d}\n{body}\n</svg>\n'
    )


def main():
    paths = extract_paths()
    if len(paths) != 23:
        sys.exit(f"Expected 23 shapes in the PDF, found {len(paths)} - has the artwork changed?")

    ltimate = paths[0:7]      # black L T I M A T E (the U is part of the mark)
    solutions = paths[7:16]   # orange S O L U T I O N S
    mark_u = paths[16:22]     # the sliced, striped U
    house = paths[22]         # roof/house outline
    mark = mark_u + [house]

    # ---- 1. Main horizontal logo (identical artwork to the PDF) --------------
    allb = union([bbox(d) for _, d in paths])
    pad = 8
    vb = (allb[0] - pad, allb[1] - pad, allb[2] - allb[0] + 2 * pad, allb[3] - allb[1] + 2 * pad)
    order = [house] + mark_u + ltimate + solutions
    for name, swap in (("logo-main.svg", None), ("logo-main-reversed.svg", WHITE)):
        body = "\n".join(path_el(f, d, swap) for f, d in order)
        (LOGO_DIR / name).write_text(svg_doc(vb, body, "Ultimate Solutions"))

    # ---- 2. Favicon: the mark only, squared up --------------------------------
    mb = union([bbox(d) for _, d in mark])
    side = max(mb[2] - mb[0], mb[3] - mb[1]) + 30
    cx, cy = (mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2
    fav_vb = (cx - side / 2, cy - side / 2, side, side)
    body = "\n".join(path_el(f, d) for f, d in [house] + mark_u)
    (ICON_DIR / "favicon.svg").write_text(svg_doc(fav_vb, body, "Ultimate Solutions"))

    # ---- 3. Stacked logo (the small invoice/favicon one, rebuilt) --------------
    # The PDF has no stand-alone black "U" (it is the sliced graphic in the mark),
    # so one is constructed here to match the PDF letters: same cap height, same
    # stem weight, round bottom with the same small overshoot as the O/E curves.
    l_box = bbox(ltimate[0][1])
    top, base = bbox(ltimate[1][1])[1], l_box[3]            # cap top / baseline
    cap = base - top
    stem = 620.898 - 592.734                                # stroke weight of the L's upright
    uw, over, bowl_ry = 122.0, 2.2, 35.0
    r = uw / 2
    cyc = base + over - r
    ux = l_box[0] - 24.0 - uw                               # sits just left of the L
    u_d = (f"M{fmt(ux)} {fmt(top)}H{fmt(ux + stem)}V{fmt(cyc)}"
           f"A{fmt(r - stem)} {fmt(bowl_ry)} 0 0 0 {fmt(ux + uw - stem)} {fmt(cyc)}"
           f"V{fmt(top)}H{fmt(ux + uw)}V{fmt(cyc)}"
           f"A{fmt(r)} {fmt(r)} 0 0 1 {fmt(ux)} {fmt(cyc)}Z")
    word = [(INK, u_d)] + ltimate
    # (bbox() can't read arc commands, so the constructed U's box is given explicitly)
    u_box = (ux, top, ux + uw, base + over)
    word_box = union([u_box] + [bbox(d) for _, d in ltimate])
    sol_box = union([bbox(d) for _, d in solutions])

    mark_w, mark_h = mb[2] - mb[0], mb[3] - mb[1]
    word_w_target = mark_w * 0.92
    s1 = word_w_target / (word_box[2] - word_box[0])
    s2 = word_w_target / (sol_box[2] - sol_box[0])          # SOLUTIONS tracked to same width
    margin, gap1, gap2 = 34, 40, 30
    cap1, cap2 = (word_box[3] - word_box[1]) * s1, (sol_box[3] - sol_box[1]) * s2
    W = mark_w + 2 * margin
    H = margin + mark_h + gap1 + cap1 + gap2 + cap2 + margin
    y_word = margin + mark_h + gap1
    y_sol = y_word + cap1 + gap2
    x_word = (W - word_w_target) / 2

    def group(items, tx, ty, s, ox, oy):
        inner = "\n".join(path_el(f, d) for f, d in items)
        return (f'<g transform="translate({fmt(tx)} {fmt(ty)}) scale({s:.5f}) '
                f'translate({fmt(-ox)} {fmt(-oy)})">\n{inner}\n</g>')

    body = "\n".join([
        group(mark, margin, margin, 1, mb[0], mb[1]),
        group(word, x_word, y_word, s1, word_box[0], word_box[1]),
        group(solutions, x_word, y_sol, s2, sol_box[0], sol_box[1]),
    ])
    (LOGO_DIR / "logo-stacked.svg").write_text(
        svg_doc((0, 0, W, H), body, "Ultimate Solutions",
                "Stacked logo for invoices and small sizes"))
    print("Wrote SVGs to", LOGO_DIR, "and", ICON_DIR)


if __name__ == "__main__":
    main()
