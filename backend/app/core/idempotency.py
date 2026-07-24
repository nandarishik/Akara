"""Idempotency-key validation for AKARA Phase 2 mutations.

Any state-changing endpoint that must be safe to retry (payment triggers,
imports, team invites, etc.) should:
  1. Accept `Idempotency-Key: <uuid>` header via the `IdempotencyKey` dep.
  2. Look up the key in the `idempotency_keys` table before processing.
  3. Store the serialised response after success.
  4. Return the stored response on replay without re-executing.

Phase 2 Note: the storage backend (Supabase RPC) is wired in Day 2 once
`011_billing.sql` creates the `idempotency_keys` table.  Until then, the
dependency still validates header format so callers are aware of the contract.
"""

from __future__ import annotations

import re
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def require_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str:
    """FastAPI dependency: validates the `Idempotency-Key` header.

    Raises HTTP 400 if the header is missing or not a valid UUID v4 string.
    Returns the normalised (lowercased) key string.
    """
    if not idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key header is required for this operation.",
        )
    key = idempotency_key.strip()
    if not _UUID_RE.match(key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Idempotency-Key must be a UUID v4 string "
                "(xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)."
            ),
        )
    return key.lower()


def optional_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str | None:
    """Like require_idempotency_key but returns None if header is absent."""
    if not idempotency_key:
        return None
    return require_idempotency_key(idempotency_key)


# Type aliases for use as FastAPI Annotated dependencies
IdempotencyKey = Annotated[str, Depends(require_idempotency_key)]
OptionalIdempotencyKey = Annotated[str | None, Depends(optional_idempotency_key)]
