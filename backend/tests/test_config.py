from app.core.config import settings


def test_settings_loads() -> None:
    assert settings.supabase_url.startswith("https://")
    assert len(settings.jwt_secret) > 10
    assert settings.gemini_api_key != ""


def test_allowed_origins_is_list() -> None:
    assert isinstance(settings.allowed_origins, list)
    assert len(settings.allowed_origins) >= 1


def test_is_production_flag() -> None:
    assert isinstance(settings.is_production, bool)
