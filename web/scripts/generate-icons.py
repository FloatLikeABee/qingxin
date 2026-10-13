#!/usr/bin/env python3
"""Generate simple Qingxin PWA icons without extra dependencies."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def png(width: int, height: int, pixel) -> bytes:
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            row.extend(pixel(x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", ihdr),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )


def make(size: int, pad: int = 0) -> bytes:
    def pixel(x: int, y: int) -> bytes:
        # Soft morning blue tile with a lighter leaf-like circle.
        nx = (x + 0.5) / size
        ny = (y + 0.5) / size
        if pad and (x < pad or y < pad or x >= size - pad or y >= size - pad):
            return bytes([17, 24, 39, 255]) if False else bytes([59, 130, 246, 255])
        cx, cy = 0.52, 0.46
        r = ((nx - cx) ** 2 + (ny - cy) ** 2) ** 0.5
        if r < 0.22:
            return bytes([255, 255, 255, 255])
        if r < 0.28:
            return bytes([191, 219, 254, 255])
        return bytes([59, 130, 246, 255])

    return png(size, size, pixel)


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "static" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    (out / "icon-192.png").write_bytes(make(192))
    (out / "icon-512.png").write_bytes(make(512))
    (out / "icon-maskable-512.png").write_bytes(make(512, pad=56))
    (out / "apple-touch-icon.png").write_bytes(make(180))


if __name__ == "__main__":
    main()
