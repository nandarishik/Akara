from app.core.config import settings


def test_settings_loads() -> None:
    assert settings.supabase_url.startswith("https://")
    assert len(settings.jwt_secret) > 10


def test_openrouter_model_is_date_pinned() -> None:
    model = settings.openrouter_model
    assert "/" in model
    assert any(year in model for year in ("2024", "2025", "2026"))


def test_allowed_origins_is_list() -> None:
    assert isinstance(settings.allowed_origins, list)
    assert len(settings.allowed_origins) >= 1


def test_is_production_flag() -> None:
    assert isinstance(settings.is_production, bool)


def test_is_development_in_ci() -> None:
    # ENVIRONMENT=ci in CI workflow — must not be treated as production
    assert settings.is_production is False or settings.environment != "ci"


def test_validate_for_environment_returns_list() -> None:
    errors = settings.validate_for_environment()
    assert isinstance(errors, list)


def test_effective_db_url_is_string() -> None:
    url = settings.effective_db_url
    assert isinstance(url, str)
    assert len(url) > 0
