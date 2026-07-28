"""Tests for debrief metadata enrichment on read."""

from uuid import uuid4

from app.services.debrief.metadata_enrich import enrich_debrief_metadata


def test_enrich_from_insights_week_metrics():
    meta = {
        "week_start": "2026-07-20",
        "week_end": "2026-07-26",
        "momentum": {"projected_month_fmt": "₹4.8L", "wow_change_pct": 0},
        "insights": {
            "week_metrics": {
                "revenue": 68296,
                "prior_revenue": 137080,
                "orders": 227,
                "prior_orders": 222,
            }
        },
    }
    out = enrich_debrief_metadata(meta)
    assert out["momentum"]["this_week_revenue"] == 68296
    assert out["momentum"]["prior_week_revenue"] == 137080
    assert out["momentum"]["this_week_revenue_fmt"] == "₹68.3K"
    assert out["momentum"]["wow_change_pct"] == -50.2 or out["momentum"]["wow_change_pct"] == -50.1


def test_enrich_skips_when_momentum_complete():
    meta = {
        "momentum": {
            "this_week_revenue": 1000,
            "this_week_revenue_fmt": "₹1.0K",
        }
    }
    out = enrich_debrief_metadata(meta, tenant_id=uuid4(), supabase=None)
    assert out["momentum"]["this_week_revenue"] == 1000
