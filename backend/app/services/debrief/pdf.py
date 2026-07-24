"""Render weekly debrief metadata as PDF bytes."""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _wrap_line(c: canvas.Canvas, text: str, x: float, y: float, max_width: float) -> float:
    words = text.split()
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if c.stringWidth(trial, "Helvetica", 10) <= max_width:
            line = trial
        else:
            if line:
                c.drawString(x, y, line)
                y -= 5 * mm
            line = word
    if line:
        c.drawString(x, y, line)
        y -= 5 * mm
    return y


def render_debrief_pdf(metadata: dict[str, Any], title: str) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 20 * mm
    max_width = width - 2 * margin
    y = height - margin

    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, y, "AKARA Weekly Debrief")
    y -= 8 * mm
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, title)
    y -= 6 * mm
    c.drawString(
        margin,
        y,
        f"{metadata.get('week_start', '')} – {metadata.get('week_end', '')}",
    )
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "Headline")
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    y = _wrap_line(c, metadata.get("headline", ""), margin, y, max_width)
    y -= 4 * mm

    for section_key, section_title in (
        ("went_right", "Went Right"),
        ("went_wrong", "Went Wrong"),
        ("actions", "Actions"),
    ):
        if y < 40 * mm:
            c.showPage()
            y = height - margin
        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, y, section_title)
        y -= 6 * mm
        c.setFont("Helvetica", 10)
        for item in metadata.get(section_key, [])[:3]:
            line = f"• {item.get('title', '')}: {item.get('detail', '')}"
            y = _wrap_line(c, line, margin, y, max_width)
        y -= 4 * mm

    momentum = metadata.get("momentum") or {}
    if y < 50 * mm:
        c.showPage()
        y = height - margin
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "Momentum")
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    for label, key in (
        ("This week", "this_week_revenue_fmt"),
        ("WoW change", "wow_change_pct"),
        ("30d trend", "trend_30d"),
        ("Projected month", "projected_month_fmt"),
    ):
        val = momentum.get(key, "—")
        if key == "wow_change_pct" and val != "—":
            val = f"{val}%"
        c.drawString(margin, y, f"{label}: {val}")
        y -= 5 * mm

    c.save()
    return buffer.getvalue()
