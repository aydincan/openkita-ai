"""PDF and DOCX export of a saved draft. The file is built from stored text, not model HTML.

Libraries: reportlab (BSD) for PDF, python-docx (MIT) for DOCX.
"""

import textwrap
from io import BytesIO
from pathlib import Path

from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

EXPORT_FOOTER = "KI-Entwurf. Von einer Fachkraft zu prüfen. Nicht versendet."

_FONT_CANDIDATES = (
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("/Library/Fonts/Arial.ttf"),
)
_FONT_READY = False
_FONT_NAME = "Helvetica"


def render_docx(body: str) -> bytes:
    document = Document()
    for line in body.splitlines():
        document.add_paragraph(line)
    document.add_paragraph(EXPORT_FOOTER)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def render_pdf(body: str) -> bytes:
    font = _font_name()
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _draw(pdf, body.rstrip() + "\n\n" + EXPORT_FOOTER, font)
    pdf.save()
    return buffer.getvalue()


def _draw(pdf: canvas.Canvas, text: str, font: str) -> None:
    height = A4[1]
    pdf.setFont(font, 11)
    y = height - 72
    safe = text if font != "Helvetica" else text.encode("cp1252", errors="replace").decode("cp1252")
    for paragraph in safe.splitlines():
        lines = textwrap.wrap(paragraph, width=90) or [""]
        for line in lines:
            if y < 72:
                pdf.showPage()
                pdf.setFont(font, 11)
                y = height - 72
            pdf.drawString(72, y, line)
            y -= 15


def _font_name() -> str:
    global _FONT_READY, _FONT_NAME
    if _FONT_READY:
        return _FONT_NAME
    for path in _FONT_CANDIDATES:
        if path.is_file():
            pdfmetrics.registerFont(TTFont("OpenKitaSans", str(path)))
            _FONT_NAME = "OpenKitaSans"
            break
    _FONT_READY = True
    return _FONT_NAME
