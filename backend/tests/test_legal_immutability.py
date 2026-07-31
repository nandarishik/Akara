"""Legal document immutability."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import AkaraHTTPException


@patch("app.services.legal.document_service.get_supabase_service_client")
def test_duplicate_version_raises_conflict(mock_supa):
    from app.services.legal.document_service import publish_document

    mock_supa.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "existing", "version": "1.0"}
    )
    with pytest.raises(AkaraHTTPException) as exc:
        publish_document(
            document_key="terms",
            version="1.0",
            title="Terms",
            body_markdown="# Terms",
            effective_at=datetime.now(UTC),
            requires_reacceptance=True,
            published_by=None,
        )
    assert exc.value.status_code == 409
