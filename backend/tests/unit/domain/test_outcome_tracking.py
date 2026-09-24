from datetime import UTC, datetime, timedelta

from app.domain.intelligence import recommendation_repo as repo
from app.workers.outcome_tracking_worker import run_outcome_tracking


def test_mocked_clock_populates_outcome() -> None:
    repo.reset_store()
    rec_id = "33333333-3333-3333-3333-333333333333"
    due = datetime(2026, 9, 24, tzinfo=UTC)
    repo.upsert(
        {
            "id": rec_id,
            "tenant_id": "t1",
            "recommendation_type": "pricing",
            "title": "t",
            "description": "d",
            "evidence": [],
            "confidence_score": 0.7,
            "confidence_methodology": "x",
            "status": "watching",
            "created_at": (due - timedelta(days=14)).isoformat(),
            "expires_at": (due + timedelta(days=16)).isoformat(),
            "expected_impact_max": 10000,
            "outcome_measurement_due": due.isoformat(),
        }
    )
    run_outcome_tracking(pre_post={rec_id: (1000.0, 9200.0)}, as_of=due)
    row = repo.get(rec_id, "t1")
    assert row is not None
    assert row["outcome_measured"] is not None
    assert row["status"] == "resolved"
