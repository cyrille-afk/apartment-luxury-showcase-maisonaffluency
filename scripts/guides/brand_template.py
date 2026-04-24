"""
Maison Affluency — Studio Guide brand template.

Reusable PDF design system. Any new guide imports `build_guide` from here and
supplies only content; the cover (jade + gold wordmark), headers, footers,
typography, palette and section blocks are inherited automatically.

Usage
-----
    from brand_template import build_guide

    build_guide(
        filename="public/guides/my-new-guide.pdf",
        title="My New Guide",
        subtitle="One-line description for the cover.",
        running="Studio Guide — My New Guide",
        sections=[
            {"title": "Section title", "blocks": [
                ("p", "Paragraph copy with <b>inline</b> markup."),
                ("h", "Sub-heading"),
                ("table", [("Label", "Value"), ("Label", "Value")]),
                ("callout", "Callout title", "Callout body."),
                ("spacer", 12),
                ("pagebreak",),
            ]},
        ],
    )

Block kinds
-----------
    ("p", html_text)                     paragraph
    ("h", text)                          sub-heading
    ("table", [(label, value), ...])     two-column fact table
    ("callout", title, body)             cream callout with gold rule
    ("spacer", points)                   vertical spacer
    ("pagebreak",)                       force a page break

Design tokens are exposed (JADE, GOLD, CREAM, …) so future guides can extend
the system without forking it.
"""
from __future__ import annotations

import html
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.platypus.doctemplate import NextPageTemplate
from reportlab.lib.styles import ParagraphStyle

# ---------------------------------------------------------------------------
# Brand palette
# ---------------------------------------------------------------------------
JADE       = HexColor("#1F3A35")
JADE_DARK  = HexColor("#16302B")
GOLD       = HexColor("#B5945A")
CREAM      = HexColor("#F4EFE3")
CREAM_SOFT = HexColor("#FAF6EC")
INK        = HexColor("#1A1A1A")
MUTE       = HexColor("#6B6B6B")
RULE       = HexColor("#D9D2C2")

# ---------------------------------------------------------------------------
# Fonts — embedded TTFs so output is consistent in every viewer
# ---------------------------------------------------------------------------
FONT_DIR = os.environ.get("MA_FONT_DIR", "/tmp/fonts")
LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "affluency-logo.png")
LOGO_LIGHT = os.path.join(os.path.dirname(__file__), "assets", "affluency-logo-cream.png")

SERIF       = "MA-Serif"
SERIF_BOLD  = "MA-Serif-Bold"
SERIF_IT    = "MA-Serif-Italic"
SANS        = "MA-Sans"
SANS_BOLD   = "MA-Sans-Bold"
SANS_IT     = "MA-Sans-Italic"

_FONTS_REGISTERED = False

def register_fonts(font_dir: str = FONT_DIR) -> None:
    """Register Noto Serif/Sans TTFs. Idempotent."""
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    pdfmetrics.registerFont(TTFont(SERIF,       f"{font_dir}/NotoSerif-Regular.ttf"))
    pdfmetrics.registerFont(TTFont(SERIF_BOLD,  f"{font_dir}/NotoSerif-Bold.ttf"))
    pdfmetrics.registerFont(TTFont(SERIF_IT,    f"{font_dir}/NotoSerif-Italic.ttf"))
    pdfmetrics.registerFont(TTFont(SANS,        f"{font_dir}/NotoSans-Regular.ttf"))
    pdfmetrics.registerFont(TTFont(SANS_BOLD,   f"{font_dir}/NotoSans-Bold.ttf"))
    pdfmetrics.registerFont(TTFont(SANS_IT,     f"{font_dir}/NotoSans-Italic.ttf"))
    registerFontFamily(SERIF, normal=SERIF, bold=SERIF_BOLD,
                       italic=SERIF_IT, boldItalic=SERIF_BOLD)
    registerFontFamily(SANS, normal=SANS, bold=SANS_BOLD,
                       italic=SANS_IT, boldItalic=SANS_BOLD)
    _FONTS_REGISTERED = True

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4
MARGIN_L = 22 * mm
MARGIN_R = 22 * mm
MARGIN_T = 28 * mm
MARGIN_B = 24 * mm

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _decode(s: str) -> str:
    """Decode HTML entities for canvas text (canvas does not parse XML)."""
    return html.unescape(s)


def _wrap(text: str, max_chars: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= max_chars:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

# ---------------------------------------------------------------------------
# Page decorators (cover + content)
# ---------------------------------------------------------------------------
def _draw_cover(canv, doc, title: str, subtitle: str, version: str) -> None:
    title_d = _decode(title)
    subtitle_d = _decode(subtitle)
    canv.saveState()
    canv.setFillColor(JADE)
    canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Logo + wordmark
    x = MARGIN_L
    y = PAGE_H - 50 * mm
    if os.path.exists(LOGO_LIGHT):
        try:
            canv.drawImage(LOGO_LIGHT, x, y - 4, width=22 * mm, height=22 * mm,
                           preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    canv.setFillColor(CREAM)
    canv.setFont(SANS_BOLD, 11)
    canv.drawString(x + 26 * mm, y + 8, "MAISON AFFLUENCY")
    canv.setFillColor(GOLD)
    canv.setFont(SANS, 9)
    canv.drawString(x + 26 * mm, y - 6, "TRADE PORTAL  ·  STUDIO GUIDE")
    canv.setStrokeColor(GOLD)
    canv.setLineWidth(1.2)
    canv.line(x, y - 18, x + 55 * mm, y - 18)

    # Title block
    ty = PAGE_H / 2 + 20 * mm
    canv.setFillColor(GOLD)
    canv.setFont(SANS_BOLD, 9)
    canv.drawString(x, ty, version)

    canv.setFillColor(CREAM)
    canv.setFont(SERIF, 36)
    line_y = ty - 22
    for ln in _wrap(title_d, 22):
        line_y -= 42
        canv.drawString(x, line_y, ln)

    # Subtitle
    canv.setFont(SANS, 11)
    canv.setFillColor(CREAM)
    sub_y = line_y - 28
    for sl in _wrap(subtitle_d, 78):
        canv.drawString(x, sub_y, sl)
        sub_y -= 15

    # Bottom signature
    canv.setFont(SANS, 11)
    canv.setFillColor(CREAM)
    canv.drawString(x, 32 * mm, "Maison Affluency")
    canv.restoreState()


def _draw_content(canv, doc, running_title: str) -> None:
    canv.saveState()
    # Header — logo + wordmark
    if os.path.exists(LOGO_PATH):
        try:
            canv.drawImage(LOGO_PATH, MARGIN_L, PAGE_H - 22 * mm,
                           width=8 * mm, height=8 * mm,
                           preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    canv.setFillColor(JADE)
    canv.setFont(SANS_BOLD, 9)
    canv.drawString(MARGIN_L + 10 * mm, PAGE_H - 18 * mm,
                    "MAISON AFFLUENCY  ·  TRADE PORTAL")
    canv.setFillColor(MUTE)
    canv.setFont(SANS, 9)
    canv.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 18 * mm, running_title)
    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.5)
    canv.line(MARGIN_L, PAGE_H - 22 * mm, PAGE_W - MARGIN_R, PAGE_H - 22 * mm)

    # Footer
    canv.setStrokeColor(RULE)
    canv.line(MARGIN_L, 18 * mm, PAGE_W - MARGIN_R, 18 * mm)
    canv.setFillColor(MUTE)
    canv.setFont(SANS, 9)
    canv.drawString(MARGIN_L, 13 * mm,
                    "© 2026 Maison Affluency  ·  maisonaffluency.com")
    canv.drawRightString(PAGE_W - MARGIN_R, 13 * mm, f"Page {doc.page}")
    canv.restoreState()

# ---------------------------------------------------------------------------
# Paragraph styles
# ---------------------------------------------------------------------------
def styles() -> dict:
    return {
        "eyebrow":   ParagraphStyle("eyebrow", fontName=SANS_BOLD, fontSize=9,
                                    textColor=GOLD, spaceAfter=2, leading=11),
        "h1":        ParagraphStyle("h1", fontName=SERIF, fontSize=28,
                                    textColor=JADE, leading=32, spaceAfter=14,
                                    spaceBefore=2),
        "h2":        ParagraphStyle("h2", fontName=SERIF_BOLD, fontSize=13,
                                    textColor=JADE, leading=17, spaceAfter=8,
                                    spaceBefore=14),
        "body":      ParagraphStyle("body", fontName=SANS, fontSize=10.5,
                                    textColor=INK, leading=16, spaceAfter=10),
        "callout_h": ParagraphStyle("callout_h", fontName=SANS_BOLD, fontSize=10.5,
                                    textColor=JADE, leading=14, spaceAfter=4),
        "callout_b": ParagraphStyle("callout_b", fontName=SANS, fontSize=10,
                                    textColor=INK, leading=15),
        "code":      ParagraphStyle("code", fontName="Courier", fontSize=9,
                                    textColor=JADE_DARK, leading=12),
    }

# ---------------------------------------------------------------------------
# Block builders
# ---------------------------------------------------------------------------
def section_header(num: int, title: str, st: dict) -> list:
    """Big numeral eyebrow + serif title."""
    return [
        Spacer(1, 2),
        Paragraph(f"{num:02d}", st["eyebrow"]),
        Paragraph(title, st["h1"]),
    ]

def fact_table(rows, st: dict) -> Table:
    data = [
        [Paragraph(f"<b>{label}</b>", st["body"]),
         Paragraph(val, st["body"])]
        for label, val in rows
    ]
    t = Table(data, colWidths=[50 * mm, 106 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t

def callout(title: str, body_text: str, st: dict) -> KeepTogether:
    inner = [
        Paragraph(title, st["callout_h"]),
        Paragraph(body_text, st["callout_b"]),
    ]
    t = Table([[inner]], colWidths=[156 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    return KeepTogether([Spacer(1, 6), t, Spacer(1, 8)])

# ---------------------------------------------------------------------------
# Document template
# ---------------------------------------------------------------------------
class GuideDoc(BaseDocTemplate):
    def __init__(self, filename, title, subtitle, running, version):
        super().__init__(
            filename, pagesize=A4,
            leftMargin=MARGIN_L, rightMargin=MARGIN_R,
            topMargin=MARGIN_T, bottomMargin=MARGIN_B,
            title=title, author="Maison Affluency",
        )
        cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover",
                            leftPadding=0, rightPadding=0,
                            topPadding=0, bottomPadding=0)
        content_frame = Frame(
            MARGIN_L, MARGIN_B + 4 * mm,
            PAGE_W - MARGIN_L - MARGIN_R,
            PAGE_H - MARGIN_T - MARGIN_B - 4 * mm,
            id="content",
        )
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[cover_frame],
                         onPage=lambda c, d: _draw_cover(c, d, title, subtitle, version)),
            PageTemplate(id="content", frames=[content_frame],
                         onPage=lambda c, d: _draw_content(c, d, running)),
        ])

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def build_guide(
    filename: str,
    title: str,
    subtitle: str,
    running: str,
    sections: list[dict],
    version: str = "STUDIO GUIDE · v1.0",
    font_dir: str = FONT_DIR,
) -> str:
    """Render a guide PDF with the Maison Affluency brand template."""
    register_fonts(font_dir)
    os.makedirs(os.path.dirname(filename) or ".", exist_ok=True)
    doc = GuideDoc(filename, title, subtitle, running, version)
    st = styles()

    story = [NextPageTemplate("content"), PageBreak()]
    for i, sec in enumerate(sections, 1):
        story.extend(section_header(i, sec["title"], st))
        for block in sec["blocks"]:
            kind = block[0]
            if kind == "p":
                story.append(Paragraph(block[1], st["body"]))
            elif kind == "h":
                story.append(Paragraph(block[1], st["h2"]))
            elif kind == "table":
                story.append(fact_table(block[1], st))
                story.append(Spacer(1, 8))
            elif kind == "callout":
                story.append(callout(block[1], block[2], st))
            elif kind == "spacer":
                story.append(Spacer(1, block[1]))
            elif kind == "pagebreak":
                story.append(PageBreak())
            else:
                raise ValueError(f"Unknown block kind: {kind!r}")
    doc.build(story)
    return filename
