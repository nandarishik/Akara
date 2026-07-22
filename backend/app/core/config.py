from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # JWT — must match Supabase project JWT secret
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # LLM
    gemini_api_key: str
    openrouter_api_key: str

    # Email (optional during development)
    gmail_user: str = ""
    gmail_app_password: str = ""

    # External context APIs (optional during development)
    weather_api_key: str = ""
    news_api_key: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"

    # Stored as a comma-separated string so Railway env vars (no array support) work.
    # Use the `allowed_origins` property to get the parsed list.
    allowed_origins_raw: str = "http://localhost:5173"

    # Sentry (optional until Day 10)
    sentry_dsn: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        """Splits ALLOWED_ORIGINS_RAW into a list for CORSMiddleware."""
        return [origin.strip() for origin in self.allowed_origins_raw.split(",")]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
