#!/usr/bin/env python3
"""Regenerates the raster icons from the geometry in `app/icon.svg`.

The mark is the header logo — three stacked strata narrowing to a point — in the
accent mint on the elevated background, which is what makes it legible in a
browser tab and in a search result, where the page's own near-black is not
behind it.

Every frame is drawn at 8x and downsampled on its own, rather than scaled out of
one large bitmap, so the stroke lands at roughly one pixel at 16px instead of
dissolving. The artwork sits at 70% of the box for the same reason the numbers
below are duplicated in the SVG: search engines and phone launchers crop icons
to a circle, and the triangle's base corners are the first thing to go.

    python scripts/make-icons.py

Writes `app/favicon.ico` and `app/apple-icon.png`. Needs Pillow. Nothing in the
site depends on it — the outputs are committed.
"""

import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

BG = (10, 10, 10, 255)  # --bg-elevated
MINT = (169, 221, 211)  # --accent
INSET = 0.70  # artwork's share of the box, leaving room for a circular crop
RADIUS = 0.20  # corner radius, as a share of the box
STROKE = 1.4  # in the mark's own 16-unit space; 1.1 in the header, thickened to survive 16px
SUPERSAMPLE = 8

TRIANGLE = [(8, 1.4), (1.2, 13.4), (14.8, 13.4)]
# Chords across the triangle at the mark's two stratum heights, stopping short of
# the inner edge of the stroke so the join reads as a gap rather than a blot.
STRATA = [(4.88, 11.12, 9.2, 0.55), (6.46, 9.54, 6.4, 0.30)]

ICO_SIZES = [16, 32, 48, 64, 128, 256]
APPLE_SIZE = 180


def render(size: int) -> Image.Image:
    """One frame, drawn oversized and reduced, so the edges are antialiased."""
    box = size * SUPERSAMPLE
    scale = INSET * box / 16

    def at(u: float, v: float) -> tuple[float, float]:
        return (box / 2 + (u - 8) * scale, box / 2 + (v - 8) * scale)

    img = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, box - 1, box - 1), radius=RADIUS * box, fill=BG)

    width = max(1, round(STROKE * scale))
    outline = [at(*point) for point in TRIANGLE]
    draw.line(outline + [outline[0]], fill=MINT + (255,), width=width, joint="curve")

    for x1, x2, y, opacity in STRATA:
        # A separate layer because ImageDraw replaces pixels rather than blending
        # them, so drawing a translucent line straight onto `img` would punch a
        # hole in the background instead of dimming the mint.
        layer = Image.new("RGBA", (box, box), (0, 0, 0, 0))
        ImageDraw.Draw(layer).line(
            [at(x1, y), at(x2, y)], fill=MINT + (round(opacity * 255),), width=width
        )
        img.alpha_composite(layer)

    return img.resize((size, size), Image.LANCZOS)


def write_ico(path: Path, frames: list[Image.Image]) -> None:
    """Multi-frame ICO with PNG-compressed frames, which every current browser
    reads and which keeps the 256px frame from costing 256 KB as raw BMP."""
    payloads = []
    for frame in frames:
        buffer = BytesIO()
        frame.save(buffer, format="PNG", optimize=True)
        payloads.append(buffer.getvalue())

    offset = 6 + 16 * len(payloads)
    directory = []
    for frame, payload in zip(frames, payloads):
        width, height = frame.size
        # 256 is stored as 0: the field is one byte and 256 does not fit.
        directory.append(
            struct.pack(
                "<BBBBHHII", width % 256, height % 256, 0, 0, 1, 32, len(payload), offset
            )
        )
        offset += len(payload)

    with path.open("wb") as out:
        out.write(struct.pack("<HHH", 0, 1, len(payloads)))
        for entry in directory:
            out.write(entry)
        for payload in payloads:
            out.write(payload)


if __name__ == "__main__":
    app = Path(__file__).resolve().parent.parent / "app"
    write_ico(app / "favicon.ico", [render(size) for size in ICO_SIZES])
    render(APPLE_SIZE).save(app / "apple-icon.png", optimize=True)
    print(f"favicon.ico  {', '.join(f'{n}x{n}' for n in ICO_SIZES)}")
    print(f"apple-icon.png  {APPLE_SIZE}x{APPLE_SIZE}")
