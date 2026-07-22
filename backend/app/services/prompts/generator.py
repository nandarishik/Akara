from datetime import date
from uuid import UUID

from app.services.schema.discovery import SchemaDiscovery

# ── Industry-specific addendum registry ──────────────────────────────────────
# Each key is an industry slug (tenants.config.industry).
# Values are addendum strings appended to the generic _PLAN_SYSTEM /
# _SYNTHESIZE_SYSTEM constants at request time.
# Adding a new vertical = one new dict entry here. No other file changes needed.

_FMCG_DISTRIBUTION_SYNTHESIZER = """
Currency and number formatting:
- Always express monetary values in Indian format using the ₹ symbol with lakh/crore notation.
  Examples: ₹4.2 lakh, ₹1.3 crore, ₹85,000. Never write raw numbers like 420000 or 1300000.
  Threshold: < ₹1 lakh → ₹X,XXX; ≥ ₹1 lakh → ₹X.X lakh; ≥ ₹1 crore → ₹X.XX crore.
- Where the data supports it, estimate the business impact in ₹ lakh or ₹ crore.
  Example: "This represents an estimated ₹6.8 lakh in recoverable revenue if corrected."

Language:
- If the user's question is in Hindi (Devanagari script) or Hinglish, respond entirely in Hindi.
  SQL generation always stays in English internally.
- If the question is in English, respond in English.

Domain knowledge:
- Parties = distributors or retailers. Zones = geographic sales territories. Routes = distributor beats.
- Primary sales = ERP dispatch (sales_data). Secondary sales = DMS offtake (secondary_sales_data).
- Scheme leakage = claimed_amount > actual secondary offtake for the same party + product + date window.
"""

_FMCG_DISTRIBUTION_PLANNER = """
Additional table rules for FMCG distribution:
- For primary-vs-secondary comparisons: join or compare sales_data vs secondary_sales_data
  on party_name, product_name, and the relevant date range.
- For scheme leakage detection: join scheme_master vs secondary_sales_data on
  party_name + product_name WHERE invoice_date BETWEEN scheme_start AND scheme_end.
- outstanding_amount is nullable — always filter with IS NOT NULL AND outstanding_amount > 0.
- Prefer revenue = SUM(total_amount) and orders = COUNT(DISTINCT invoice_number).
"""

_INDUSTRY_ADDENDUMS: dict[str, dict[str, str]] = {
    "fmcg_distribution": {
        "synthesizer": _FMCG_DISTRIBUTION_SYNTHESIZER,
        "planner": _FMCG_DISTRIBUTION_PLANNER,
    },
    # Add new verticals here — no other file changes needed.
}


class PromptGenerator:
    """
    Builds context-aware system prompts for the copilot.

    Two responsibilities:
    1. Schema context — dynamic per-tenant string describing available tables/columns.
    2. Industry addendum registry — FMCG/pharma/retail-specific rules appended to base
       _PLAN_SYSTEM / _SYNTHESIZE_SYSTEM constants based on tenant config.
    """

    def __init__(self, schema_discovery: SchemaDiscovery) -> None:
        self._schema = schema_discovery

    def build_schema_context(self, tenant_id: UUID) -> str:
        return self._schema.get_schema_context(tenant_id)

    def build_synthesizer_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific synthesizer addendum, or '' for unknown industries."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("synthesizer", "")

    def build_planner_addendum(self, tenant_config: dict) -> str:
        """Returns the industry-specific planner addendum, or '' for unknown industries."""
        industry = tenant_config.get("industry", "")
        return _INDUSTRY_ADDENDUMS.get(industry, {}).get("planner", "")

    def build_system_prompt(
        self,
        tenant_id: UUID,
        tenant_name: str,
        start_date: str,
        end_date: str,
    ) -> str:
        """Legacy helper — kept for backward compatibility."""
        schema_context = self._schema.get_schema_context(tenant_id)
        return (
            f"You are AKARA Copilot, analytics assistant for {tenant_name}.\n"
            f"Today's date: {date.today().isoformat()}\n"
            f"Data available: {start_date} to {end_date}\n\n"
            f"Database schema:\n{schema_context}\n\n"
            f"Always:\n"
            f"- Filter by tenant_id = :tenant_id\n"
            f"- Reference only tables listed above\n"
            f"- Be specific with numbers and cite the date range\n"
        )
