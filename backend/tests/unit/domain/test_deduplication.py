from datetime import UTC, datetime, timedelta

from app.domain.intelligence import recommendation_repo as repo
from app.domain.intelligence.dedup import should_supersede


def test_same_type_item_supersedes() -> None:
    now = datetime(2026, 9, 24, tzinfo=UTC)
    existing = {
        "status": "open",
        "recommendation_type": "pricing",
        "primary_item_id": "brew",
        "created_at": now - timedelta(days=2),
    }
    assert should_supersede(existing, "pricing", "brew", now=now)


def test_upsert_supersedes_older_open() -> None:
    repo.reset_store()
    repo.upsert(
        {
            "id": "old",
            "tenant_id": "t1",
            "recommendation_type": "pricing",
            "title": "old",
            "description": "d",
            "evidence": [],
            "confidence_score": 0.7,
            "confidence_methodology": "x",
            "status": "open",
            "created_at": "2026-09-01T00:00:00+00:00",
            "expires_at": "2026-10-01T00:00:00+00:00",
            "primary_item_id": "brew",
        }
    )
    repo.upsert(
        {
            "id": "new",
            "tenant_id": "t1",
            "recommendation_type": "pricing",
            "title": "new",
            "description": "d",
            "evidence": [],
            "confidence_score": 0.8,
            "confidence_methodology": "x",
            "status": "open",
            "created_at": "2026-09-20T00:00:00+00:00",
            "expires_at": "2026-10-20T00:00:00+00:00",
            "primary_item_id": "brew",
        }
    )
    assert repo.get("old", "t1")["status"] == "superseded"
