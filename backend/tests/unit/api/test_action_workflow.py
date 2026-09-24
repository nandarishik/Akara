from datetime import UTC, datetime, timedelta

from app.domain.intelligence import recommendation_repo as repo


def _seed(tenant: str = "t-a") -> str:
    repo.reset_store()
    rec_id = "11111111-1111-1111-1111-111111111111"
    repo.upsert(
        {
            "id": rec_id,
            "tenant_id": tenant,
            "recommendation_type": "pricing",
            "title": "Raise Cold Brew price by ₹10",
            "description": "Cost rose.",
            "evidence": [{"type": "metric", "label": "rev", "value": 1, "unit": "INR"}],
            "confidence_score": 0.72,
            "confidence_methodology": "volume 0.5 + consistency 0.5 − freshness penalty",
            "data_days": 45,
            "expected_impact_min": 8000,
            "expected_impact_max": 12000,
            "expected_impact_currency": "INR",
            "assumptions": [],
            "risks": [],
            "status": "open",
            "created_at": datetime.now(UTC).isoformat(),
            "expires_at": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "snooze_until": None,
            "reject_reason": None,
            "uncertainty_label": "ok",
        }
    )
    return rec_id


def test_accept_watching() -> None:
    rec_id = _seed()
    row = repo.accept(rec_id, "t-a", "ok")
    assert row["status"] == "watching"


def test_snooze_hides_then_resurface() -> None:
    rec_id = _seed()
    repo.snooze(rec_id, "t-a", 7, None)
    assert repo.list_open("t-a") == []
    repo.get(rec_id, "t-a")["snooze_until"] = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    repo.sweep("t-a")
    assert repo.list_open("t-a")


def test_reject_requires_reason_stored() -> None:
    rec_id = _seed()
    row = repo.reject(rec_id, "t-a", "Already done this")
    assert row["reject_reason"] == "Already done this"
    hist = repo.list_history("t-a")
    assert hist[0]["status"] == "rejected"


def test_cross_tenant_404() -> None:
    rec_id = _seed("t-a")
    assert repo.get(rec_id, "t-b") is None
    assert repo.accept(rec_id, "t-b", None) is None
