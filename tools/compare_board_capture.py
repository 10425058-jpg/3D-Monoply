"""Compare an opaque interior board region in two matched browser PNGs.

Uses the existing stdlib PNG decoder; no screenshot editing or imaging package.
The rectangle deliberately excludes the sky, HUD, board outline and transparency.
"""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools/blender"))
from validate_assets import image_dimensions, png_statistics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--rect", type=int, nargs=4, default=[575, 265, 420, 310], metavar=("X", "Y", "WIDTH", "HEIGHT"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    decoded = []
    dimensions = []
    for filename in [args.before, args.after]:
        raw = filename.read_bytes()
        dimensions.append(image_dimensions(raw))
        _, pixels = png_statistics(raw)
        if not pixels:
            raise ValueError("comparison requires PNG captures")
        decoded.append(pixels)
    if dimensions[0] != dimensions[1]:
        raise ValueError("capture dimensions differ")
    x, y, width, height = args.rect
    if min(x, y) < 0 or min(width, height) < 1 or x + width > dimensions[0][0] or y + height > dimensions[0][1]:
        raise ValueError("comparison rectangle outside capture")
    changed = total_delta = maximum = 0
    for row in range(y, y + height):
        for column in range(x, x + width):
            colors = [rows[row][column*channels:column*channels+3] for rows, channels in decoded]
            deltas = [abs(a-b) for a, b in zip(*colors)]
            changed += any(deltas)
            total_delta += sum(deltas)
            maximum = max(maximum, *deltas)
    result = {"before": str(args.before), "after": str(args.after), "rectangle": args.rect,
              "pixels": width*height, "changedPixels": changed, "maxChannelDelta": maximum,
              "meanAbsoluteChannelDelta": total_delta/(width*height*3), "pixelIdentical": changed == 0}
    encoded = json.dumps(result, indent=2)
    print(encoded)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    return 0 if changed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
