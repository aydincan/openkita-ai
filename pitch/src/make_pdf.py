#!/usr/bin/env python3
"""Build openkita-ai-pitch.pdf from slides/png/slide-*.png (one 16:9 page per slide).

Stdlib only. Each PNG is embedded losslessly (Flate RGB) and drawn full-bleed on a
960×540 pt page (13.333…×7.5 in, the usual 16:9 slide size). Missing numbers are
an error; this script does not re-render from the pptx.
"""
import pathlib, struct, sys, zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PNG_DIR = ROOT / "slides" / "png"
OUT = ROOT / "openkita-ai-pitch.pdf"
PAGE_W, PAGE_H = 960, 540  # points; 960/540 = 16/9


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_png_rgb(path):
    """Return (width, height, raw RGB bytes) for a non-interlaced 8-bit RGB PNG."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path.name} is not a PNG")
    pos, idat = 8, []
    width = height = bit_depth = color_type = interlace = None
    while pos + 8 <= len(data):
        length = int.from_bytes(data[pos:pos + 4], "big")
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            interlace = chunk[12]
        elif kind == b"IDAT":
            idat.append(chunk)
        elif kind == b"IEND":
            break
    if (width, height) != (1920, 1080) or bit_depth != 8 or color_type != 2 or interlace != 0:
        raise SystemExit(
            f"{path.name}: expected 1920x1080 8-bit RGB, got "
            f"{width}x{height} depth={bit_depth} color={color_type} interlace={interlace}"
        )
    raw = zlib.decompress(b"".join(idat))
    stride = width * 3
    rows, i, prev = [], 0, bytearray(stride)
    for _y in range(height):
        filt = raw[i]
        i += 1
        row = bytearray(raw[i:i + stride])
        i += stride
        if filt == 1:
            for x in range(stride):
                row[x] = (row[x] + (row[x - 3] if x >= 3 else 0)) & 255
        elif filt == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                left = row[x - 3] if x >= 3 else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                left = row[x - 3] if x >= 3 else 0
                up, ul = prev[x], prev[x - 3] if x >= 3 else 0
                row[x] = (row[x] + _paeth(left, up, ul)) & 255
        elif filt != 0:
            raise SystemExit(f"{path.name}: unsupported PNG filter {filt}")
        rows.append(row)
        prev = row
    if i != len(raw):
        raise SystemExit(f"{path.name}: PNG scanlines did not consume the image data")
    return width, height, b"".join(rows)


def _slides():
    paths = sorted(PNG_DIR.glob("slide-*.png"))
    if not paths:
        raise SystemExit(f"no PNGs in {PNG_DIR}")
    expected = [f"slide-{i:02d}.png" for i in range(1, len(paths) + 1)]
    got = [p.name for p in paths]
    if got != expected:
        raise SystemExit(f"slide PNGs must be contiguous from slide-01; got {got}")
    return paths


def build(paths):
    images = []
    for path in paths:
        w, h, rgb = decode_png_rgb(path)
        images.append(zlib.compress(rgb, 9))
        print(f"{path.name} {w}x{h}")
    n = len(images)
    # 1 catalog, 2 pages, then n pages, n content streams, n images
    page_ids = list(range(3, 3 + n))
    content_ids = list(range(3 + n, 3 + 2 * n))
    image_ids = list(range(3 + 2 * n, 3 + 3 * n))
    content = b"q\n960 0 0 540 0 0 cm\n/Im0 Do\nQ\n"
    bodies = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: (
            f"<< /Type /Pages /Count {n} /Kids ["
            + " ".join(f"{i} 0 R" for i in page_ids)
            + "] >>"
        ).encode(),
    }
    for i, comp in enumerate(images):
        bodies[page_ids[i]] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Contents {content_ids[i]} 0 R /Resources << /XObject << /Im0 {image_ids[i]} 0 R >> "
            f"/ProcSet [/PDF /ImageC] >> >>"
        ).encode()
        bodies[content_ids[i]] = (
            f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"endstream"
        )
        bodies[image_ids[i]] = (
            f"<< /Type /XObject /Subtype /Image /Width 1920 /Height 1080 "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "
            f"/Length {len(comp)} >>\nstream\n".encode()
            + comp
            + b"\nendstream"
        )
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for num in range(1, 3 + 3 * n):
        offsets.append(len(out))
        out += f"{num} 0 obj\n".encode() + bodies[num] + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(offsets)}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    ).encode()
    OUT.write_bytes(out)
    print(f"wrote {OUT} pages={n} bytes={len(out)}")


if __name__ == "__main__":
    try:
        build(_slides())
    except BrokenPipeError:
        sys.exit(0)
