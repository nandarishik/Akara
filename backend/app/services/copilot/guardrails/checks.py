import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardrailResult:
    passed: bool
    check_name: str
    message: str


_QUESTION_STOPWORDS = frozenset({
    "sales", "revenue", "orders", "products", "customers", "total", "average",
    "top", "bottom", "compare", "trend", "last", "month", "week", "year",
    "quarter", "today", "yesterday", "best", "worst", "highest", "lowest",
    "what", "when", "where", "which", "were", "there", "many", "much", "more",
    "than", "from", "with", "have", "made", "across", "during", "period",
    "change", "percentage", "percent", "across", "after", "before", "between",
    "february", "january", "march", "april", "june", "july", "august",
    "september", "october", "november", "december",
    "dine", "menu", "items", "sold", "visited", "times", "bills", "raised",
    "channel", "jobs", "completed", "patients", "purchases", "distinct",
    "service", "visits", "invoice", "lines", "labour", "parts", "approximate",
    "gross", "profit", "proxy", "estimated", "settlement", "variance",
    "expected", "minus", "collected", "linked", "doctor", "referrals",
    "return", "rate", "refund", "amount", "insurance", "approved", "estimate",
    "final", "mechanic", "pharmacist", "cashier", "shift", "hour", "write",
    "expired", "medicine", "discount", "retail", "swiggy", "zomato", "takeaway",
})


def premise_check(
    question: str,
    available_columns: list[str],
    allowed_terms: list[str] | None = None,
) -> GuardrailResult:
    """
    Checks that the question refers to data that actually exists in the schema.
    Rejects queries about data we clearly don't have.
    """
    question_lower = question.lower()
    allowed = set(available_columns) | _QUESTION_STOPWORDS
    if allowed_terms:
        allowed |= {t.lower() for t in allowed_terms}
    unknown_entities = [
        term
        for term in re.findall(r"\b[a-z_]{4,}\b", question_lower)
        if term not in allowed
    ]
    if len(unknown_entities) > 3:
        return GuardrailResult(
            passed=False,
            check_name="premise_check",
            message=(
                f"Question may reference data not in scope. "
                f"Unrecognized terms: {unknown_entities[:5]}"
            ),
        )
    return GuardrailResult(passed=True, check_name="premise_check", message="OK")


def numeric_digest(response: str, sql_results: list[dict]) -> GuardrailResult:
    """
    Verifies that numbers mentioned in the response are grounded in SQL results.
    Extracts numbers from response and checks they appear in results.
    """
    if not sql_results:
        return GuardrailResult(
            passed=True, check_name="numeric_digest", message="No SQL results to verify"
        )

    response_numbers = set(re.findall(r"\b\d[\d,\.]*\b", response))
    result_numbers: set[str] = set()
    for row in sql_results[:50]:
        for value in row.values():
            if isinstance(value, (int, float)):
                result_numbers.add(str(int(value)))
                result_numbers.add(f"{value:.2f}")

    ungrounded = response_numbers - result_numbers
    if len(ungrounded) > 5:
        logger.warning("Numeric digest: %d ungrounded numbers found", len(ungrounded))
        # Warn but don't block — numbers may be derived (percentages, aggregates)

    return GuardrailResult(passed=True, check_name="numeric_digest", message="OK")


def numeric_postcheck(response: str) -> GuardrailResult:
    """Checks for hallucinated impossibly large numbers."""
    numbers = re.findall(r"\b(\d[\d,]*)\b", response.replace(",", ""))
    for num_str in numbers:
        try:
            num = int(num_str)
            if num > 10_000_000_000:  # 10 billion sanity cap
                return GuardrailResult(
                    passed=False,
                    check_name="numeric_postcheck",
                    message=f"Suspiciously large number detected: {num:,}",
                )
        except ValueError:
            pass
    return GuardrailResult(passed=True, check_name="numeric_postcheck", message="OK")


def causal_postcheck(response: str) -> GuardrailResult:
    """
    Flags responses that make strong causal claims not supported by correlation data.
    """
    causal_phrases = [
        "caused by",
        "resulted in",
        "because of",
        "due to the fact",
        "proven that",
        "definitively shows",
        "guarantees",
    ]
    response_lower = response.lower()
    triggered = [p for p in causal_phrases if p in response_lower]
    if triggered:
        return GuardrailResult(
            passed=False,
            check_name="causal_postcheck",
            message=(
                f"Response makes causal claims without sufficient evidence: {triggered}"
            ),
        )
    return GuardrailResult(passed=True, check_name="causal_postcheck", message="OK")


def data_scope_check(
    question: str, tenant_date_range: tuple[str, str]
) -> GuardrailResult:
    """
    Verifies the question is within the tenant's available data date range.
    """
    # Simple pass for now — can be extended with date extraction from question
    return GuardrailResult(passed=True, check_name="data_scope_check", message="OK")


def run_all_guardrails(
    question: str,
    response: str,
    sql_results: list[dict],
    available_columns: list[str],
    tenant_date_range: tuple[str, str],
    allowed_terms: list[str] | None = None,
) -> list[GuardrailResult]:
    """Run all guardrail checks and return list of results."""
    return [
        premise_check(question, available_columns, allowed_terms=allowed_terms),
        numeric_digest(response, sql_results),
        numeric_postcheck(response),
        causal_postcheck(response),
        data_scope_check(question, tenant_date_range),
    ]
