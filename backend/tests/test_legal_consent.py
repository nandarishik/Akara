"""Day 10 legal consent services."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.legal.document_service import consent_acceptance_rate


@patch("app.services.legal.document_service.get_supabase_service_client")
def test_acceptance_rate(mock_supa):
    profiles = MagicMock()
    profiles.select.return_value.execute.return_value = MagicMock(count=10)
    consents = MagicMock()
    consents.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(count=4)
    mock_supa.return_value.table.side_effect = lambda name: profiles if name == "profiles" else consents

    result = consent_acceptance_rate("terms", "1.0")
    assert result["total_users"] == 10
    assert result["accepted"] == 4
    assert result["rate_pct"] == 40.0
