"""Convert dark-mode game card backgrounds to light mode preserving exact shapes."""

from __future__ import annotations

import colorsys
import sys
from pathlib import Path

from PIL import Image


BG_LIGHT = (245, 240, 232)


def luminance(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def convert_pixel(r: int, g: int, b: int) -> tuple[int, int, int]:
    lum = luminance(r, g, b)
    chroma = max(r, g, b) - min(r, g, b)

    if lum < 52 and chroma < 42:
        grain = lum / 52.0
        return (
            int(BG_LIGHT[0] * (0.9 + grain * 0.12)),
            int(BG_LIGHT[1] * (0.9 + grain * 0.12)),
            int(BG_LIGHT[2] * (0.88 + grain * 0.14)),
        )

    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    accent_strength = min(1.0, max(0.0, (lum - 24.0) / 180.0))
    next_s = s * (0.28 + accent_strength * 0.42)
    next_v = min(0.92, 0.58 + v * 0.34 + accent_strength * 0.08)
    nr, ng, nb = colorsys.hsv_to_rgb(h, next_s, next_v)
    return int(nr * 255), int(ng * 255), int(nb * 255)


def convert_file(input_path: Path, output_path: Path) -> None:
    image = Image.open(input_path).convert('RGB')
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            pixels[x, y] = convert_pixel(*pixels[x, y])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)
    print(f'Wrote {output_path} ({width}x{height})')


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: python scripts/convert-mode-bg-to-light.py <input-dark.png> <output-light.png>')
        sys.exit(1)

    convert_file(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == '__main__':
    main()
