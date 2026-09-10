from uuid import uuid4

from app.api.v1.copilot import _extract_provenance
from app.domain.copilot.agent import CopilotResponse


def test_extract_provenance_reads_sql_queries_run():
    result = CopilotResponse(
        question="q",
        intent="revenue_query",
        response="ok",
        sql_queries_run=["SELECT 1"],
        row_count=3,
    )
    prov = _extract_provenance(result, supabase=None, tenant_id=uuid4())
    assert prov["sql_used"] == "SELECT 1"
    assert prov["row_count"] == 3


def test_extract_provenance_empty_sql_stays_none():
    result = CopilotResponse(question="hi", intent="chat", response="hello")
    prov = _extract_provenance(result, supabase=None, tenant_id=uuid4())
    assert prov["sql_used"] is None
    assert prov["row_count"] is None
