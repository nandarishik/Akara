from datetime import date
from uuid import UUID

from app.infra.schema.discovery import SchemaDiscovery

# ── Industry-specific addendum registry ──────────────────────────────────────

_FMCG_DISTRIBUTION_SYNTHESIZER = """
Currency and number formatting:
- Always express monetary values in Indian format using the ₹ symbol with lakh/crore notation.
Domain knowledge:
- Parties = distributors or retailers. Routes = distributor beats or sales channels.
- Prefer revenue = SUM(COALESCE(net_amount, total_amount)) and orders = COUNT(DISTINCT invoice_number).
"""

_FMCG_DISTRIBUTION_PLANNER = """
Additional table rules for FMCG distribution:
- outstanding_amount is nullable — filter with IS NOT NULL AND outstanding_amount > 0 when needed.
- Prefer revenue = SUM(COALESCE(net_amount, total_amount)) and orders = COUNT(DISTINCT invoice_number).
- Filter channels on route when present.
"""

_RETAIL_HOSPITALITY_SYNTHESIZER = """
Domain knowledge (café / restaurant / retail POS):
- route = order channel (dine-in, swiggy, zomato, takeaway, delivery).
- Orders/bills = COUNT(DISTINCT invoice_number), never COUNT(*).
"""

_RETAIL_HOSPITALITY_PLANNER = """
POS / retail rules:
- Filter dine-in, swiggy, zomato, takeaway on route ILIKE — NOT product_category.
- Order counts and bill counts: COUNT(DISTINCT invoice_number).
- Repeat customers: GROUP BY party_name HAVING COUNT(DISTINCT invoice_number) > N.
- Cross-file: JOIN tenant_companion_data for wastage (dataset_type='wastage'), shifts ('shift'), settlements ('settlement').
"""

_PHARMACY_SYNTHESIZER = """
Domain knowledge (pharmacy retail):
- route = OTC vs Rx vs delivery channel.
- party_name = patient; pharmacist may be in raw_data or companion shift data.
"""

_PHARMACY_PLANNER = """
Pharmacy rules:
- OTC/Rx channel filters on route, not product_category.
- Bill counts: COUNT(DISTINCT invoice_number).
- Write-offs: SUM(amount) FROM tenant_companion_data WHERE dataset_type='writeoff'.
- Referrals: tenant_companion_data dataset_type='referral'.
- Pharmacist performance: companion dataset_type='shift' or raw_data keys.
"""

_AUTO_SERVICE_SYNTHESIZER = """
Domain knowledge (garage / auto service):
- route = payment channel (insurance, cash, credit).
- product_group = Parts vs Labour (Category column maps here; product_category is usually empty).
"""

_AUTO_SERVICE_PLANNER = """
Garage / auto service rules:
- Parts vs labour: filter product_group ILIKE 'parts' or 'labour' — NOT product_category.
- Insurance jobs: route ILIKE 'insurance'.
- Job/order counts: COUNT(DISTINCT invoice_number).
- Cross-file: vendor purchases dataset_type='vendor', timesheets='timesheet', estimates='estimate', insurance_claim='insurance_claim'.
- Revenue: SUM(COALESCE(net_amount, total_amount)).
"""

_INDUSTRY_ADDENDUMS: dict[str, dict[str, str]] = {
    "fmcg_distribution": {
        "synthesizer": _FMCG_DISTRIBUTION_SYNTHESIZER,
        "planner": _FMCG_DISTRIBUTION_PLANNER,
    },
    "retail_chain": {
        "synthesizer": _RETAIL_HOSPITALITY_SYNTHESIZER,
        "planner": _RETAIL_HOSPITALITY_PLANNER,
    },
    "cafe": {
        "synthesizer": _RETAIL_HOSPITALITY_SYNTHESIZER,
        "planner": _RETAIL_HOSPITALITY_PLANNER,
    },
    "restaurant": {
        "synthesizer": _RETAIL_HOSPITALITY_SYNTHESIZER,
        "planner": _RETAIL_HOSPITALITY_PLANNER,
    },
    "pharmacy": {
        "synthesizer": _PHARMACY_SYNTHESIZER,
        "planner": _PHARMACY_PLANNER,
    },
    "pharma_retail": {
        "synthesizer": _PHARMACY_SYNTHESIZER,
        "planner": _PHARMACY_PLANNER,
    },
    "auto_service": {
        "synthesizer": _AUTO_SERVICE_SYNTHESIZER,
        "planner": _AUTO_SERVICE_PLANNER,
    },
    "garage": {
        "synthesizer": _AUTO_SERVICE_SYNTHESIZER,
        "planner": _AUTO_SERVICE_PLANNER,
    },
}

# Benchmark business keys override tenant industry for deterministic tests
_BUSINESS_ADDENDUMS: dict[str, dict[str, str]] = {
    "cafe_brewlab": _INDUSTRY_ADDENDUMS["cafe"],
    "pharmacy_medplus": _INDUSTRY_ADDENDUMS["pharmacy"],
    "garage_autocare": _INDUSTRY_ADDENDUMS["garage"],
}

_LANGUAGE_NAMES: dict[str, tuple[str, str]] = {
    "hi": ("Hindi", "Devanagari script"),
    "te": ("Telugu", "Telugu script"),
    "ta": ("Tamil", "Tamil script"),
    "mr": ("Marathi", "Devanagari script"),
    "kn": ("Kannada", "Kannada script"),
    "bn": ("Bengali", "Bengali script"),
    "gu": ("Gujarati", "Gujarati script"),
}


class PromptGenerator:
    """Builds context-aware system prompts for the copilot."""

    def __init__(self, schema_discovery: SchemaDiscovery) -> None:
        self._schema = schema_discovery

    def build_schema_context(self, tenant_id: UUID) -> str:
        return self._schema.get_schema_context(tenant_id)

    def _resolve_addendum(self, tenant_config: dict, kind: str) -> str:
        industry = tenant_config.get("industry", "")
        entry = _INDUSTRY_ADDENDUMS.get(industry, {})
        return entry.get(kind, "")

    def build_synthesizer_addendum(
        self, tenant_config: dict, *, business: str | None = None
    ) -> str:
        if business and business in _BUSINESS_ADDENDUMS:
            return _BUSINESS_ADDENDUMS[business].get("synthesizer", "")
        return self._resolve_addendum(tenant_config, "synthesizer")

    def build_planner_addendum(
        self, tenant_config: dict, *, business: str | None = None
    ) -> str:
        if business and business in _BUSINESS_ADDENDUMS:
            return _BUSINESS_ADDENDUMS[business].get("planner", "")
        return self._resolve_addendum(tenant_config, "planner")

    def build_language_addendum(self, tenant_config: dict) -> str:
        language = tenant_config.get("language", "en")
        if language == "en" or language not in _LANGUAGE_NAMES:
            return ""
        name, script = _LANGUAGE_NAMES[language]
        return f"""
Language rules:
Mirror the language of the user's question. SQL is always generated in English.
Selected languages: English and {name} ({script}).
"""

    def build_system_prompt(
        self,
        tenant_id: UUID,
        tenant_name: str,
        start_date: str,
        end_date: str,
    ) -> str:
        schema_context = self._schema.get_schema_context(tenant_id)
        return (
            f"You are AKARA Copilot, analytics assistant for {tenant_name}.\n"
            f"Today's date: {date.today().isoformat()}\n"
            f"Data available: {start_date} to {end_date}\n\n"
            f"Database schema:\n{schema_context}\n"
        )
