"""Tests for debrief narrative / metrics reconciliation."""

from app.services.debrief.metadata_enrich import enrich_debrief_metadata
from app.services.debrief.narrative_reconcile import (
    narrative_contradicts_metrics,
    reconcile_narrative,
    strip_contradictory_narrative,
)


def test_detects_revenue_decline_claim_when_metrics_show_growth():
    meta = {
        "headline": "Weekly Business Debrief",
        "momentum": {
            "this_week_revenue": 140_000,
            "prior_week_revenue": 130_000,
            "wow_change_pct": 7.4,
        },
        "went_wrong": [
            {
                "title": "Significant Revenue Decline",
                "detail": "Revenue dropped to 88296, down from 137080 in the previous week.",
            }
        ],
        "went_right": [],
    }
    assert narrative_contradicts_metrics(meta) is True


def test_strip_removes_contradictory_went_wrong():
    meta = {
        "headline": "Revenue fell sharply",
        "momentum": {
            "this_week_revenue": 140_000,
            "prior_week_revenue": 130_000,
        },
        "went_wrong": [
            {
                "title": "Significant Revenue Decline",
                "detail": "Total revenue dropped vs last week.",
            },
            {
                "title": "Customer churn",
                "detail": "Ten customers went quiet.",
            },
        ],
        "went_right": [],
    }
    out = strip_contradictory_narrative(meta)
    assert len(out["went_wrong"]) == 1
    assert out["went_wrong"][0]["title"] == "Customer churn"
    assert "grew" in out["headline"].lower()


def test_enrich_strips_stale_llm_decline_when_momentum_shows_growth():
    meta = {
        "week_end": "2026-07-26",
        "momentum": {
            "this_week_revenue": 140_000,
            "prior_week_revenue": 130_000,
            "this_week_revenue_fmt": "₹1.4L",
            "prior_week_revenue_fmt": "₹1.3L",
            "wow_change_pct": 7.4,
        },
        "went_wrong": [
            {
                "title": "Significant Revenue Decline",
                "detail": "Revenue dropped to 88296 from 137080.",
            },
            {"title": "Churn", "detail": "Ten customers disengaged."},
        ],
        "went_right": [{"title": "Stable orders", "detail": "222 vs 220 last week."}],
        "actions": [],
    }
    out = enrich_debrief_metadata(meta)
    titles = [i["title"] for i in out["went_wrong"]]
    assert "Significant Revenue Decline" not in titles
    assert "Churn" in titles


def test_reconcile_without_data_strips_only():
    meta = {
        "momentum": {"this_week_revenue": 150_000, "prior_week_revenue": 100_000},
        "went_wrong": [
            {"title": "Revenue down", "detail": "Sales dropped this week."},
        ],
    }
    out = reconcile_narrative(meta, None)
    assert out["went_wrong"] == []
