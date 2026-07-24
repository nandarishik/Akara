from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Allow legacy env vars (gemini_api_key, weather_api_key, etc.) to remain
        # in .env files without causing validation errors during the Phase 1→2 transition.
        extra="ignore",
    )

    # -----------------------------------------------------------------------
    # Supabase
    # -----------------------------------------------------------------------
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    # Transaction-mode pooler URL (required in staging/production for Phase 2).
    # Leave empty in development to fall back to the direct URL.
    supabase_pooler_url: str = ""
    # Direct Postgres URI for async workers (asyncpg). Prefer pooler in production.
    supabase_db_url: str = ""
    # Supabase Storage bucket for async import uploads (default matches common project setup).
    supabase_imports_bucket: str = "storage"

    # -----------------------------------------------------------------------
    # JWT — must match Supabase project JWT secret
    # -----------------------------------------------------------------------
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # -----------------------------------------------------------------------
    # LLM — OpenRouter only (Gemini removed in Phase 2)
    # -----------------------------------------------------------------------
    openrouter_api_key: str
    # Date-pinned model — NEVER change to an alias without a date suffix.
    # Update this constant when intentionally upgrading the model.
    openrouter_model: str = "openai/gpt-4o-mini-2024-07-18"

    # -----------------------------------------------------------------------
    # Razorpay (required in staging/production)
    # -----------------------------------------------------------------------
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_pro_monthly_plan_id: str = ""
    razorpay_pro_annual_plan_id: str = ""
    razorpay_business_monthly_plan_id: str = ""
    razorpay_business_annual_plan_id: str = ""

    # -----------------------------------------------------------------------
    # Email — SendGrid
    # -----------------------------------------------------------------------
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "insights@akara.ai"
    sendgrid_from_name: str = "AKARA Insights"

    # -----------------------------------------------------------------------
    # WhatsApp — Zaptilo BSP
    # -----------------------------------------------------------------------
    zaptilo_api_key: str = ""
    zaptilo_sender_number: str = ""

    # -----------------------------------------------------------------------
    # Cloudflare Turnstile (CAPTCHA — required before Day 3 signup goes live)
    # -----------------------------------------------------------------------
    turnstile_secret_key: str = ""

    # -----------------------------------------------------------------------
    # Analytics — PostHog (required before Day 13 analytics go live)
    # -----------------------------------------------------------------------
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    # -----------------------------------------------------------------------
    # Error tracking — Sentry
    # -----------------------------------------------------------------------
    sentry_dsn: str = ""

    # -----------------------------------------------------------------------
    # Cron monitoring — healthchecks.io
    # -----------------------------------------------------------------------
    healthchecks_ping_url: str = ""          # base URL for all cron pings

    # -----------------------------------------------------------------------
    # Company / GST details (used in invoices and legal pages)
    # -----------------------------------------------------------------------
    company_name: str = "AKARA Analytics Pvt Ltd"
    company_gstin: str = ""
    company_address: str = ""
    company_state_code: str = ""            # e.g. "27" for Maharashtra
    support_email: str = "support@akara.ai"
    billing_email: str = "billing@akara.ai"

    # -----------------------------------------------------------------------
    # URLs (used in emails, redirects, CORS)
    # -----------------------------------------------------------------------
    customer_frontend_url: str = "http://localhost:5173"
    superadmin_frontend_url: str = "http://localhost:5173"
    # Comma-separated list of allowed CORS origins
    allowed_origins_raw: str = "http://localhost:5173"

    # -----------------------------------------------------------------------
    # Service key for Edge Function → backend auth bypass
    # -----------------------------------------------------------------------
    backend_service_key: str = ""

    # -----------------------------------------------------------------------
    # App
    # -----------------------------------------------------------------------
    environment: str = "development"
    log_level: str = "INFO"

    # -----------------------------------------------------------------------
    # Derived properties
    # -----------------------------------------------------------------------

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        return self.environment == "staging"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    @property
    def effective_db_url(self) -> str:
        """Returns the pooler URL in staging/production, direct URL in development."""
        if (self.is_production or self.is_staging) and self.supabase_pooler_url:
            return self.supabase_pooler_url
        return self.supabase_url

    @property
    def postgres_url(self) -> str:
        """Postgres connection string for asyncpg (import worker, SKIP LOCKED)."""
        if self.supabase_db_url:
            return self.supabase_db_url
        if self.supabase_pooler_url:
            return self.supabase_pooler_url
        return ""

    # -----------------------------------------------------------------------
    # Startup validation — called from main.py lifespan
    # -----------------------------------------------------------------------

    def validate_for_environment(self) -> list[str]:
        """Returns a list of validation error strings.
        Empty list = everything is fine.
        In production/staging, required-but-missing values are errors.
        In development, they are warnings only.
        """
        errors: list[str] = []

        # Always required
        for field, value in [
            ("SUPABASE_URL", self.supabase_url),
            ("SUPABASE_ANON_KEY", self.supabase_anon_key),
            ("SUPABASE_SERVICE_ROLE_KEY", self.supabase_service_role_key),
            ("JWT_SECRET", self.jwt_secret),
            ("OPENROUTER_API_KEY", self.openrouter_api_key),
        ]:
            if not value or value.startswith("your-"):
                errors.append(f"MISSING_REQUIRED: {field}")

        if self.is_production or self.is_staging:
            # Pooler required outside development
            if not self.supabase_pooler_url:
                errors.append("MISSING_STAGING_PROD: SUPABASE_POOLER_URL")

            # Payment stack required before Day 5 cutover
            for field, value in [
                ("RAZORPAY_KEY_ID", self.razorpay_key_id),
                ("RAZORPAY_KEY_SECRET", self.razorpay_key_secret),
                ("RAZORPAY_WEBHOOK_SECRET", self.razorpay_webhook_secret),
                ("RAZORPAY_PRO_MONTHLY_PLAN_ID", self.razorpay_pro_monthly_plan_id),
                ("RAZORPAY_BUSINESS_MONTHLY_PLAN_ID", self.razorpay_business_monthly_plan_id),
            ]:
                if not value:
                    errors.append(f"MISSING_STAGING_PROD: {field}")

            # Email required in staging/prod
            if not self.sendgrid_api_key:
                errors.append("MISSING_STAGING_PROD: SENDGRID_API_KEY")

            # Company/GST required for invoices
            if not self.company_gstin:
                errors.append("MISSING_STAGING_PROD: COMPANY_GSTIN")

        return errors


settings = Settings()
