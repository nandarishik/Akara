from app.core.config import Settings

_BASE = {
    "supabase_url": "https://example.supabase.co",
    "supabase_anon_key": "anon-key",
    "supabase_service_role_key": "service-key",
    "jwt_secret": "secretsecretsecret",
    "openrouter_api_key": "sk-test",
}


def _settings(**kwargs: object) -> Settings:
    data = {**_BASE, **kwargs}
    return Settings(_env_file=None, **data)  # type: ignore[arg-type]


def test_staging_rejects_live_razorpay_key() -> None:
    s = _settings(environment="staging", razorpay_key_id="rzp_live_test")
    errors = s.validate_for_environment()
    assert any(e.startswith("LIVE_KEY_IN_NON_PROD") for e in errors)


def test_ci_does_not_require_razorpay() -> None:
    s = _settings(environment="ci", razorpay_key_id="")
    errors = s.validate_for_environment()
    assert not any("RAZORPAY" in e for e in errors)
    assert not any(
        e.startswith("MISSING_REQUIRED:") and "RAZORPAY" in e for e in errors
    )


def test_whatsapp_enabled_non_prod() -> None:
    s = _settings(environment="staging", whatsapp_sends_enabled=True)
    errors = s.validate_for_environment()
    assert "WHATSAPP_ENABLED_NON_PROD" in errors
