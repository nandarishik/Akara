from app.core.config import Settings


def test_decision_engine_defaults() -> None:
    s = Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        supabase_service_role_key="svc",
        jwt_secret="secret",
        openrouter_api_key="sk",
    )
    assert s.decision_engine_enabled is True
    assert s.decision_engine_max_recs_per_tenant == 10
    assert s.max_expected_impact_inr == 500000
    assert s.confidence_medium_threshold == 0.40
