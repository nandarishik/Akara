"""Tests for debrief PDF generation."""

from __future__ import annotations

from app.services.debrief.pdf import render_debrief_pdf


def test_render_debrief_pdf_non_empty():
    meta = {
        "week_start": "2026-07-14",
        "week_end": "2026-07-20",
        "headline": "Revenue grew vs last week.",
        "went_right": [{"title": "North up", "detail": "Strong zone performance."}],
        "went_wrong": [{"title": "South down", "detail": "Party churn detected."}],
        "actions": [{"title": "Call ABC", "detail": "Follow up on credit."}],
        "momentum": {
            "this_week_revenue_fmt": "₹2.1L",
            "wow_change_pct": 12.5,
            "trend_30d": "up",
            "projected_month_fmt": "₹8.4L",
        },
    }
    pdf = render_debrief_pdf(meta, "Weekly Debrief")
    assert isinstance(pdf, bytes)
    assert len(pdf) > 500
    assert pdf[:4] == b"%PDF"
